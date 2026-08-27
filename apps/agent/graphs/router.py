"""Router pattern — Send fan-out (faithful to mas-home-builders-assistant)."""

from __future__ import annotations

import operator
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from pydantic import BaseModel, Field

from shared.llm import get_llm
from shared.tracer import RunTracer
from tools.read import (
    get_library_tree,
    get_progress_snapshot,
    list_pending_checkins,
    list_upcoming_sessions,
    reset_facts,
)
from graphs.guard import run_guard


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
    llm = get_llm(temperature=0).with_structured_output(ClassificationResult)
    result = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Classifica a pergunta do mentor Neuma para 1+ fontes: "
                    "students, checkins, calendar, library. "
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
        or [{"source": "students", "query": state["query"]}]
    }


def route_to_agents(state: RouterState) -> list[Send]:
    return [
        Send(c["source"], {"query": c["query"]}) for c in state["classifications"]
    ]


def _specialist(name: str, tool_fn):
    def node(state: dict) -> dict:
        raw = tool_fn.invoke({})
        llm = get_llm(temperature=0.1)
        summary = llm.invoke(
            [
                SystemMessage(content=f"Resume para o mentor (fonte={name}). Só factos do JSON."),
                HumanMessage(content=f"Pergunta: {state.get('query')}\n\nDados:\n{raw[:8000]}"),
            ]
        )
        text = summary.content if isinstance(summary.content, str) else str(summary.content)
        return {"results": [{"source": name, "result": text}]}

    return node


def synthesize_results(state: RouterState) -> dict:
    blob = "\n\n".join(f"[{r['source']}]\n{r['result']}" for r in state.get("results") or [])
    answer = run_guard(draft=f"Sintetiza a resposta ao mentor.\nPergunta: {state['query']}\n\n{blob}")
    return {"final_answer": answer}


def build_router_graph():
    g = StateGraph(RouterState)
    g.add_node("classify", classify_query)
    g.add_node("students", _specialist("students", get_progress_snapshot))
    g.add_node("checkins", _specialist("checkins", list_pending_checkins))
    g.add_node("calendar", _specialist("calendar", list_upcoming_sessions))
    g.add_node("library", _specialist("library", get_library_tree))
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
    for update in graph.stream({"query": query, "classifications": [], "results": [], "final_answer": ""}, stream_mode="updates"):
        for node_name, payload in update.items():
            await tracer.emit("node", {"name": node_name, "keys": list(payload.keys())})
            if "final_answer" in payload:
                final = payload["final_answer"]
    result = {"answer": final or ""}
    await tracer.emit_done(result)
    return result
