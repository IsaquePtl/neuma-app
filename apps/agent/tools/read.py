"""Read tools — always return real IDs from Supabase (service role)."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool

from shared.db import get_supabase

# Accumulator for Guard: facts returned by tools in this process/request
_LAST_FACTS: list[dict[str, Any]] = []


def reset_facts() -> None:
    _LAST_FACTS.clear()


def get_facts() -> list[dict[str, Any]]:
    return list(_LAST_FACTS)


def _record(kind: str, payload: Any) -> str:
    _LAST_FACTS.append({"kind": kind, "data": payload})
    return json.dumps(payload, default=str, ensure_ascii=False)


@tool
def list_students() -> str:
    """Lista todos os alunos (id, nome, email)."""
    sb = get_supabase()
    res = (
        sb.table("profiles")
        .select("id, full_name, email, created_at, onboarding_completed")
        .eq("role", "student")
        .order("full_name")
        .execute()
    )
    return _record("students", res.data or [])


@tool
def get_student_360(student_id: str) -> str:
    """Perfil completo de um aluno: perfil, percurso, níveis, check-ins, tally, bookings."""
    sb = get_supabase()
    profile = (
        sb.table("profiles")
        .select("*")
        .eq("id", student_id)
        .maybe_single()
        .execute()
    ).data
    paths = (
        sb.table("paths")
        .select("*, nodes(*)")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    checkins = (
        sb.table("check_ins")
        .select("id, status, kind, created_at, node_id, level_label, notes, ai_summary")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(40)
        .execute()
    ).data or []
    tally = (
        sb.table("tally_submissions")
        .select("id, submission_kind, status, created_at, answers, respondent_email")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    ).data or []
    bookings = (
        sb.table("cal_bookings")
        .select("id, start_time, end_time, title, status, meet_url")
        .eq("student_id", student_id)
        .order("start_time", desc=True)
        .limit(10)
        .execute()
    ).data or []
    briefs = (
        sb.table("student_briefs")
        .select("id, raw_markdown, structured, source, created_at")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    ).data or []
    payload = {
        "profile": profile,
        "paths": paths,
        "check_ins": checkins,
        "tally": tally,
        "bookings": bookings,
        "briefs": briefs,
    }
    return _record("student_360", payload)


@tool
def list_paths(status: str = "all") -> str:
    """Lista percursos. status: all|draft|active|paused|completed."""
    sb = get_supabase()
    q = sb.table("paths").select(
        "id, title, status, student_id, placeholder_name, claim_email, created_at"
    )
    if status != "all":
        q = q.eq("status", status)
    res = q.order("created_at", desc=True).limit(50).execute()
    return _record("paths", res.data or [])


@tool
def get_path(path_id: str) -> str:
    """Detalhe de um percurso com todos os níveis (nodes)."""
    sb = get_supabase()
    path = (
        sb.table("paths")
        .select("*, nodes(*)")
        .eq("id", path_id)
        .maybe_single()
        .execute()
    ).data
    return _record("path", path)


@tool
def list_pending_checkins() -> str:
    """Check-ins com status pending."""
    sb = get_supabase()
    res = (
        sb.table("check_ins")
        .select(
            "id, created_at, student_id, node_id, level_label, "
            "student:profiles!check_ins_student_id_fkey(full_name, email), "
            "node:nodes(title)"
        )
        .eq("status", "pending")
        .order("created_at")
        .limit(20)
        .execute()
    )
    return _record("pending_checkins", res.data or [])


@tool
def get_checkin(check_in_id: str) -> str:
    """Detalhe de um check-in."""
    sb = get_supabase()
    res = (
        sb.table("check_ins")
        .select(
            "*, student:profiles!check_ins_student_id_fkey(full_name, email), "
            "node:nodes(title, kind), feedbacks(*), feedback_drafts(*)"
        )
        .eq("id", check_in_id)
        .maybe_single()
        .execute()
    )
    return _record("checkin", res.data)


@tool
def list_upcoming_sessions() -> str:
    """Próximas sessões Cal.com + nível activo do aluno."""
    sb = get_supabase()
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    bookings = (
        sb.table("cal_bookings")
        .select(
            "id, start_time, end_time, title, attendee_name, attendee_email, "
            "student_id, meet_url, status"
        )
        .in_("status", ["accepted", "pending", "rescheduled"])
        .gte("start_time", now)
        .order("start_time")
        .limit(10)
        .execute()
    ).data or []
    enriched = []
    for b in bookings:
        node_title = None
        node_index = None
        if b.get("student_id"):
            path = (
                sb.table("paths")
                .select("id, nodes(title, order_index, status)")
                .eq("student_id", b["student_id"])
                .eq("status", "active")
                .limit(1)
                .execute()
            ).data
            if path:
                nodes = path[0].get("nodes") or []
                active = next((n for n in nodes if n.get("status") == "active"), None)
                if active:
                    node_title = active.get("title")
                    node_index = active.get("order_index")
        enriched.append({**b, "active_node_title": node_title, "active_node_index": node_index})
    return _record("upcoming_sessions", enriched)


@tool
def get_calendar_window(year: int, month: int) -> str:
    """Eventos do calendário do mentor para um mês (year, month 1-12)."""
    sb = get_supabase()
    from datetime import date
    from calendar import monthrange

    start = date(year, month, 1).isoformat()
    last = monthrange(year, month)[1]
    end = date(year, month, last).isoformat()
    events = (
        sb.table("mentor_calendar_events")
        .select("*")
        .gte("starts_at", start)
        .lte("starts_at", f"{end}T23:59:59Z")
        .order("starts_at")
        .execute()
    ).data or []
    bookings = (
        sb.table("cal_bookings")
        .select("id, start_time, end_time, title, student_id, attendee_name, status")
        .gte("start_time", start)
        .lte("start_time", f"{end}T23:59:59Z")
        .order("start_time")
        .execute()
    ).data or []
    return _record("calendar_window", {"events": events, "bookings": bookings})


@tool
def get_library_tree() -> str:
    """Árvore completa da biblioteca: categorias → tópicos → assets."""
    sb = get_supabase()
    cats = (
        sb.table("library_categories")
        .select("*, library_topics(*, library_assets(*))")
        .order("sort_index")
        .execute()
    ).data or []
    practice = (
        sb.table("library_assets")
        .select("id, title, kind, usage, content_status, created_by_agent, url")
        .eq("usage", "practice")
        .is_("archived_at", "null")
        .execute()
    ).data or []
    return _record("library_tree", {"categories": cats, "practice": practice})


@tool
def search_library(query: str) -> str:
    """Pesquisa assets da biblioteca por título/tags. Preferir ready ao reutilizar; empty/drafting são cascas Agent."""
    sb = get_supabase()
    res = (
        sb.table("library_assets")
        .select("id, title, kind, usage, content_status, topic_id, tags, url, created_by_agent")
        .ilike("title", f"%{query}%")
        .is_("archived_at", "null")
        .limit(30)
        .execute()
    )
    rows = res.data or []
    # Ready first — cascas empty não contam como material de biblioteca.
    rows.sort(key=lambda r: 0 if r.get("content_status") == "ready" else 1)
    return _record("library_search", rows)


@tool
def list_tally_submissions(kind: str = "onboarding", status: str = "pending") -> str:
    """Lista submissões Tally. kind: onboarding|checkin|unknown. status: pending|linked|processed."""
    sb = get_supabase()
    res = (
        sb.table("tally_submissions")
        .select(
            "id, submission_kind, status, respondent_name, respondent_email, "
            "student_id, created_at, answers"
        )
        .eq("submission_kind", kind)
        .eq("status", status)
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    )
    return _record("tally", res.data or [])


@tool
def get_student_brief(brief_id: str = "", student_id: str = "", placeholder_name: str = "") -> str:
    """Obtém um brief de transformação por id, student_id ou placeholder_name."""
    sb = get_supabase()
    q = sb.table("student_briefs").select("*")
    if brief_id:
        q = q.eq("id", brief_id)
    elif student_id:
        q = q.eq("student_id", student_id)
    elif placeholder_name:
        q = q.ilike("placeholder_name", placeholder_name)
    else:
        return _record("brief_error", {"error": "provide brief_id, student_id or placeholder_name"})
    res = q.order("created_at", desc=True).limit(5).execute()
    return _record("briefs", res.data or [])


@tool
def get_progress_snapshot() -> str:
    """Snapshot de progresso: todos os alunos com percurso activo e nível actual."""
    sb = get_supabase()
    paths = (
        sb.table("paths")
        .select(
            "id, title, status, student_id, placeholder_name, "
            "student:profiles!paths_student_id_fkey(full_name, email), "
            "nodes(id, title, status, kind, order_index)"
        )
        .in_("status", ["active", "draft"])
        .execute()
    ).data or []
    snapshot = []
    for p in paths:
        nodes = sorted(p.get("nodes") or [], key=lambda n: n.get("order_index") or 0)
        active = next((n for n in nodes if n.get("status") == "active"), None)
        completed = sum(1 for n in nodes if n.get("status") == "completed")
        student = p.get("student") or {}
        if isinstance(student, list):
            student = student[0] if student else {}
        snapshot.append(
            {
                "path_id": p["id"],
                "title": p["title"],
                "status": p["status"],
                "student_id": p.get("student_id"),
                "student_name": student.get("full_name")
                or p.get("placeholder_name")
                or student.get("email"),
                "active_node": active,
                "completed_count": completed,
                "total_nodes": len(nodes),
            }
        )
    return _record("progress_snapshot", snapshot)


@tool
def get_dashboard_facts() -> str:
    """Factos do dashboard do mentor via RPC mentor_dashboard_facts (números reais)."""
    sb = get_supabase()
    try:
        res = sb.rpc("mentor_dashboard_facts").execute()
        return _record("dashboard_facts", res.data)
    except Exception as e:
        return _record("dashboard_facts_error", {"error": str(e)})


READ_TOOLS = [
    list_students,
    get_student_360,
    list_paths,
    get_path,
    list_pending_checkins,
    get_checkin,
    list_upcoming_sessions,
    get_calendar_window,
    get_library_tree,
    search_library,
    list_tally_submissions,
    get_student_brief,
    get_progress_snapshot,
    get_dashboard_facts,
]
