"""Supervisor + subagents pattern (faithful to multi-agent-travel_planner)."""

from __future__ import annotations

from langchain.agents import create_agent
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver

from shared.llm import get_llm, model_string
from shared.tracer import RunTracer
from skills.loader import list_skill_descriptions, load_skill
from tools.propose import PROPOSE_TOOLS, set_propose_context
from tools.read import READ_TOOLS, reset_facts
from tools.write import WRITE_TOOLS
from graphs.guard import run_guard


def _make_specialist(name: str, system: str, tools: list):
    agent = create_agent(get_llm(), tools=tools, system_prompt=system)

    @tool(name)
    def specialist(request: str) -> str:
        """Specialist subagent."""
        result = agent.invoke({"messages": [{"role": "user", "content": request}]})
        messages = result.get("messages") or []
        if not messages:
            return ""
        last = messages[-1]
        content = getattr(last, "content", None) or str(last)
        return content if isinstance(content, str) else str(content)

    specialist.__doc__ = f"Especialista {name}: {system[:120]}"
    return specialist


def build_supervisor(use_memory: bool = True):
    students = _make_specialist(
        "students_specialist",
        "Especialista em alunos Neuma. Usa tools de leitura de alunos/progresso. Nunca inventes IDs.",
        [t for t in READ_TOOLS if t.name in ("list_students", "get_student_360", "get_progress_snapshot", "get_student_brief")],
    )
    journey = _make_specialist(
        "journey_specialist",
        "Especialista em percursos. Lê paths/nodes e propõe drafts via propose_path_draft / propose_path_edit.",
        [t for t in READ_TOOLS if t.name in ("list_paths", "get_path", "get_student_brief")]
        + [t for t in PROPOSE_TOOLS if t.name in ("propose_path_draft", "propose_path_edit", "propose_student_brief")],
    )
    library = _make_specialist(
        "library_specialist",
        "Especialista Biblioteca. Cria categorias/tópicos/assets vazios. load_skill('regras-biblioteca') se preciso.",
        [t for t in READ_TOOLS if t.name in ("get_library_tree", "search_library")]
        + WRITE_TOOLS[:3]
        + [load_skill],
    )
    calendar = _make_specialist(
        "calendar_specialist",
        "Especialista calendário/calls. Propõe eventos; inclui nível activo nas prep de call.",
        [t for t in READ_TOOLS if t.name in ("list_upcoming_sessions", "get_calendar_window")]
        + [t for t in PROPOSE_TOOLS if t.name == "propose_calendar_event"],
    )
    checkins = _make_specialist(
        "checkins_specialist",
        "Especialista check-ins. Lista pendentes e propõe nudges (mentor confirma).",
        [t for t in READ_TOOLS if t.name in ("list_pending_checkins", "get_checkin", "get_dashboard_facts")]
        + [t for t in PROPOSE_TOOLS if t.name == "propose_checkin_nudge"],
    )

    system = (
        "És o AI Agent parceiro de negócio do mentor Neuma. "
        "Delegas a especialistas via tools. "
        f"{list_skill_descriptions()}\n"
        "Podes load_skill. Nunca publiques percursos nem envies emails — só propostas. "
        "Responde em PT-PT. Nunca inventes factos."
    )

    return create_agent(
        get_llm(),
        tools=[students, journey, library, calendar, checkins, load_skill],
        system_prompt=system,
        checkpointer=InMemorySaver() if use_memory else None,
    )


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
    supervisor = build_supervisor(use_memory=True)
    prompt = message
    if page_context:
        prompt = f"[Contexto da página actual]\n{page_context}\n\n[Pedido do mentor]\n{message}"

    await tracer.emit("node", {"name": "supervisor", "model": model_string()})
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
        text = getattr(last, "content", None) or ""
        return text if isinstance(text, str) else str(text)

    final_text = await asyncio.get_event_loop().run_in_executor(None, invoke)
    await tracer.emit("update", {"type": "final", "preview": final_text[:500]})
    verified = run_guard(draft=final_text)
    result = {"answer": verified, "raw": final_text, "model": model_string()}
    await tracer.emit_done(result)
    return result
