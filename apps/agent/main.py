"""Neuma Agent — FastAPI + LangGraph (Vercel Services entrypoint: main:app)."""

from __future__ import annotations

import asyncio
import os
import secrets
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from shared.auth import require_agent_token
from shared.checkpointer import checkpointer_backend
from shared.llm import (
    Workload,
    apply_google_env,
    has_anthropic_key,
    has_google_key,
    model_string,
    resolve_model_id,
    workload_for_pattern,
)
from shared.tracer import RunTracer

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / "web" / ".env.local", override=False)
apply_google_env()

app = FastAPI(title="Neuma Agent", version="0.1.0")

_runs: dict[str, RunTracer] = {}

PATTERNS = {
    "supervisor": {
        "id": "supervisor",
        "label": "Supervisor (subagents)",
        "summary": "Cérebro do copiloto — delega a especialistas",
        "conversational": True,
    },
    "router": {
        "id": "router",
        "label": "Router (Send fan-out)",
        "summary": "Perguntas de panorama em paralelo",
        "conversational": False,
    },
    "journey": {
        "id": "journey",
        "label": "Journey (handoffs)",
        "summary": "Pipeline brief → percurso em rascunho",
        "conversational": True,
    },
    "briefing": {
        "id": "briefing",
        "label": "Briefing diário",
        "summary": "Factos + Guard para o ecrã Geral",
        "conversational": False,
    },
}


class RunRequest(BaseModel):
    pattern: str = "supervisor"
    message: str
    mentor_id: str
    thread_id: str | None = None
    page_context: str | None = None
    student_id: str | None = None
    new_thread: bool = False


class BriefingRequest(BaseModel):
    mentor_id: str
    mentor_name: str = "Mentor"


class JourneyDraftRequest(BaseModel):
    mentor_id: str
    message: str
    thread_id: str | None = None
    student_id: str | None = None


@app.get("/health")
async def health(_: None = Depends(require_agent_token)):
    models = {}
    model_error = None
    try:
        for w in Workload:
            models[w.value] = model_string(w)
        _ = resolve_model_id()
    except Exception as e:
        model_error = str(e)
    return {
        "ok": True,
        "google_api_key_present": has_google_key(),
        "anthropic_api_key_present": has_anthropic_key(),
        "models": models,
        "model": models.get("supervisor"),
        "model_error": model_error,
        "supabase_url_present": bool(
            os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        ),
        "service_role_present": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
        "db_uri_present": bool(os.getenv("SUPABASE_DB_URI")),
        "checkpointer": checkpointer_backend(),
        "patterns": list(PATTERNS.keys()),
    }


@app.get("/patterns")
async def patterns(_: None = Depends(require_agent_token)):
    return {"patterns": list(PATTERNS.values())}


@app.post("/run")
async def run(payload: RunRequest, _: None = Depends(require_agent_token)):
    if payload.pattern not in PATTERNS:
        raise HTTPException(400, f"Unknown pattern: {payload.pattern}")
    if not payload.message.strip():
        raise HTTPException(400, "message required")
    if not payload.mentor_id:
        raise HTTPException(400, "mentor_id required")
    if not has_google_key():
        raise HTTPException(400, "GOOGLE_GENERATIVE_AI_API_KEY missing")
    if not has_anthropic_key():
        raise HTTPException(400, "ANTHROPIC_API_KEY missing (guard/journey/briefing)")

    thread_id = payload.thread_id or str(uuid.uuid4())
    if payload.new_thread:
        thread_id = str(uuid.uuid4())

    run_id = secrets.token_urlsafe(10)
    tracer = RunTracer()
    _runs[run_id] = tracer

    async def _worker():
        try:
            await _dispatch(
                payload.pattern,
                payload.message,
                mentor_id=payload.mentor_id,
                thread_id=thread_id,
                tracer=tracer,
                page_context=payload.page_context or "",
                student_id=payload.student_id,
            )
        except Exception as e:
            await tracer.emit_error({"message": str(e)})
        finally:
            await asyncio.sleep(120)
            _runs.pop(run_id, None)

    asyncio.create_task(_worker())
    return {
        "run_id": run_id,
        "thread_id": thread_id,
        "model": model_string(workload_for_pattern(payload.pattern)),
    }


@app.get("/events/{run_id}")
async def events(run_id: str, _: None = Depends(require_agent_token)):
    tracer = _runs.get(run_id)
    if tracer is None:
        raise HTTPException(404, "Unknown or expired run_id")

    async def _gen():
        async for chunk in tracer.sse_generator():
            yield chunk

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/briefing")
async def briefing(payload: BriefingRequest, _: None = Depends(require_agent_token)):
    if not has_google_key():
        raise HTTPException(400, "GOOGLE_GENERATIVE_AI_API_KEY missing")
    if not has_anthropic_key():
        raise HTTPException(400, "ANTHROPIC_API_KEY missing")
    from graphs.briefing import run_briefing

    tracer = RunTracer()
    result = await run_briefing(tracer, mentor_name=payload.mentor_name)
    return {
        "briefing": result.get("briefing"),
        "model": model_string(Workload.BRIEFING),
        "local": False,
        "facts_preview": result.get("facts_tool_output"),
    }


@app.post("/journey/draft")
async def journey_draft(payload: JourneyDraftRequest, _: None = Depends(require_agent_token)):
    if not has_google_key():
        raise HTTPException(400, "GOOGLE_GENERATIVE_AI_API_KEY missing")
    if not has_anthropic_key():
        raise HTTPException(400, "ANTHROPIC_API_KEY missing")
    from graphs.journey import run_journey

    tracer = RunTracer()
    thread_id = payload.thread_id or str(uuid.uuid4())
    result = await run_journey(
        payload.message,
        thread_id=thread_id,
        mentor_id=payload.mentor_id,
        tracer=tracer,
        student_id=payload.student_id,
    )
    return result


class LibraryGapsRequest(BaseModel):
    mentor_id: str


@app.post("/library/gaps")
async def library_gaps(
    payload: LibraryGapsRequest,
    _: None = Depends(require_agent_token),
):
    """Ask supervisor library specialist to scan paths and create empty topics."""
    mentor_id = payload.mentor_id
    from graphs.supervisor import run_supervisor

    tracer = RunTracer()
    thread_id = str(uuid.uuid4())
    msg = (
        "Analisa os percursos activos/draft com get_progress_snapshot e get_library_tree. "
        "Para cada tema de nível que ainda não exista na biblioteca, cria categoria/tópico/asset vazio "
        "com rationale. Não dupliques títulos."
    )
    result = await run_supervisor(
        msg,
        thread_id=thread_id,
        mentor_id=mentor_id,
        tracer=tracer,
    )
    return result


async def _dispatch(
    pattern: str,
    message: str,
    *,
    mentor_id: str,
    thread_id: str,
    tracer: RunTracer,
    page_context: str,
    student_id: str | None = None,
):
    t0 = time.time()
    await tracer.emit(
        "start",
        {
            "pattern": pattern,
            "model": model_string(workload_for_pattern(pattern)),
        },
    )
    if pattern == "briefing":
        from graphs.briefing import run_briefing

        await run_briefing(tracer, mentor_name="Mentor", message=message)
    elif pattern == "router":
        from graphs.router import run_router

        await run_router(message, tracer)
    elif pattern == "journey":
        from graphs.journey import run_journey

        await run_journey(
            message,
            thread_id=thread_id,
            mentor_id=mentor_id,
            tracer=tracer,
            student_id=student_id,
            page_context=page_context,
        )
    else:
        from graphs.supervisor import run_supervisor

        # Prefer first-class student_id; also fold into page_context for specialists.
        ctx = page_context
        if student_id:
            extra = f"studentId={student_id}"
            ctx = f"{ctx};{extra}" if ctx else extra

        await run_supervisor(
            message,
            thread_id=thread_id,
            mentor_id=mentor_id,
            tracer=tracer,
            page_context=ctx,
        )
    await tracer.emit("meta", {"latency_ms": int((time.time() - t0) * 1000)})
