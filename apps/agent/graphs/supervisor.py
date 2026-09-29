"""Supervisor + subagents — Gemini flash brain; Claude journey specialist."""

from __future__ import annotations

from langchain.agents import create_agent
from langchain_core.tools import tool

from contexts.loader import list_context_descriptions, load_student_context
from graphs.guard import run_guard
from shared.checkpointer import get_checkpointer
from shared.llm import Workload, get_llm, model_string
from shared.tracer import RunTracer
from shared.truncation import make_truncation_middleware
from shared.voice import HITL_BLOCK, TELEGRAPHIC_BLOCK, VOICE_BLOCK
from skills.loader import list_skill_descriptions, load_skill
from tools.ops import get_agenda_ops, get_intervention_alerts, get_student_xray
from tools.propose import PROPOSE_TOOLS, set_propose_context
from tools.read import READ_TOOLS, reset_facts
from tools.write import WRITE_TOOLS


def _message_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text") or "")
            elif isinstance(block, str):
                parts.append(block)
            else:
                text = getattr(block, "text", None)
                if text:
                    parts.append(str(text))
        return "\n".join(p for p in parts if p).strip() or str(content)
    return str(content)


def _make_specialist(name: str, system: str, tools: list, workload: Workload):
    agent = create_agent(
        get_llm(workload),
        tools=tools,
        system_prompt=f"{system}\n{VOICE_BLOCK}\n{HITL_BLOCK}\n{TELEGRAPHIC_BLOCK}",
    )

    @tool(name)
    def specialist(request: str) -> str:
        """Specialist subagent."""
        result = agent.invoke({"messages": [{"role": "user", "content": request}]})
        messages = result.get("messages") or []
        if not messages:
            return ""
        last = messages[-1]
        return _message_text(getattr(last, "content", None) or "")

    specialist.__doc__ = f"Especialista {name}: {system[:160]}"
    return specialist


def build_supervisor(*, mentor_id: str, thread_id: str, use_memory: bool = True):
    students = _make_specialist(
        "students_specialist",
        (
            "Especialista em alunos. Para «diz-me tudo sobre X» chama get_student_xray. "
            "Também list_students / get_student_360. Nunca inventes IDs."
        ),
        [
            t
            for t in READ_TOOLS
            if t.name
            in (
                "list_students",
                "get_student_360",
                "get_progress_snapshot",
                "get_student_brief",
            )
        ]
        + [get_student_xray],
        Workload.SPECIALIST_FAST,
    )

    journey_system = (
        "Especialista em percursos e raio-X. "
        "Raio-X: get_student_xray + get_progress_snapshot — resposta telegráfica. "
        "Criação: se student_id/UUID estiver no pedido ou contexto da página, "
        "usa get_student_brief(student_id=…) + get_student_360(student_id=…) "
        "— NÃO peças a ROTA nem faças list_students/pesquisa por nome. "
        "propose_path_draft cria o percurso status=draft no app (~3–4 meses em "
        "semanas Mon–Sex; cada nível duration_weeks ≥ 1) com o mesmo student_id; "
        "níveis PODEM ficar sem conteúdo. Depois confirma em 1–2 linhas "
        "(título + nº níveis + semanas) SEM dumps JSON. O mentor edita e activa. "
        f"{list_context_descriptions()} "
        "Se Eduardo/Márcio/Bernardo → load_student_context."
    )
    journey = _make_specialist(
        "journey_specialist",
        journey_system,
        [
            t
            for t in READ_TOOLS
            if t.name
            in (
                "list_paths",
                "get_path",
                "get_student_brief",
                "get_student_360",
                "get_progress_snapshot",
                "list_tally_submissions",
            )
        ]
        + [
            t
            for t in PROPOSE_TOOLS
            if t.name
            in ("propose_path_draft", "propose_path_edit", "propose_student_brief")
        ]
        + [get_student_xray, load_student_context, load_skill],
        Workload.JOURNEY,
    )

    library = _make_specialist(
        "library_specialist",
        "Especialista Biblioteca. Cascas vazias + regras-biblioteca. Sem inventar assets ready.",
        [t for t in READ_TOOLS if t.name in ("get_library_tree", "search_library")]
        + WRITE_TOOLS[:3]
        + [load_skill],
        Workload.SPECIALIST_FAST,
    )

    calendar = _make_specialist(
        "calendar_specialist",
        (
            "Especialista agenda/tempo. Para otimizar tempo ou próximos eventos: "
            "chama get_agenda_ops (obrigatório) e devolve o campo telegraphic. "
            "Cruza sessões Cal.com, prazos de níveis e alertas de conteúdo."
        ),
        [
            t
            for t in READ_TOOLS
            if t.name in ("list_upcoming_sessions", "get_calendar_window")
        ]
        + [get_agenda_ops]
        + [t for t in PROPOSE_TOOLS if t.name == "propose_calendar_event"],
        Workload.SPECIALIST_FAST,
    )

    checkins = _make_specialist(
        "checkins_specialist",
        (
            "Especialista acompanhamento/tracking. "
            "Para estado global ou quem precisa de mim: chama get_intervention_alerts "
            "e devolve APENAS as lines/telegraphic "
            "(dead_end | feedback_pending | stagnating | expired). "
            "Sem prosa."
        ),
        [
            t
            for t in READ_TOOLS
            if t.name
            in ("list_pending_checkins", "get_checkin", "get_dashboard_facts")
        ]
        + [get_intervention_alerts]
        + [t for t in PROPOSE_TOOLS if t.name == "propose_checkin_nudge"],
        Workload.SPECIALIST_FAST,
    )

    system = (
        "És o AI Agent parceiro de negócio do mentor Neuma. "
        "Delegas a especialistas via tools.\n"
        "- Acompanhamento / Tracking / alertas → checkins_specialist "
        "(get_intervention_alerts)\n"
        "- Otimizar tempo / agenda / próximos eventos → calendar_specialist "
        "(get_agenda_ops)\n"
        "- Raio-X «tudo sobre X» → journey_specialist ou students_specialist "
        "(get_student_xray)\n"
        "- Criar percurso / onboarding → journey_specialist\n"
        "- Biblioteca → library_specialist\n"
        f"{list_skill_descriptions()}\n"
        f"{list_context_descriptions()}\n"
        "Podes load_skill. "
        f"{HITL_BLOCK} {VOICE_BLOCK} {TELEGRAPHIC_BLOCK}"
    )

    middleware = [make_truncation_middleware(mentor_id=mentor_id, thread_id=thread_id)]

    return create_agent(
        get_llm(Workload.SUPERVISOR),
        tools=[students, journey, library, calendar, checkins, load_skill],
        system_prompt=system,
        checkpointer=get_checkpointer(use_memory=use_memory),
        middleware=middleware,
    )


def _looks_telegraphic(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return False
    if t.startswith("{") or t.startswith("["):
        return False
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    if not lines:
        return False
    # Most lines look like "Name — fact" or section headers
    scored = 0
    for ln in lines:
        if "—" in ln or ln.endswith(":") or ln.startswith("-"):
            scored += 1
    return scored >= max(1, len(lines) // 2)


async def run_supervisor(
    message: str,
    *,
    thread_id: str,
    mentor_id: str,
    tracer: RunTracer,
    page_context: str = "",
) -> dict:
    import asyncio

    reset_facts()
    set_propose_context(mentor_id=mentor_id, thread_id=thread_id)
    supervisor = build_supervisor(
        mentor_id=mentor_id, thread_id=thread_id, use_memory=True
    )
    prompt = message
    if page_context:
        prompt = (
            f"[Contexto da página actual]\n{page_context}\n\n"
            f"[Pedido do mentor]\n{message}"
        )

    model = model_string(Workload.SUPERVISOR)
    await tracer.emit("node", {"name": "supervisor", "model": model})
    config = {"configurable": {"thread_id": thread_id}}

    def invoke():
        result = supervisor.invoke(
            {"messages": [{"role": "user", "content": prompt}]},
            config=config,
        )
        messages = result.get("messages") or []
        if not messages:
            return ""
        last = messages[-1]
        return _message_text(getattr(last, "content", None) or "")

    final_text = await asyncio.get_event_loop().run_in_executor(None, invoke)
    await tracer.emit("update", {"type": "final", "preview": final_text[:500]})

    # Skip expensive Sonnet Guard when output is already telegraphic facts from tools
    if _looks_telegraphic(final_text):
        verified = final_text
        await tracer.emit("node", {"name": "guard_skip", "reason": "telegraphic"})
    else:
        verified = run_guard(draft=final_text)

    result = {"answer": verified, "raw": final_text, "model": model}
    await tracer.emit_done(result)
    return result
