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
) -> str:
    """
    Propõe um percurso em rascunho (não publica).
    nodes_json: JSON array de {title, description, kind, order_index, week_number?}.
    kind: lesson|practice|call|milestone.
    """
    try:
        nodes = json.loads(nodes_json)
        if not isinstance(nodes, list):
            raise ValueError("nodes_json must be a JSON array")
    except Exception as e:
        return _record("proposal_error", {"error": f"invalid nodes_json: {e}"})

    payload = {
        "title": title,
        "placeholder_name": placeholder_name,
        "claim_email": claim_email or None,
        "goal": goal,
        "description": description,
        "status": "draft",
        "student_id": None,
        "brief_id": brief_id or None,
        "nodes": nodes,
    }
    return _insert_proposal(
        kind="path_draft",
        title=f"Percurso: {title}",
        summary=f"{len(nodes)} níveis · {placeholder_name}",
        payload=payload,
        target_table="paths",
    )


@tool
def propose_path_edit(path_id: str, summary: str, changes_json: str) -> str:
    """Propõe edições a um percurso existente. changes_json descreve as alterações."""
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
    propose_calendar_event,
    propose_checkin_nudge,
    propose_student_brief,
]
