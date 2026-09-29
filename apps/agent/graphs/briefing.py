"""Briefing / agenda — agenda_ops + dashboard facts; telegraphic when optimizing time."""

from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage

from graphs.guard import run_guard
from shared.llm import Workload, get_llm, model_string
from shared.tracer import RunTracer
from shared.voice import TELEGRAPHIC_BLOCK, VOICE_BLOCK
from tools.ops import get_agenda_ops, get_intervention_alerts
from tools.read import get_dashboard_facts, reset_facts


def _telegraphic_from(raw: str) -> str:
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            if data.get("telegraphic"):
                return str(data["telegraphic"])
            for v in data.values():
                if isinstance(v, dict) and v.get("telegraphic"):
                    return str(v["telegraphic"])
    except Exception:
        pass
    return raw


async def run_briefing(
    tracer: RunTracer,
    mentor_name: str = "Mentor",
    message: str = "",
) -> dict:
    reset_facts()
    await tracer.emit("node", {"name": "load_agenda"})
    agenda_raw = get_agenda_ops.invoke({})
    await tracer.emit("tool", {"name": "get_agenda_ops", "preview": agenda_raw[:500]})
    alerts_raw = get_intervention_alerts.invoke({})
    await tracer.emit(
        "tool", {"name": "get_intervention_alerts", "preview": alerts_raw[:400]}
    )
    facts_raw = get_dashboard_facts.invoke({})
    await tracer.emit(
        "tool", {"name": "get_dashboard_facts", "preview": facts_raw[:400]}
    )

    agenda_t = _telegraphic_from(agenda_raw)
    alerts_t = _telegraphic_from(alerts_raw)

    # Card "Otimizar tempo" / próximos eventos → devolve telegráfico directo
    q = (message or "").lower()
    wants_ops = any(
        k in q
        for k in (
            "otimiz",
            "próximos eventos",
            "proximos eventos",
            "agenda",
            "urgente",
            "tempo",
        )
    )
    if wants_ops or not message:
        blob = "\n\n".join(
            p
            for p in (
                agenda_t,
                f"ALERTAS:\n{alerts_t}" if alerts_t else "",
            )
            if p
        )
        # Light Haiku polish only if mentor asked for narrative briefing
        if message and "briefing" in q:
            await tracer.emit(
                "node",
                {"name": "briefing_rewrite", "model": model_string(Workload.BRIEFING)},
            )
            llm = get_llm(Workload.BRIEFING, temperature=0.1)
            draft_msg = llm.invoke(
                [
                    SystemMessage(
                        content=(
                            f"Briefing diário de {mentor_name}. "
                            f"{VOICE_BLOCK} {TELEGRAPHIC_BLOCK} "
                            "Secções: SESSÕES / PRAZOS / CONTEÚDO / ALERTAS."
                        )
                    ),
                    HumanMessage(
                        content=(
                            f"Pedido: {message}\n\n{blob}\n\n"
                            f"Dashboard:\n{facts_raw[:3000]}"
                        )
                    ),
                ]
            )
            draft = (
                draft_msg.content
                if isinstance(draft_msg.content, str)
                else str(draft_msg.content)
            )
            briefing = run_guard(draft=draft) if not draft.startswith("SESS") else draft
        else:
            await tracer.emit("node", {"name": "briefing_telegraphic"})
            briefing = blob

        final = {
            "briefing": briefing,
            "answer": briefing,
            "facts_tool_output": facts_raw[:4000],
            "agenda_preview": agenda_t[:2000],
            "alerts_preview": alerts_t[:1500],
            "model": model_string(Workload.BRIEFING),
        }
        await tracer.emit_done(final)
        return final

    await tracer.emit(
        "node", {"name": "briefing_rewrite", "model": model_string(Workload.BRIEFING)}
    )
    llm = get_llm(Workload.BRIEFING, temperature=0.2)
    draft_msg = llm.invoke(
        [
            SystemMessage(
                content=(
                    f"Briefing do mentor {mentor_name}. Só dados fornecidos. "
                    f"{VOICE_BLOCK} {TELEGRAPHIC_BLOCK}"
                )
            ),
            HumanMessage(
                content=(
                    f"Pedido: {message}\n\n"
                    f"Agenda:\n{agenda_t}\n\n"
                    f"Alertas:\n{alerts_t}\n\n"
                    f"Dashboard:\n{facts_raw[:4000]}"
                )
            ),
        ]
    )
    draft = (
        draft_msg.content
        if isinstance(draft_msg.content, str)
        else str(draft_msg.content)
    )
    await tracer.emit("node", {"name": "guard"})
    briefing = run_guard(draft=draft)
    final = {
        "briefing": briefing,
        "answer": briefing,
        "facts_tool_output": facts_raw[:4000],
        "agenda_preview": agenda_t[:2000],
        "alerts_preview": alerts_t[:1500],
        "model": model_string(Workload.BRIEFING),
    }
    await tracer.emit_done(final)
    return final
