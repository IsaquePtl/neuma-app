"""Proposal tools — agent never publishes paths or sends emails; only proposes."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool

from shared.db import get_supabase
from tools.read import _record

# Set per-request by the runner
_CONTEXT: dict[str, Any] = {}


def set_propose_context(*, mentor_id: str, thread_id: str | None = None, run_id: str | None = None) -> None:
    _CONTEXT.clear()
    _CONTEXT.update(mentor_id=mentor_id, thread_id=thread_id, run_id=run_id)


def _insert_proposal(
    kind: str,
    title: str,
    summary: str,
    payload: dict[str, Any],
    target_table: str | None = None,
    target_id: str | None = None,
) -> str:
    mentor_id = _CONTEXT.get("mentor_id")
    if not mentor_id:
        return _record("proposal_error", {"error": "mentor_id missing in propose context"})
    sb = get_supabase()
    row = {
        "kind": kind,
        "status": "pending",
        "title": title,
        "summary": summary,
        "payload": payload,
        "target_table": target_table,
        "target_id": target_id,
        "thread_id": _CONTEXT.get("thread_id"),
        "run_id": _CONTEXT.get("run_id"),
        "mentor_id": mentor_id,
    }
    res = sb.table("agent_proposals").insert(row).execute()
    return _record("proposal", res.data)


@tool
def propose_path_draft(
    title: str,
    placeholder_name: str,
    goal: str,
    description: str,
    nodes_json: str,
    claim_email: str = "",
    brief_id: str = "",
    student_id: str = "",
    period_months: int = 3,
) -> str:
    """
    Cria um percurso em rascunho HITL (status=draft; mentor activa depois).
    Duração em meses (default 3) → semanas Mon–Fri a partir da próxima segunda.
    Cada nível: duration_weeks (mín. 1). Se omitido, distribui pelas semanas do período.
    nodes_json: [{title, description, kind, order_index, duration_weeks?, week_number?}].
    kind: lesson|practice|call|milestone.
    Passa student_id (UUID) quando o aluno já está seleccionado na UI.
    """
    from shared.path_draft import insert_draft_path

    try:
        nodes = json.loads(nodes_json)
        if not isinstance(nodes, list):
            raise ValueError("nodes_json must be a JSON array")
    except Exception as e:
        return _record("proposal_error", {"error": f"invalid nodes_json: {e}"})

    mentor_id = _CONTEXT.get("mentor_id")
    if not mentor_id:
        return _record("proposal_error", {"error": "mentor_id missing in propose context"})

    months = period_months if isinstance(period_months, int) and period_months >= 1 else 3
    result = insert_draft_path(
        mentor_id=mentor_id,
        title=title,
        nodes=nodes,
        placeholder_name=placeholder_name,
        claim_email=claim_email or "",
        goal=goal,
        description=description,
        student_id=(student_id or "").strip() or None,
        brief_id=(brief_id or "").strip() or None,
        thread_id=_CONTEXT.get("thread_id"),
        run_id=_CONTEXT.get("run_id"),
        period_months=months,
    )
    if result.get("error"):
        return _record("proposal_error", result)
    return _record("path_draft_created", result)


@tool
def propose_path_edit(path_id: str, summary: str, changes_json: str) -> str:
    """Propõe edições a um percurso existente. path_id = UUID de list_paths. changes_json descreve as alterações."""
    import re

    if not re.match(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        (path_id or "").strip(),
        re.I,
    ):
        return _record(
            "proposal_error",
            {
                "error": (
                    f"path_id tem de ser UUID de list_paths — recebido: {path_id!r}. "
                    "Nunca uses 'all' ou status como id."
                )
            },
        )
    try:
        changes = json.loads(changes_json)
    except Exception as e:
        return _record("proposal_error", {"error": str(e)})
    return _insert_proposal(
        kind="path_edit",
        title=f"Editar percurso {path_id[:8]}…",
        summary=summary,
        payload={"path_id": path_id, "changes": changes},
        target_table="paths",
        target_id=path_id,
    )


@tool
def apply_draft_path_edit(path_id: str, summary: str, changes_json: str) -> str:
    """
    Aplica alterações a um percurso em status=draft (edição directa HITL).
    changes_json: {title?, goal?, description?, update_nodes?: [...], replace_nodes?: [...]}.
    Preferir update_nodes com order_index para mudanças pontuais.
    """
    from shared.path_draft import apply_draft_path_changes

    try:
        changes = json.loads(changes_json)
        if not isinstance(changes, dict):
            raise ValueError("changes_json must be a JSON object")
    except Exception as e:
        return _record("proposal_error", {"error": f"invalid changes_json: {e}"})

    result = apply_draft_path_changes(path_id=path_id, changes=changes)
    if result.get("error"):
        return _record("path_draft_edit_error", result)
    result["summary"] = summary
    return _record("path_draft_updated", result)


@tool
def propose_calendar_event(
    title: str,
    starts_at: str,
    kind: str = "meeting",
    notes: str = "",
    student_id: str = "",
    path_id: str = "",
    node_id: str = "",
    ends_at: str = "",
) -> str:
    """Propõe um evento de calendário (não cria directamente)."""
    payload = {
        "title": title,
        "kind": kind if kind in ("reminder", "meeting", "event", "misc") else "meeting",
        "starts_at": starts_at,
        "ends_at": ends_at or None,
        "notes": notes or None,
        "student_id": student_id or None,
        "path_id": path_id or None,
        "node_id": node_id or None,
        "source": "agent",
    }
    return _insert_proposal(
        kind="calendar_event",
        title=f"Calendário: {title}",
        summary=starts_at,
        payload=payload,
        target_table="mentor_calendar_events",
    )


@tool
def propose_checkin_nudge(student_ids_json: str, message: str = "") -> str:
    """Propõe enviar lembretes de check-in (mentor confirma antes do envio)."""
    try:
        ids = json.loads(student_ids_json)
        if not isinstance(ids, list):
            raise ValueError("expected JSON array of student ids")
    except Exception as e:
        return _record("proposal_error", {"error": str(e)})
    return _insert_proposal(
        kind="checkin_nudge",
        title=f"Lembrete check-in · {len(ids)} aluno(s)",
        summary=message or "Enviar lembrete de check-in",
        payload={"student_ids": ids, "message": message},
        target_table="profiles",
    )


@tool
def propose_student_brief(
    raw_markdown: str,
    placeholder_name: str = "",
    student_id: str = "",
    structured_json: str = "{}",
) -> str:
    """Propõe guardar/actualizar um brief de transformação do aluno."""
    try:
        structured = json.loads(structured_json) if structured_json else {}
    except Exception:
        structured = {}
    payload = {
        "raw_markdown": raw_markdown,
        "placeholder_name": placeholder_name or None,
        "student_id": student_id or None,
        "structured": structured,
        "source": "agent",
    }
    return _insert_proposal(
        kind="student_brief",
        title=f"Brief: {placeholder_name or student_id or 'aluno'}",
        summary="Notas de transformação propostas",
        payload=payload,
        target_table="student_briefs",
        target_id=student_id or None,
    )


PROPOSE_TOOLS = [
    propose_path_draft,
    propose_path_edit,
    apply_draft_path_edit,
    propose_calendar_event,
    propose_checkin_nudge,
    propose_student_brief,
]
