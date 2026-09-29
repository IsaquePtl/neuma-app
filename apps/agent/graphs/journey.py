"""Journey handoffs pipeline — Claude Sonnet + Postgres checkpoints + contexts."""

from __future__ import annotations

import re
from typing import Literal

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import before_model, wrap_model_call
from langchain.messages import ToolMessage
from langchain.tools import ToolRuntime, tool
from langgraph.types import Command

from contexts.loader import inject_context_for_prompt, load_student_context
from graphs.guard import run_guard
from shared.checkpointer import get_checkpointer
from shared.llm import Workload, get_llm, model_string
from shared.path_draft import (
    build_and_insert_draft_for_student,
    compact_answer,
)
from shared.tracer import RunTracer
from shared.truncation import make_truncation_middleware
from shared.voice import HITL_BLOCK, TELEGRAPHIC_BLOCK, VOICE_BLOCK
from skills.loader import load_skill
from tools.propose import apply_draft_path_edit, propose_path_draft, set_propose_context
from tools.read import get_path, get_student_360, get_student_brief, reset_facts

JourneyStep = Literal["intake", "brief", "draft", "review", "complete"]

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)


class JourneyState(AgentState):
    current_step: JourneyStep = "intake"
    placeholder_name: str = ""
    claim_email: str = ""
    brief_markdown: str = ""
    brief_id: str = ""
    student_id: str = ""
    draft_summary: str = ""
    proposal_id: str = ""
    path_id: str = ""


@tool
def ingest_brief(
    placeholder_name: str,
    brief_markdown: str,
    claim_email: str = "",
    brief_id: str = "",
    student_id: str = "",
    runtime: ToolRuntime = None,
) -> Command:
    """Regista o brief do aluno e avança para a fase de análise do perfil."""
    return Command(
        update={
            "placeholder_name": placeholder_name,
            "brief_markdown": brief_markdown,
            "claim_email": claim_email,
            "brief_id": brief_id,
            "student_id": student_id,
            "current_step": "brief",
            "messages": [
                ToolMessage(
                    "Brief registado. Avança para analisar o perfil e mapear níveis.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def confirm_profile_analysis(
    summary: str,
    runtime: ToolRuntime = None,
) -> Command:
    """Confirma a análise do perfil e avança para draft do percurso."""
    return Command(
        update={
            "draft_summary": summary,
            "current_step": "draft",
            "messages": [
                ToolMessage(
                    "Perfil confirmado. Monta percurso de ~3–4 meses em semanas "
                    "(Mon–Sex; início à segunda). Cada nível = N semanas (mín. 1). "
                    "Chama propose_path_draft com student_id do estado se existir. "
                    "Depois mark_draft_ready.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def mark_draft_ready(
    proposal_note: str,
    path_id: str = "",
    runtime: ToolRuntime = None,
) -> Command:
    """Marca o draft como pronto (após propose_path_draft ter criado o rascunho)."""
    return Command(
        update={
            "draft_summary": proposal_note,
            "path_id": path_id,
            "current_step": "review",
            "messages": [
                ToolMessage(
                    "Draft no app. Resume em 1–2 linhas (título + nº níveis) — "
                    "SEM JSON de nodes. Chama complete_journey.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def complete_journey(runtime: ToolRuntime = None) -> Command:
    """Fecha o pipeline — mentor edita o rascunho e activa quando pronto."""
    return Command(
        update={
            "current_step": "complete",
            "messages": [
                ToolMessage(
                    "Pipeline completo. Rascunho no studio; mentor edita e activa.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


STEP_CONFIG = {
    "intake": {
        "prompt": (
            "És o intake da Neuma. "
            "Se a mensagem / estado tiver student_id (UUID): "
            "NÃO peças a ROTA ao mentor. Chama get_student_brief(student_id=…) "
            "e get_student_360(student_id=…); depois ingest_brief com "
            "placeholder_name, brief_markdown (do brief/ficha) e o mesmo student_id. "
            "Se NÃO houver student_id: o mentor cola a ROTA DE TRANSFORMAÇÃO — "
            "usa load_skill('formato-rota') se precisares. "
            "Se o nome do aluno for Eduardo/Márcio/Bernardo, chama load_student_context. "
            "Chama ingest_brief com placeholder_name e brief_markdown completo. "
            f"{VOICE_BLOCK} {HITL_BLOCK}"
        ),
        "tools": [
            ingest_brief,
            load_skill,
            get_student_brief,
            get_student_360,
            load_student_context,
        ],
    },
    "brief": {
        "prompt": (
            "Analisa o brief de {placeholder_name} (student_id={student_id}). "
            "Extrai histórico, ponto de partida, objectivos e fases. "
            "Se precisares de mais contexto da ficha, chama get_student_360. "
            "Usa o contexto pedagógico injectado se existir. "
            "Chama confirm_profile_analysis com um sumário estruturado. "
            f"{VOICE_BLOCK}"
        ),
        "tools": [
            confirm_profile_analysis,
            load_skill,
            load_student_context,
            get_student_360,
        ],
    },
    "draft": {
        "prompt": (
            "Monta o percurso de {placeholder_name} (student_id={student_id}) "
            "para ~3–4 meses. A base é SEMANAS (segunda a sexta); início sempre "
            "à segunda. Cada nível tem duration_weeks ≥ 1; a soma preenche o período. "
            "Níveis PODEM ficar sem conteúdo (content_body/resource_url vazios). "
            "Chama propose_path_draft com nodes_json (+ duration_weeks) e student_id "
            "quando existir — isto CRIA o rascunho no app (status=draft). "
            "Depois mark_draft_ready com pathId da tool. "
            "NUNCA dumps o JSON de nodes no chat ao mentor. "
            f"{HITL_BLOCK} {VOICE_BLOCK}"
        ),
        "tools": [propose_path_draft, mark_draft_ready, load_skill, load_student_context],
    },
    "review": {
        "prompt": (
            "Resume em 1–2 linhas: título, nº níveis, «edita no studio e activa». "
            "Sem JSON. Chama complete_journey. "
            f"{VOICE_BLOCK} {TELEGRAPHIC_BLOCK}"
        ),
        "tools": [complete_journey],
    },
    "complete": {
        "prompt": "Pipeline concluído. Confirma rascunho no studio (status draft).",
        "tools": [],
    },
}


@wrap_model_call
def apply_step_config(request, handler):
    step = request.state.get("current_step") or "intake"
    cfg = STEP_CONFIG[step]
    name = request.state.get("placeholder_name") or "o aluno"
    sid = request.state.get("student_id") or ""
    prompt = cfg["prompt"].format(placeholder_name=name, student_id=sid or "—")
    prompt += inject_context_for_prompt(name)
    return handler(request.override(system_prompt=prompt, tools=cfg["tools"]))


@before_model(can_jump_to=["end"])
def end_turn_after_handoff(state, runtime):  # noqa: ARG001
    messages = state.get("messages") or []
    for m in reversed(messages[-6:]):
        name = getattr(m, "name", None)
        if name in (
            "ingest_brief",
            "confirm_profile_analysis",
            "mark_draft_ready",
            "complete_journey",
        ):
            if messages and messages[-1] is m:
                return {"jump_to": "end"}
            break
    return None


def build_journey_pipeline(*, mentor_id: str, thread_id: str, use_memory: bool = True):
    return create_agent(
        get_llm(Workload.JOURNEY),
        tools=STEP_CONFIG["intake"]["tools"],
        middleware=[
            apply_step_config,
            end_turn_after_handoff,
            make_truncation_middleware(mentor_id=mentor_id, thread_id=thread_id),
        ],
        state_schema=JourneyState,
        checkpointer=get_checkpointer(use_memory=use_memory),
    )


def _extract_student_id_from_text(text: str) -> str | None:
    m = re.search(r"student_id\s*=\s*([0-9a-f-]{36})", text, re.I)
    if m and _UUID_RE.match(m.group(1)):
        return m.group(1)
    m = re.search(r"studentId=([0-9a-f-]{36})", text, re.I)
    if m and _UUID_RE.match(m.group(1)):
        return m.group(1)
    return None


def _extract_student_name_from_text(text: str) -> str | None:
    m = re.search(r"nome\s*=\s*([^\n.;]+)", text, re.I)
    if m:
        return m.group(1).strip() or None
    m = re.search(r"studentName=([^;]+)", text)
    if m:
        return m.group(1).strip() or None
    return None


def _extract_path_id_from_text(text: str) -> str | None:
    m = re.search(r"path_id\s*=\s*([0-9a-f-]{36})", text, re.I)
    if m and _UUID_RE.match(m.group(1)):
        return m.group(1)
    m = re.search(r"pathId=([0-9a-f-]{36})", text, re.I)
    if m and _UUID_RE.match(m.group(1)):
        return m.group(1)
    return None


def _path_draft_payload(result: dict) -> dict | None:
    if not result.get("pathId"):
        return None
    return {
        "pathId": result["pathId"],
        "proposalId": result.get("proposalId"),
        "title": result.get("title") or "Percurso",
        "levelCount": result.get("levelCount") or 0,
        "preview": result.get("preview") or [],
        "href": result.get("href") or f"/studio/journeys/{result['pathId']}",
        "status": result.get("status") or "draft",
        "reused": bool(result.get("reused") or result.get("existing")),
    }


async def _run_deterministic_draft(
    *,
    mentor_id: str,
    thread_id: str,
    student_id: str,
    student_name: str | None,
    tracer: RunTracer,
    model: str,
) -> dict:
    await tracer.emit("node", {"name": "journey_draft_builder", "model": model})
    result = build_and_insert_draft_for_student(
        mentor_id=mentor_id,
        student_id=student_id,
        student_name=student_name,
        thread_id=thread_id,
    )
    answer = compact_answer(result)
    path_draft = _path_draft_payload(result)
    # Active-path case still has pathId but is not a new draft card CTA primary
    if result.get("error") == "active_path" and result.get("pathId"):
        path_draft = {
            "pathId": result["pathId"],
            "title": result.get("title") or "Percurso activo",
            "levelCount": 0,
            "preview": [],
            "href": result.get("href") or f"/studio/journeys/{result['pathId']}",
            "status": "active",
            "reused": False,
        }
    final = {
        "answer": answer,
        "current_step": "complete" if path_draft and not result.get("error") else "intake",
        "placeholder_name": student_name,
        "student_id": student_id,
        "model": model,
        "pathDraft": path_draft,
        "skip_guard": True,
    }
    await tracer.emit_done(final)
    return final


def _extract_path_draft_from_messages(messages: list) -> dict | None:
    """Pull compact pathDraft from propose_path_draft / apply_draft_path_edit tool results."""
    import json

    for m in reversed(messages or []):
        name = getattr(m, "name", None)
        if name not in ("propose_path_draft", "apply_draft_path_edit"):
            continue
        content = getattr(m, "content", "") or ""
        if not isinstance(content, str):
            content = str(content)
        try:
            data = json.loads(content)
        except Exception:
            continue
        # _record returns the payload dict directly (json.dumps(payload))
        payload = data
        if isinstance(data, dict) and "data" in data and "pathId" not in data:
            payload = data["data"]
        if isinstance(payload, list) and payload:
            payload = payload[0]
        if not isinstance(payload, dict):
            continue
        inner = payload
        if "pathId" not in inner:
            for v in payload.values():
                if isinstance(v, dict) and v.get("pathId"):
                    inner = v
                    break
                if isinstance(v, list) and v and isinstance(v[0], dict) and v[0].get("pathId"):
                    inner = v[0]
                    break
        if inner.get("pathId"):
            return _path_draft_payload(inner)
    return None


async def _run_path_resume(
    *,
    mentor_id: str,
    thread_id: str,
    path_id: str,
    student_id: str | None,
    student_name: str | None,
    message: str,
    tracer: RunTracer,
    model: str,
) -> dict:
    """Continue editing an existing draft — same thread / screen continuity."""
    import asyncio

    from shared.path_draft import apply_draft_path_changes

    system = (
        "És o especialista de percursos Neuma. Continuas uma conversa de criação "
        "de percurso já em curso — o mentor vê o histórico no ecrã e espera continuidade.\n"
        f"path_id={path_id}\n"
        f"student_id={student_id or '—'}\n"
        f"nome={student_name or '—'}\n"
        "1) Chama get_path(path_id) se precisares do estado actual.\n"
        "2) Aplica alterações com apply_draft_path_edit (só draft).\n"
        "3) Resposta telegráfica curta; NÃO dumps JSON completo.\n"
        f"{HITL_BLOCK} {VOICE_BLOCK} {TELEGRAPHIC_BLOCK}"
    )
    agent = create_agent(
        get_llm(Workload.JOURNEY),
        tools=[get_path, apply_draft_path_edit, get_student_brief, load_skill],
        system_prompt=system,
        checkpointer=get_checkpointer(use_memory=True),
        middleware=[
            make_truncation_middleware(mentor_id=mentor_id, thread_id=thread_id),
        ],
    )

    enriched = (
        f"[Retoma — NÃO cries percurso novo; edita o draft path_id={path_id}]\n"
        f"student_id={student_id or ''}\n"
        f"nome={student_name or ''}\n\n"
        f"{message}"
    )

    def invoke():
        return agent.invoke(
            {"messages": [{"role": "user", "content": enriched}]},
            config={"configurable": {"thread_id": thread_id}},
        )

    result = await asyncio.get_event_loop().run_in_executor(None, invoke)
    messages = result.get("messages") or []
    last = messages[-1] if messages else None
    text = getattr(last, "content", "") if last else ""
    if not isinstance(text, str):
        text = str(text)

    path_draft = _extract_path_draft_from_messages(messages)
    if not path_draft:
        # Fallback card from current path if tool returned update
        try:
            refreshed = apply_draft_path_changes(path_id=path_id, changes={})
            if refreshed.get("pathId"):
                path_draft = _path_draft_payload(refreshed)
        except Exception:
            path_draft = {
                "pathId": path_id,
                "title": "Percurso",
                "levelCount": 0,
                "preview": [],
                "href": f"/studio/journeys/{path_id}",
                "status": "draft",
                "updated": True,
            }

    # Prefer short answer; keep telegraphic
    answer = (text or "").strip()
    if path_draft and (
        not answer
        or answer.startswith("{")
        or "Versão Final" in answer
        or len(answer) > 1200
    ):
        title = path_draft.get("title") or "Percurso"
        n = path_draft.get("levelCount") or 0
        answer = f"Actualizei o rascunho «{title}» · {n} níveis. Vê o cartão / Abrir percurso."

    final = {
        "answer": answer,
        "student_id": student_id,
        "model": model,
        "pathDraft": path_draft,
        "skip_guard": True,
    }
    await tracer.emit_done(final)
    return final


async def run_journey(
    message: str,
    *,
    thread_id: str,
    mentor_id: str,
    tracer: RunTracer,
    student_id: str | None = None,
    page_context: str = "",
) -> dict:
    import asyncio

    reset_facts()
    set_propose_context(mentor_id=mentor_id, thread_id=thread_id)
    model = model_string(Workload.JOURNEY)
    await tracer.emit("node", {"name": "journey", "model": model})

    sid = (student_id or "").strip() or None
    if not sid:
        sid = _extract_student_id_from_text(message) or _extract_student_id_from_text(
            page_context
        )
    name = _extract_student_name_from_text(message) or _extract_student_name_from_text(
        page_context
    )
    path_id = _extract_path_id_from_text(message) or _extract_path_id_from_text(
        page_context
    )

    # Follow-up while draft exists: resume edits (do NOT recreate).
    resume = bool(
        path_id
        and (
            "resume-path" in (page_context or "")
            or "Retoma" in message
            or "retoma" in message.lower()
        )
    )
    if path_id and (
        resume or "resume-path" in (page_context or "") or "action=resume" in (page_context or "")
    ):
        return await _run_path_resume(
            mentor_id=mentor_id,
            thread_id=thread_id,
            path_id=path_id,
            student_id=sid,
            student_name=name,
            message=message,
            tracer=tracer,
            model=model,
        )
    # If pathId present without explicit resume flag, still prefer resume over recreate
    if path_id and sid:
        return await _run_path_resume(
            mentor_id=mentor_id,
            thread_id=thread_id,
            path_id=path_id,
            student_id=sid,
            student_name=name,
            message=message,
            tracer=tracer,
            model=model,
        )

    # Agents Hub known-student flow: deterministic draft (no multi-step stall).
    create_intent = bool(
        sid
        and not path_id
        and (
            "create-path" in (page_context or "")
            or "propose_path_draft" in message
            or "criar um percurso" in message.lower()
            or "cria percurso" in message.lower()
            or "criar percurso" in message.lower()
        )
    )
    if create_intent and sid:
        return await _run_deterministic_draft(
            mentor_id=mentor_id,
            thread_id=thread_id,
            student_id=sid,
            student_name=name,
            tracer=tracer,
            model=model,
        )

    pipeline = build_journey_pipeline(
        mentor_id=mentor_id, thread_id=thread_id, use_memory=True
    )

    enriched = message
    if sid:
        enriched = (
            f"[Aluno seleccionado na UI — NÃO peças a ROTA]\n"
            f"student_id={sid}\n"
            f"nome={name or ''}\n\n"
            f"[Pedido do mentor]\n{message}\n\n"
            "INSTRUÇÕES: Chama get_student_brief(student_id=…) e "
            "get_student_360(student_id=…). Depois ingest_brief com o conteúdo "
            "e o mesmo student_id. No propose_path_draft passa student_id. "
            "Não dumps JSON de nodes no chat."
        )
    elif page_context:
        enriched = (
            f"[Contexto da página]\n{page_context}\n\n"
            f"[Pedido do mentor]\n{message}"
        )

    initial: dict = {
        "messages": [{"role": "user", "content": enriched}],
    }
    if sid:
        initial["student_id"] = sid
    if name:
        initial["placeholder_name"] = name

    def invoke():
        return pipeline.invoke(
            initial,
            config={"configurable": {"thread_id": thread_id}},
        )

    result = await asyncio.get_event_loop().run_in_executor(None, invoke)
    messages = result.get("messages") or []
    last = messages[-1] if messages else None
    text = getattr(last, "content", "") if last else ""
    if not isinstance(text, str):
        text = str(text)

    path_draft = _extract_path_draft_from_messages(messages)
    if path_draft:
        # Skip Guard wall of "Versão Final Verificada" for successful path creation
        answer = compact_answer(path_draft)
        final = {
            "answer": answer,
            "current_step": result.get("current_step"),
            "placeholder_name": result.get("placeholder_name"),
            "student_id": result.get("student_id") or sid,
            "model": model,
            "pathDraft": path_draft,
            "skip_guard": True,
        }
    else:
        verified = run_guard(draft=text)
        final = {
            "answer": verified,
            "current_step": result.get("current_step"),
            "placeholder_name": result.get("placeholder_name"),
            "student_id": result.get("student_id") or sid,
            "model": model,
        }
    await tracer.emit_done(final)
    return final
