"""Router — classify + fan-out; telegraphic synthesis for tracking cards."""

from __future__ import annotations

import json
import operator
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from pydantic import BaseModel, Field

from graphs.guard import run_guard
from shared.llm import Workload, get_llm, model_string
from shared.tracer import RunTracer
from shared.voice import TELEGRAPHIC_BLOCK, VOICE_BLOCK
from tools.ops import get_agenda_ops, get_intervention_alerts, get_student_xray
from tools.read import get_library_tree, reset_facts


class Classification(BaseModel):
    source: Literal["students", "checkins", "calendar", "library"]
    query: str


class ClassificationResult(BaseModel):
    classifications: list[Classification] = Field(default_factory=list)


class RouterState(TypedDict):
    query: str
    classifications: list[dict]
    results: Annotated[list[dict], operator.add]
    final_answer: str


def classify_query(state: RouterState) -> dict:
    llm = get_llm(Workload.ROUTER, temperature=0).with_structured_output(
        ClassificationResult
    )
    result = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Classifica a pergunta do mentor Neuma para 1+ fontes:\n"
                    "- checkins: acompanhamento, tracking, alertas, quem precisa de mim "
                    "(dead end, feedback, estagnação, expirou)\n"
                    "- calendar: agenda, sessões, prazos, otimizar tempo\n"
                    "- students: raio-X / estado de um aluno concreto\n"
                    "- library: biblioteca de conteúdos\n"
                    "Devolve query curta por fonte."
                )
            ),
            HumanMessage(content=state["query"]),
        ]
    )
    return {
        "classifications": [
            {"source": c.source, "query": c.query} for c in result.classifications
        ]
        or [{"source": "checkins", "query": state["query"]}]
    }


def route_to_agents(state: RouterState) -> list[Send]:
    return [Send(c["source"], {"query": c["query"]}) for c in state["classifications"]]


def _extract_telegraphic(raw: str) -> str:
    """Prefer tool telegraphic/lines over raw JSON wrapper."""
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            # _record wraps as {name: payload} or similar — find telegraphic
            if "telegraphic" in data:
                return str(data["telegraphic"])
            for v in data.values():
                if isinstance(v, dict) and v.get("telegraphic"):
                    return str(v["telegraphic"])
                if isinstance(v, dict) and v.get("lines"):
                    return "\n".join(str(x) for x in v["lines"])
    except Exception:
        pass
    return raw


def _checkins_node(state: dict) -> dict:
    raw = get_intervention_alerts.invoke({})
    return {
        "results": [
            {
                "source": "checkins",
                "result": _extract_telegraphic(raw),
                "raw": raw[:2000],
            }
        ]
    }


def _calendar_node(state: dict) -> dict:
    raw = get_agenda_ops.invoke({})
    return {
        "results": [
            {
                "source": "calendar",
                "result": _extract_telegraphic(raw),
                "raw": raw[:2000],
            }
        ]
    }


def _students_node(state: dict) -> dict:
    q = state.get("query") or ""
    raw = get_student_xray.invoke({"query": q})
    return {
        "results": [
            {
                "source": "students",
                "result": _extract_telegraphic(raw),
                "raw": raw[:2000],
            }
        ]
    }


def _library_node(state: dict) -> dict:
    raw = get_library_tree.invoke({})
    llm = get_llm(Workload.ROUTER, temperature=0.1)
    summary = llm.invoke(
        [
            SystemMessage(
                content=(
                    f"Resume biblioteca em bullets telegráficos. Só factos. "
                    f"{VOICE_BLOCK} {TELEGRAPHIC_BLOCK}"
                )
            ),
            HumanMessage(
                content=f"Pergunta: {state.get('query')}\n\nDados:\n{raw[:6000]}"
            ),
        ]
    )
    text = (
        summary.content if isinstance(summary.content, str) else str(summary.content)
    )
    return {"results": [{"source": "library", "result": text, "raw": raw[:1500]}]}


def synthesize_results(state: RouterState) -> dict:
    parts = []
    for r in state.get("results") or []:
        body = (r.get("result") or "").strip()
        if body:
            parts.append(body)
    blob = "\n\n".join(parts)
    # Skip Guard when we already have tool telegraphic output
    if blob and not blob.lstrip().startswith("{"):
        return {"final_answer": blob}
    answer = run_guard(
        draft=(
            f"Sintetiza em bullets telegráficos para o mentor.\n"
            f"Pergunta: {state['query']}\n\n{blob}\n\n{TELEGRAPHIC_BLOCK}"
        )
    )
    return {"final_answer": answer}


def build_router_graph():
    g = StateGraph(RouterState)
    g.add_node("classify", classify_query)
    g.add_node("students", _students_node)
    g.add_node("checkins", _checkins_node)
    g.add_node("calendar", _calendar_node)
    g.add_node("library", _library_node)
    g.add_node("synthesize", synthesize_results)
    g.add_edge(START, "classify")
    g.add_conditional_edges(
        "classify",
        route_to_agents,
        ["students", "checkins", "calendar", "library"],
    )
    g.add_edge("students", "synthesize")
    g.add_edge("checkins", "synthesize")
    g.add_edge("calendar", "synthesize")
    g.add_edge("library", "synthesize")
    g.add_edge("synthesize", END)
    return g.compile()


async def run_router(query: str, tracer: RunTracer) -> dict:
    reset_facts()
    graph = build_router_graph()
    await tracer.emit("node", {"name": "router_start"})
    final = None
    for update in graph.stream(
        {"query": query, "classifications": [], "results": [], "final_answer": ""},
        stream_mode="updates",
    ):
        for node_name, payload in update.items():
            await tracer.emit("node", {"name": node_name, "keys": list(payload.keys())})
            if "final_answer" in payload:
                final = payload["final_answer"]
    model = model_string(Workload.ROUTER)
    result = {"answer": final or "", "model": model}
    await tracer.emit_done(result)
    return result
