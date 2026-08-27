"""Journey handoffs pipeline — faithful to mas-course-job-interview-pipeline."""

from __future__ import annotations

from typing import Literal

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import before_model, wrap_model_call
from langchain.messages import ToolMessage
from langchain.tools import ToolRuntime, tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from shared.llm import get_llm, model_string
from shared.tracer import RunTracer
from skills.loader import load_skill
from tools.propose import propose_path_draft, set_propose_context
from tools.read import get_student_brief, reset_facts
from graphs.guard import run_guard

JourneyStep = Literal["intake", "brief", "draft", "review", "complete"]


class JourneyState(AgentState):
    current_step: JourneyStep = "intake"
    placeholder_name: str = ""
    claim_email: str = ""
    brief_markdown: str = ""
    brief_id: str = ""
    draft_summary: str = ""
    proposal_id: str = ""


@tool
def ingest_brief(
    placeholder_name: str,
    brief_markdown: str,
    claim_email: str = "",
    brief_id: str = "",
    runtime: ToolRuntime = None,
) -> Command:
    """Regista o brief do aluno e avança para a fase de análise do perfil."""
    return Command(
        update={
            "placeholder_name": placeholder_name,
            "brief_markdown": brief_markdown,
            "claim_email": claim_email,
            "brief_id": brief_id,
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
                    "Perfil confirmado. Agora monta os 12 níveis e chama propose_path_draft.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def mark_draft_ready(
    proposal_note: str,
    runtime: ToolRuntime = None,
) -> Command:
    """Marca o draft como pronto para review do mentor (após propose_path_draft)."""
    return Command(
        update={
            "draft_summary": proposal_note,
            "current_step": "review",
            "messages": [
                ToolMessage(
                    "Draft proposto. Resume para o mentor e conclui.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def complete_journey(runtime: ToolRuntime = None) -> Command:
    """Fecha o pipeline — o mentor aprova na Inbox."""
    return Command(
        update={
            "current_step": "complete",
            "messages": [
                ToolMessage(
                    "Pipeline completo. Proposta na Inbox do mentor.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


STEP_CONFIG = {
    "intake": {
        "prompt": (
            "És o intake da Neuma. O mentor vai colar uma ROTA DE TRANSFORMAÇÃO. "
            "Usa load_skill('formato-rota') se precisares. "
            "Chama ingest_brief com placeholder_name e brief_markdown completo."
        ),
        "tools": [ingest_brief, load_skill, get_student_brief],
    },
    "brief": {
        "prompt": (
            "Analisa o brief de {placeholder_name}. Extrai histórico, ponto de partida, objectivos e fases. "
            "Chama confirm_profile_analysis com um sumário estruturado."
        ),
        "tools": [confirm_profile_analysis, load_skill],
    },
    "draft": {
        "prompt": (
            "Monta o percurso de {placeholder_name} com ~12 níveis (lesson/practice/call/milestone). "
            "Chama propose_path_draft com nodes_json (JSON array). "
            "Depois chama mark_draft_ready."
        ),
        "tools": [propose_path_draft, mark_draft_ready, load_skill],
    },
    "review": {
        "prompt": (
            "Resume a proposta ao mentor: título, número de níveis, próximos passos (aprovar na Inbox). "
            "Chama complete_journey."
        ),
        "tools": [complete_journey],
    },
    "complete": {
        "prompt": "Pipeline concluído. Confirma que a proposta está na Inbox.",
        "tools": [],
    },
}


@wrap_model_call
def apply_step_config(request, handler):
    step = request.state.get("current_step") or "intake"
    cfg = STEP_CONFIG[step]
    prompt = cfg["prompt"].format(
        placeholder_name=request.state.get("placeholder_name") or "o aluno"
    )
    return handler(request.override(system_prompt=prompt, tools=cfg["tools"]))


@before_model(can_jump_to=["end"])
def end_turn_after_handoff(state, runtime):
    messages = state.get("messages") or []
    # If last human turn already executed a handoff tool, end turn so UI can show progress
    for m in reversed(messages[-6:]):
        name = getattr(m, "name", None)
        if name in (
            "ingest_brief",
            "confirm_profile_analysis",
            "mark_draft_ready",
            "complete_journey",
        ):
            # Only jump if this is the latest tool result in the turn
            if messages and messages[-1] is m:
                return {"jump_to": "end"}
            break
    return None


def build_journey_pipeline(use_memory: bool = True):
    return create_agent(
        get_llm(),
        tools=STEP_CONFIG["intake"]["tools"],
        middleware=[apply_step_config, end_turn_after_handoff],
        state_schema=JourneyState,
        checkpointer=InMemorySaver() if use_memory else None,
    )


async def run_journey(
    message: str,
    *,
    thread_id: str,
    mentor_id: str,
    tracer: RunTracer,
) -> dict:
    reset_facts()
    set_propose_context(mentor_id=mentor_id, thread_id=thread_id)
    pipeline = build_journey_pipeline(True)
    await tracer.emit("node", {"name": "journey", "model": model_string()})

    import asyncio

    def invoke():
        return pipeline.invoke(
            {"messages": [{"role": "user", "content": message}]},
            config={"configurable": {"thread_id": thread_id}},
        )

    result = await asyncio.get_event_loop().run_in_executor(None, invoke)
    messages = result.get("messages") or []
    last = messages[-1] if messages else None
    text = getattr(last, "content", "") if last else ""
    if not isinstance(text, str):
        text = str(text)
    verified = run_guard(draft=text)
    final = {
        "answer": verified,
        "current_step": result.get("current_step"),
        "placeholder_name": result.get("placeholder_name"),
        "model": model_string(),
    }
    await tracer.emit_done(final)
    return final
