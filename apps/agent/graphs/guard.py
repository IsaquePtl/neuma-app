"""Guard — evaluator-optimizer fail-closed fact check (Claude)."""

from __future__ import annotations

import json
import re
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from shared.llm import Workload, get_llm
from shared.voice import VOICE_BLOCK
from tools.read import get_facts


class GuardState(TypedDict):
    draft: str
    facts_blob: str
    verified: str
    rounds: int
    ok: bool


UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.I,
)
DAYS_RE = re.compile(r"~?\s*(\d+)\s*dias", re.I)
# Metrics / counts that must appear in facts if stated as hard numbers
METRIC_RE = re.compile(
    r"\b(\d+)\s*(alunos?|check-?ins?|propostas?|níveis?|percursos?)\b",
    re.I,
)
BANNED_JARGON = re.compile(
    r"\b(mensalidade|mensalidades|plano de aulas|aulas particulares)\b",
    re.I,
)


def _facts_text() -> str:
    facts = get_facts()
    if not facts:
        return "(nenhum facto de tools nesta corrida)"
    return json.dumps(facts, default=str, ensure_ascii=False)[:12000]


def generate_node(state: GuardState) -> GuardState:
    llm = get_llm(Workload.GUARD, temperature=0.1)
    sys = SystemMessage(
        content=(
            "És o redactor/verificador do copiloto Neuma. "
            "Só podes usar factos fornecidos pelas tools de leitura. "
            "Nunca inventes alunos, IDs, datas, contagens ou métricas. "
            "Se um aluno nunca fez check-in, escreve 'nunca fez check-in' — nunca uses 99. "
            f"{VOICE_BLOCK}"
        )
    )
    human = HumanMessage(
        content=(
            f"Factos verificados das tools (READ_TOOLS):\n{state['facts_blob']}\n\n"
            f"Rascunho a corrigir (se vazio, gera do zero):\n{state.get('draft') or '(vazio)'}\n\n"
            "Produz a versão final verificada em PT-PT."
        )
    )
    out = llm.invoke([sys, human])
    text = out.content if isinstance(out.content, str) else str(out.content)
    return {**state, "draft": text, "rounds": state.get("rounds", 0) + 1}


def evaluate_node(state: GuardState) -> GuardState:
    draft = state.get("draft") or ""
    facts = state.get("facts_blob") or ""
    facts_l = facts.lower()
    issues: list[str] = []

    # Any UUID in draft must appear in facts from READ_TOOLS
    for uid in UUID_RE.findall(draft):
        if uid.lower() not in facts_l:
            issues.append(f"UUID não retornado por tools/read: {uid}")

    for m in DAYS_RE.finditer(draft):
        days = int(m.group(1))
        if days == 99:
            issues.append(
                "Número 99 dias é proibido (default antigo). "
                "Usa 'nunca fez check-in' ou o valor real dos factos."
            )

    # Hard student-name heuristic: quoted names longer than 2 chars must appear in facts
    # (skip if facts empty / placeholder)
    if "nenhum facto" not in facts_l:
        for m in METRIC_RE.finditer(draft):
            num, noun = m.group(1), m.group(2).lower()
            snippet = f"{num}"
            if snippet not in facts and f'"{num}"' not in facts:
                # Allow small numbers that are structural (1-3) without strict match
                if int(num) > 3:
                    issues.append(
                        f"Métrica não confirmada nos factos: {num} {noun}"
                    )

    if BANNED_JARGON.search(draft):
        issues.append(
            "Jargão transacional proibido — usa mentoria/percurso/investimento/transformação."
        )

    if "alucin" in draft.lower() or "invent" in draft.lower():
        issues.append("Texto admite invenção — reescrever só com factos.")

    ok = len(issues) == 0
    if ok:
        return {**state, "verified": draft, "ok": True}

    correction = draft + "\n\n[CORREÇÕES OBRIGATÓRIAS]\n- " + "\n- ".join(issues)
    return {**state, "draft": correction, "ok": False, "verified": draft}


def should_continue(state: GuardState) -> str:
    if state.get("ok"):
        return "end"
    if state.get("rounds", 0) >= 2:
        return "fallback"
    return "generate"


def fallback_node(state: GuardState) -> GuardState:
    return {
        **state,
        "verified": (
            "Só factos verificados (o rascunho falhou a validação fail-closed):\n"
            + state.get("facts_blob", "")[:2000]
        ),
        "ok": True,
    }


def build_guard_graph():
    g = StateGraph(GuardState)
    g.add_node("generate", generate_node)
    g.add_node("evaluate", evaluate_node)
    g.add_node("fallback", fallback_node)
    g.add_edge(START, "generate")
    g.add_edge("generate", "evaluate")
    g.add_conditional_edges(
        "evaluate",
        should_continue,
        {"generate": "generate", "end": END, "fallback": "fallback"},
    )
    g.add_edge("fallback", END)
    return g.compile()


def run_guard(draft: str = "") -> str:
    graph = build_guard_graph()
    result = graph.invoke(
        {
            "draft": draft,
            "facts_blob": _facts_text(),
            "verified": "",
            "rounds": 0,
            "ok": False,
        }
    )
    return result.get("verified") or result.get("draft") or ""
