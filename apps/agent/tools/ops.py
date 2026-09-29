"""Operational read tools — intervention alerts, agenda cross-cut, student x-ray facts."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from langchain_core.tools import tool

from shared.db import get_supabase
from tools.read import _is_uuid, _record


def _student_label(student: Any, placeholder: str | None = None) -> str:
    if isinstance(student, list):
        student = student[0] if student else {}
    student = student or {}
    return (
        student.get("full_name")
        or placeholder
        or student.get("email")
        or "Aluno"
    )


def _node_has_content(node: dict[str, Any]) -> bool:
    """Lesson/practice need body or resource; call/milestone OK without library media."""
    kind = (node.get("kind") or "").lower()
    if kind in ("call", "milestone"):
        return True
    body = (node.get("content_body") or "").strip()
    url = (node.get("resource_url") or "").strip()
    return bool(body or url)


@tool
def get_intervention_alerts() -> str:
    """
    Quatro cenários críticos de intervenção (só factos da BD):
    - dead_end: nível activo, próximo nível sem conteúdo
    - feedback_pending: check-in pending >24h
    - stagnating: falta 1 dia para due_date do nível activo
    - expired: due_date passou sem check-in / nível não concluído
    Devolve lista telegráfica pronta a mostrar.
    """
    sb = get_supabase()
    now = datetime.now(timezone.utc)
    today = now.date()
    tomorrow = today + timedelta(days=1)
    cutoff_24h = (now - timedelta(hours=24)).isoformat()

    alerts: list[dict[str, Any]] = []

    # --- Feedback pendente >24h ---
    pending = (
        sb.table("check_ins")
        .select(
            "id, created_at, student_id, node_id, level_label, "
            "student:profiles!check_ins_student_id_fkey(full_name, email), "
            "node:nodes(title, order_index)"
        )
        .eq("status", "pending")
        .lt("created_at", cutoff_24h)
        .order("created_at")
        .limit(40)
        .execute()
    ).data or []

    for row in pending:
        name = _student_label(row.get("student"))
        node = row.get("node") or {}
        if isinstance(node, list):
            node = node[0] if node else {}
        level = row.get("level_label") or node.get("title") or "nível"
        created = row.get("created_at") or ""
        alerts.append(
            {
                "scenario": "feedback_pending",
                "line": f"{name} — Check-in atrasado >24h ({level})",
                "student_id": row.get("student_id"),
                "check_in_id": row.get("id"),
                "since": created,
            }
        )

    # --- Paths activos: dead_end / stagnating / expired ---
    paths = (
        sb.table("paths")
        .select(
            "id, title, status, student_id, placeholder_name, "
            "student:profiles!paths_student_id_fkey(full_name, email), "
            "nodes(id, title, status, kind, order_index, due_date, "
            "content_body, resource_url)"
        )
        .eq("status", "active")
        .execute()
    ).data or []

    for path in paths:
        name = _student_label(path.get("student"), path.get("placeholder_name"))
        nodes = sorted(
            path.get("nodes") or [], key=lambda n: n.get("order_index") or 0
        )
        if not nodes:
            continue

        active = next((n for n in nodes if n.get("status") == "active"), None)
        if not active:
            # fallback: first non-completed
            active = next(
                (n for n in nodes if n.get("status") != "completed"), None
            )
        if not active:
            continue

        idx = active.get("order_index") or 0
        nxt = next(
            (n for n in nodes if (n.get("order_index") or 0) > idx),
            None,
        )

        # Dead end: next level missing content (or no next level for lesson/practice chain)
        if nxt is not None and not _node_has_content(nxt):
            alerts.append(
                {
                    "scenario": "dead_end",
                    "line": (
                        f"{name} — Dead end: «{active.get('title')}» ok, "
                        f"próximo «{nxt.get('title')}» sem conteúdo "
                        "(gravar/adicionar)"
                    ),
                    "student_id": path.get("student_id"),
                    "path_id": path.get("id"),
                    "active_node_id": active.get("id"),
                    "next_node_id": nxt.get("id"),
                }
            )
        elif nxt is None and (active.get("kind") or "") in (
            "lesson",
            "practice",
        ):
            # Active last node without a following step — mentor may need to extend path
            alerts.append(
                {
                    "scenario": "dead_end",
                    "line": (
                        f"{name} — Dead end: último nível «{active.get('title')}» "
                        "sem nível seguinte (estender percurso)"
                    ),
                    "student_id": path.get("student_id"),
                    "path_id": path.get("id"),
                    "active_node_id": active.get("id"),
                }
            )

        due_raw = active.get("due_date")
        due: date | None = None
        if due_raw:
            try:
                due = date.fromisoformat(str(due_raw)[:10])
            except ValueError:
                due = None

        if due is not None and due == tomorrow:
            alerts.append(
                {
                    "scenario": "stagnating",
                    "line": (
                        f"{name} — Estagnação: falta 1 dia para prazo de "
                        f"«{active.get('title')}» ({due.isoformat()})"
                    ),
                    "student_id": path.get("student_id"),
                    "path_id": path.get("id"),
                    "active_node_id": active.get("id"),
                    "due_date": due.isoformat(),
                }
            )

        if due is not None and due < today and active.get("status") != "completed":
            # Expired: deadline passed; check if there is a pending check-in on this node
            node_id = active.get("id")
            has_pending = False
            if node_id:
                ci = (
                    sb.table("check_ins")
                    .select("id")
                    .eq("node_id", node_id)
                    .eq("status", "pending")
                    .limit(1)
                    .execute()
                ).data
                has_pending = bool(ci)
            if not has_pending:
                alerts.append(
                    {
                        "scenario": "expired",
                        "line": (
                            f"{name} — Expirou: «{active.get('title')}» "
                            f"prazo {due.isoformat()} sem check-in"
                        ),
                        "student_id": path.get("student_id"),
                        "path_id": path.get("id"),
                        "active_node_id": active.get("id"),
                        "due_date": due.isoformat(),
                    }
                )

    # Deduplicate by line
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for a in alerts:
        line = a["line"]
        if line in seen:
            continue
        seen.add(line)
        unique.append(a)

    # Priority order for display
    order = {
        "expired": 0,
        "feedback_pending": 1,
        "stagnating": 2,
        "dead_end": 3,
    }
    unique.sort(key=lambda a: order.get(a["scenario"], 9))

    lines = [a["line"] for a in unique]
    return _record(
        "intervention_alerts",
        {
            "count": len(unique),
            "lines": lines,
            "alerts": unique,
            "telegraphic": "\n".join(lines) if lines else "Nenhum alerta crítico.",
        },
    )


@tool
def get_agenda_ops() -> str:
    """
    Agenda operacional: próximas sessões Cal.com + prazos de níveis activos +
    alertas de gravar/adicionar conteúdo (dead_end). Horizonte 14 dias.
    """
    sb = get_supabase()
    now = datetime.now(timezone.utc)
    today = now.date()
    horizon = today + timedelta(days=14)

    sessions = (
        sb.table("cal_bookings")
        .select(
            "id, start_time, end_time, title, attendee_name, attendee_email, "
            "student_id, meet_url, status"
        )
        .in_("status", ["accepted", "pending", "rescheduled"])
        .gte("start_time", now.isoformat())
        .lte("start_time", datetime.combine(horizon, datetime.max.time()).replace(tzinfo=timezone.utc).isoformat())
        .order("start_time")
        .limit(20)
        .execute()
    ).data or []

    paths = (
        sb.table("paths")
        .select(
            "id, title, student_id, placeholder_name, start_date, end_date, "
            "student:profiles!paths_student_id_fkey(full_name, email), "
            "nodes(id, title, status, kind, order_index, due_date, "
            "content_body, resource_url)"
        )
        .eq("status", "active")
        .execute()
    ).data or []

    module_windows: list[dict[str, Any]] = []
    content_todos: list[str] = []
    deadlines: list[dict[str, Any]] = []

    for path in paths:
        name = _student_label(path.get("student"), path.get("placeholder_name"))
        if path.get("start_date") or path.get("end_date"):
            module_windows.append(
                {
                    "student": name,
                    "path": path.get("title"),
                    "start_date": path.get("start_date"),
                    "end_date": path.get("end_date"),
                }
            )
        nodes = sorted(
            path.get("nodes") or [], key=lambda n: n.get("order_index") or 0
        )
        active = next((n for n in nodes if n.get("status") == "active"), None)
        if active and active.get("due_date"):
            try:
                due = date.fromisoformat(str(active["due_date"])[:10])
            except ValueError:
                due = None
            if due and today <= due <= horizon:
                deadlines.append(
                    {
                        "student": name,
                        "level": active.get("title"),
                        "due_date": due.isoformat(),
                        "line": f"{name} — Prazo «{active.get('title')}» {due.isoformat()}",
                    }
                )
        if active:
            idx = active.get("order_index") or 0
            nxt = next(
                (n for n in nodes if (n.get("order_index") or 0) > idx), None
            )
            if nxt is not None and not _node_has_content(nxt):
                content_todos.append(
                    f"{name} — Gravar/adicionar conteúdo: «{nxt.get('title')}»"
                )

    session_lines = []
    for s in sessions:
        when = (s.get("start_time") or "")[:16].replace("T", " ")
        who = s.get("attendee_name") or s.get("attendee_email") or "—"
        session_lines.append(
            f"{when} — Call: {s.get('title') or 'Sessão'} ({who})"
        )

    deadline_lines = [d["line"] for d in sorted(deadlines, key=lambda x: x["due_date"])]

    telegraphic_parts = []
    if session_lines:
        telegraphic_parts.append("SESSÕES:\n" + "\n".join(session_lines))
    if deadline_lines:
        telegraphic_parts.append("PRAZOS:\n" + "\n".join(deadline_lines))
    if content_todos:
        telegraphic_parts.append("CONTEÚDO:\n" + "\n".join(content_todos))
    if not telegraphic_parts:
        telegraphic_parts.append("Agenda limpa nos próximos 14 dias.")

    return _record(
        "agenda_ops",
        {
            "sessions": sessions,
            "module_windows": module_windows,
            "deadlines": deadlines,
            "content_todos": content_todos,
            "telegraphic": "\n\n".join(telegraphic_parts),
        },
    )


@tool
def get_student_xray(query: str) -> str:
    """
    Raio-X factual de um aluno por nome ou UUID.
    Devolve nível actual, prazo, último check-in, próximo passo do mentor.
    """
    q = (query or "").strip()
    if not q:
        return _record("xray_error", {"error": "indica nome ou student_id"})

    sb = get_supabase()
    student = None

    if _is_uuid(q):
        student = (
            sb.table("profiles")
            .select("id, full_name, email, onboarding_completed")
            .eq("id", q)
            .eq("role", "student")
            .maybe_single()
            .execute()
        ).data
    else:
        # name search
        rows = (
            sb.table("profiles")
            .select("id, full_name, email, onboarding_completed")
            .eq("role", "student")
            .ilike("full_name", f"%{q}%")
            .limit(5)
            .execute()
        ).data or []
        if len(rows) == 1:
            student = rows[0]
        elif len(rows) > 1:
            return _record(
                "xray_ambiguous",
                {
                    "error": "vários alunos",
                    "matches": [
                        {"id": r["id"], "name": r.get("full_name"), "email": r.get("email")}
                        for r in rows
                    ],
                },
            )
        else:
            # try placeholder on paths
            paths = (
                sb.table("paths")
                .select(
                    "id, title, status, student_id, placeholder_name, "
                    "nodes(id, title, status, kind, order_index, due_date)"
                )
                .ilike("placeholder_name", f"%{q}%")
                .order("created_at", desc=True)
                .limit(3)
                .execute()
            ).data or []
            if not paths:
                return _record("xray_error", {"error": f"aluno não encontrado: {q}"})
            path = paths[0]
            return _xray_from_path(sb, path, name=path.get("placeholder_name") or q)

    if not student:
        return _record("xray_error", {"error": f"aluno não encontrado: {q}"})

    path = (
        sb.table("paths")
        .select(
            "id, title, status, student_id, placeholder_name, "
            "nodes(id, title, status, kind, order_index, due_date, "
            "content_body, resource_url)"
        )
        .eq("student_id", student["id"])
        .in_("status", ["active", "draft", "paused"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data
    path = path[0] if path else None

    last_ci = (
        sb.table("check_ins")
        .select("id, status, created_at, level_label, node:nodes(title)")
        .eq("student_id", student["id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data
    last_ci = last_ci[0] if last_ci else None

    pending_proposals = (
        sb.table("agent_proposals")
        .select("id, kind, title, status")
        .eq("status", "pending")
        .limit(20)
        .execute()
    ).data or []
    # filter proposals mentioning student loosely via payload later if needed

    return _xray_payload(student, path, last_ci, pending_proposals)


def _xray_from_path(sb, path: dict, name: str) -> str:
    student = {"id": path.get("student_id"), "full_name": name, "email": None}
    last_ci = None
    if path.get("student_id"):
        rows = (
            sb.table("check_ins")
            .select("id, status, created_at, level_label, node:nodes(title)")
            .eq("student_id", path["student_id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        last_ci = rows[0] if rows else None
    return _xray_payload(student, path, last_ci, [])


def _xray_payload(
    student: dict,
    path: dict | None,
    last_ci: dict | None,
    pending_proposals: list,
) -> str:
    name = student.get("full_name") or student.get("email") or "Aluno"
    nodes = sorted(
        (path or {}).get("nodes") or [], key=lambda n: n.get("order_index") or 0
    )
    active = next((n for n in nodes if n.get("status") == "active"), None)
    due = (active or {}).get("due_date")
    path_status = (path or {}).get("status")

    next_step = "Sem percurso activo — criar/aprovar rascunho."
    if path_status == "draft":
        next_step = "Aprovar percurso na Inbox / Studio."
    elif last_ci and last_ci.get("status") == "pending":
        next_step = "Escrever/aprovar feedback do check-in pendente."
    elif active:
        nxt = next(
            (
                n
                for n in nodes
                if (n.get("order_index") or 0) > (active.get("order_index") or 0)
            ),
            None,
        )
        if nxt and not _node_has_content(nxt):
            next_step = f"Gravar/adicionar conteúdo para «{nxt.get('title')}»."
        else:
            next_step = f"Acompanhar nível «{active.get('title')}»."

    node_title = None
    if last_ci:
        node = last_ci.get("node") or {}
        if isinstance(node, list):
            node = node[0] if node else {}
        node_title = last_ci.get("level_label") or node.get("title")

    lines = [
        f"{name}",
        f"Percurso: {(path or {}).get('title') or '—'} ({path_status or 'sem path'})",
        f"Nível actual: {(active or {}).get('title') or '—'} | prazo: {due or '—'}",
        f"Último check-in: {(last_ci or {}).get('created_at', '—')[:16] if last_ci else 'nunca'} "
        f"| estado: {(last_ci or {}).get('status') or '—'} | {node_title or ''}".strip(),
        f"Próximo passo (mentor): {next_step}",
    ]

    return _record(
        "student_xray",
        {
            "student_id": student.get("id"),
            "name": name,
            "path_id": (path or {}).get("id"),
            "path_status": path_status,
            "active_node": active,
            "last_check_in": last_ci,
            "next_step": next_step,
            "pending_proposals_count": len(pending_proposals),
            "telegraphic": "\n".join(lines),
            "lines": lines,
        },
    )


OPS_TOOLS = [
    get_intervention_alerts,
    get_agenda_ops,
    get_student_xray,
]
