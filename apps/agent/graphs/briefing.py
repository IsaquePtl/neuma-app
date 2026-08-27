"""Briefing graph — load facts via tools, then Guard."""

from __future__ import annotations

from shared.tracer import RunTracer
from tools.read import get_dashboard_facts, get_progress_snapshot, list_upcoming_sessions, reset_facts
from graphs.guard import run_guard


async def run_briefing(tracer: RunTracer, mentor_name: str = "Mentor") -> dict:
    reset_facts()
    await tracer.emit("node", {"name": "load_facts"})
    facts_raw = get_dashboard_facts.invoke({})
    await tracer.emit("tool", {"name": "get_dashboard_facts", "preview": facts_raw[:500]})
    progress = get_progress_snapshot.invoke({})
    await tracer.emit("tool", {"name": "get_progress_snapshot", "preview": progress[:400]})
    sessions = list_upcoming_sessions.invoke({})
    await tracer.emit("tool", {"name": "list_upcoming_sessions", "preview": sessions[:400]})

    await tracer.emit("node", {"name": "guard"})
    briefing = run_guard(
        draft=(
            f"Gera o briefing diário para o mentor {mentor_name}. "
            "Prioriza calls próximas, check-ins pendentes, alunos quietos (só com percurso activo), "
            "onboardings e propostas pendentes."
        )
    )
    final = {
        "briefing": briefing,
        "facts_tool_output": facts_raw[:4000],
        "progress_preview": progress[:1500],
        "sessions_preview": sessions[:1500],
    }
    await tracer.emit_done(final)
    return final
