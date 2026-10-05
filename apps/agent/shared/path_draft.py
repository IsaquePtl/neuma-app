"""Deterministic draft path creation from student briefs (HITL: status=draft)."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, Field

from shared.db import get_supabase
from tools.read import _record

NODE_KINDS = frozenset({"lesson", "practice", "call", "milestone"})

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)

# * Nível 1 | Conceito — Anatomia do apoio
# **Nível 2 | Prática** — Rotina diária…
# Require spaces around the dash so "Check-point" is not split.
_LEVEL_LINE = re.compile(
    r"(?im)^\s*\*?\s*\*?\s*N[ií]vel\s+(\d+)\s*\|\s*([^|\n]+?)\s+[—\-–]\s+(.+?)\s*\*?\s*$"
)

# ##### FASE 1: Fundamentos  |  **Fase A — Base**
_PHASE_LINE = re.compile(r"(?im)^\s*#*\s*\*{0,2}\s*fase\s+([A-Za-z0-9]{1,8})\b")

_KIND_ALIASES: dict[str, str] = {
    "conceito": "lesson",
    "lesson": "lesson",
    "lição": "lesson",
    "licao": "lesson",
    "teoria": "lesson",
    "prática": "practice",
    "pratica": "practice",
    "practice": "practice",
    "exercício": "practice",
    "exercicio": "practice",
    "check-point": "milestone",
    "checkpoint": "milestone",
    "check point": "milestone",
    "conquista": "milestone",
    "milestone": "milestone",
    "marco": "milestone",
    "sessão": "call",
    "sessao": "call",
    "sessão 1:1": "call",
    "sessao 1:1": "call",
    "1:1": "call",
    "call": "call",
    "call 1:1": "call",
}

_OBJETIVOS_RE = re.compile(
    r"(?is)\*\*Objetivos?:\*\*\s*(.+?)(?=\n\s*####|\n\s*#####|\Z)"
)


def _parse_date(iso: str) -> datetime:
    return datetime.strptime(iso[:10], "%Y-%m-%d").replace(hour=12)


def _iso(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


def next_monday(from_date: datetime | None = None) -> str:
    """Next Monday on or after today (path weeks always start Monday)."""
    d = (from_date or datetime.now(timezone.utc)).replace(
        hour=12, minute=0, second=0, microsecond=0, tzinfo=None
    )
    # weekday(): Mon=0 … Sun=6
    delta = (0 - d.weekday()) % 7
    return _iso(d + timedelta(days=delta))


def normalize_to_monday(iso_date: str) -> str:
    d = _parse_date(iso_date)
    delta = (0 - d.weekday()) % 7
    return _iso(d + timedelta(days=delta))


def add_months(iso_date: str, months: int) -> str:
    d = _parse_date(iso_date)
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return _iso(d.replace(year=year, month=month, day=day))


def monday_of_week(iso_date: str) -> str:
    d = _parse_date(iso_date)
    return _iso(d - timedelta(days=d.weekday()))


def friday_of_week(iso_date: str) -> str:
    return _iso(_parse_date(monday_of_week(iso_date)) + timedelta(days=4))


def compute_path_end_date(start_monday: str, months: int) -> str:
    return friday_of_week(add_months(start_monday, months))


def weeks_between(start_date: str, end_date: str) -> int:
    start = _parse_date(monday_of_week(start_date))
    end = _parse_date(friday_of_week(end_date))
    diff = (end - start).days
    if diff < 0:
        return 1
    return max(1, diff // 7 + 1)


def week_friday_for_path(start_monday: str, week_number: int) -> str:
    week = max(1, int(week_number))
    monday = _parse_date(normalize_to_monday(start_monday)) + timedelta(weeks=week - 1)
    return _iso(monday + timedelta(days=4))


def segment_durations(
    node_count: int,
    total_weeks: int,
    existing: list[int | None] | None = None,
) -> list[tuple[int, int]]:
    """Return list of (week_number, duration_weeks)."""
    if node_count <= 0:
        return []
    if (
        existing
        and len(existing) == node_count
        and all(w is not None and w >= 1 for w in existing)
    ):
        durations = [int(w) for w in existing]  # type: ignore[arg-type]
    else:
        base = max(1, total_weeks // node_count)
        rem = total_weeks % node_count
        durations = [max(1, base + (1 if i < rem else 0)) for i in range(node_count)]

    segments: list[tuple[int, int]] = []
    week = 1
    for dur in durations:
        segments.append((week, dur))
        week += dur
    return segments


class DraftNode(BaseModel):
    title: str
    description: str = ""
    kind: str = "practice"
    order_index: int = 1
    week_number: int | None = None
    duration_weeks: int | None = None
    phase_key: str | None = None
    is_phase_checkpoint: bool | None = None


class DraftPathPlan(BaseModel):
    title: str
    goal: str = ""
    description: str = ""
    nodes: list[DraftNode] = Field(default_factory=list)


def normalize_kind(raw: str) -> str:
    key = (raw or "").strip().lower()
    key = re.sub(r"\s+", " ", key)
    if key in _KIND_ALIASES:
        return _KIND_ALIASES[key]
    for alias, kind in _KIND_ALIASES.items():
        if alias in key:
            return kind
    return "practice"


def normalize_phase_key(raw: Any) -> str | None:
    """Same rules as the web app (`lib/nodes/phases.ts`): «Fase a» → «A»."""
    value = re.sub(r"(?i)^fase\s+", "", str(raw or "").strip()).strip()
    return value.upper() or None


def apply_phase_layout(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Mirror of the web app's planPhaseLayout:
    phases contiguous, at most one checkpoint per phase, checkpoint last,
    only milestones with a phase can be checkpoints.
    Default: a milestone that is the last level of its phase closes it,
    unless `is_phase_checkpoint` is explicitly False.
    """
    for n in nodes:
        n["phase_key"] = normalize_phase_key(n.get("phase_key"))

    last_by_key: dict[str, dict[str, Any]] = {}
    for n in nodes:
        if n["phase_key"]:
            last_by_key[n["phase_key"]] = n

    chosen: dict[str, int] = {}
    for i, n in enumerate(nodes):
        key = n["phase_key"]
        if key and n.get("kind") == "milestone" and n.get("is_phase_checkpoint") is True:
            chosen[key] = i
    for key, last in last_by_key.items():
        if key in chosen:
            continue
        if last.get("kind") == "milestone" and last.get("is_phase_checkpoint") is not False:
            chosen[key] = nodes.index(last)
    gate_idx = set(chosen.values())

    segments: list[dict[str, Any]] = []
    by_key: dict[str, dict[str, Any]] = {}
    for i, n in enumerate(nodes):
        n["is_phase_checkpoint"] = i in gate_idx
        key = n["phase_key"]
        if not key:
            segments.append({"nodes": [n], "gate": None})
            continue
        seg = by_key.get(key)
        if seg is None:
            seg = {"nodes": [], "gate": None}
            by_key[key] = seg
            segments.append(seg)
        if i in gate_idx:
            seg["gate"] = n
        else:
            seg["nodes"].append(n)

    out: list[dict[str, Any]] = []
    for seg in segments:
        out.extend(seg["nodes"])
        if seg["gate"] is not None:
            out.append(seg["gate"])
    return out


def parse_nodes_from_rota(markdown: str) -> list[dict[str, Any]]:
    """Extract levels from ROTA DE TRANSFORMAÇÃO markdown when present."""
    nodes: list[dict[str, Any]] = []
    seen: set[int] = set()
    text = markdown or ""
    phase_marks = [(m.start(), normalize_phase_key(m.group(1))) for m in _PHASE_LINE.finditer(text)]
    for m in _LEVEL_LINE.finditer(text):
        phase_key = None
        for pos, key in phase_marks:
            if pos > m.start():
                break
            phase_key = key
        order = int(m.group(1))
        if order in seen:
            continue
        seen.add(order)
        kind_raw = m.group(2).strip().strip("*").strip()
        title = m.group(3).strip().strip("*").strip()
        if not title:
            continue
        nodes.append(
            {
                "title": title[:200],
                "description": None,
                "kind": normalize_kind(kind_raw),
                "order_index": order,
                "week_number": None,
                "phase_key": phase_key,
            }
        )
    nodes.sort(key=lambda n: n["order_index"])
    nodes = apply_phase_layout(nodes)
    # Re-index densely if gaps
    for i, n in enumerate(nodes, start=1):
        n["order_index"] = i
    return nodes


def extract_goal_from_brief(markdown: str) -> str:
    m = _OBJETIVOS_RE.search(markdown or "")
    if not m:
        return ""
    text = re.sub(r"\s+", " ", m.group(1)).strip()
    return text[:500]


def default_title(student_name: str) -> str:
    name = (student_name or "").strip() or "Aluno"
    return f"Percurso · {name}"


def structure_nodes_with_llm(*, brief_markdown: str, student_name: str) -> DraftPathPlan:
    """One Sonnet structured call when the brief has no parseable levels."""
    from langchain_core.messages import HumanMessage, SystemMessage

    from shared.llm import Workload, get_llm
    from shared.voice import VOICE_BLOCK

    llm = get_llm(Workload.JOURNEY, temperature=0.2).with_structured_output(DraftPathPlan)
    result = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Monta um percurso Neuma em rascunho a partir do brief. "
                    "~12–16 níveis (lesson|practice|call|milestone). "
                    "Agrupa os níveis em fases (phase_key curto: A, B, C…). "
                    "Uma fase pode terminar num milestone com is_phase_checkpoint=true "
                    "(check-point que fecha a fase: se o aluno falhar, revê os níveis da fase). "
                    "Milestones a meio de uma fase são check-points soltos (is_phase_checkpoint=false). "
                    "Cada nível tem duration_weeks (mínimo 1 semana Mon–Sex). "
                    "A soma das semanas deve caber num período de ~3–4 meses "
                    "(~12–16 semanas). Níveis sem conteúdo detalhado — só título + kind + duration_weeks. "
                    "Título curto do percurso; goal = objectivo principal. "
                    f"{VOICE_BLOCK}"
                )
            ),
            HumanMessage(
                content=(
                    f"Aluno: {student_name}\n\n"
                    f"Brief:\n{(brief_markdown or '')[:12000]}"
                )
            ),
        ]
    )
    nodes: list[DraftNode] = []
    for i, n in enumerate(result.nodes or [], start=1):
        kind = n.kind if n.kind in NODE_KINDS else normalize_kind(n.kind)
        nodes.append(
            DraftNode(
                title=(n.title or f"Nível {i}")[:200],
                description=(n.description or "")[:500],
                kind=kind,
                order_index=n.order_index or i,
                week_number=n.week_number,
                duration_weeks=n.duration_weeks if n.duration_weeks and n.duration_weeks >= 1 else None,
                phase_key=normalize_phase_key(n.phase_key),
                is_phase_checkpoint=n.is_phase_checkpoint,
            )
        )
    if not nodes:
        # Absolute fallback: 12 shell levels
        for i in range(1, 13):
            kind = "milestone" if i % 4 == 0 else ("practice" if i % 2 == 0 else "lesson")
            nodes.append(
                DraftNode(
                    title=f"Nível {i}",
                    kind=kind,
                    order_index=i,
                )
            )
    return DraftPathPlan(
        title=(result.title or default_title(student_name))[:120],
        goal=(result.goal or extract_goal_from_brief(brief_markdown))[:500],
        description=(result.description or "")[:1000],
        nodes=nodes,
    )


def _normalize_nodes(raw_nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, n in enumerate(raw_nodes or [], start=1):
        if not isinstance(n, dict):
            continue
        title = str(n.get("title") or "").strip()
        if not title:
            continue
        kind = n.get("kind") or "practice"
        if kind not in NODE_KINDS:
            kind = normalize_kind(str(kind))
        out.append(
            {
                "title": title[:200],
                "description": (n.get("description") or None),
                "kind": kind,
                "order_index": int(n.get("order_index") or i),
                "week_number": n.get("week_number"),
                "duration_weeks": (
                    int(n["duration_weeks"])
                    if n.get("duration_weeks") is not None
                    and int(n.get("duration_weeks") or 0) >= 1
                    else None
                ),
                "content_body": n.get("content_body") or None,
                "resource_url": n.get("resource_url") or None,
                "due_date": n.get("due_date") or None,
                "phase_key": n.get("phase_key"),
                "is_phase_checkpoint": (
                    n["is_phase_checkpoint"]
                    if isinstance(n.get("is_phase_checkpoint"), bool)
                    else None
                ),
                "node_code": (str(n.get("node_code") or "").strip()[:20] or None),
            }
        )
    out.sort(key=lambda x: x["order_index"])
    out = apply_phase_layout(out)
    for i, n in enumerate(out, start=1):
        n["order_index"] = i
    return out


def _phase_columns(n: dict[str, Any]) -> dict[str, Any]:
    return {
        "phase_key": n.get("phase_key"),
        "is_phase_checkpoint": bool(n.get("is_phase_checkpoint")),
        "node_code": n.get("node_code"),
    }


def relayout_path_phases(
    sb: Any,
    path_id: str,
    prefer_checkpoints: set[str] | None = None,
) -> None:
    """Re-apply the phase rules to a stored path (after point edits)."""
    existing = (
        sb.table("nodes")
        .select("id, kind, phase_key, is_phase_checkpoint, order_index")
        .eq("path_id", path_id)
        .order("order_index")
        .execute()
    ).data or []
    if not existing:
        return
    before = {n["id"]: bool(n.get("is_phase_checkpoint")) for n in existing}
    draft = [dict(n) for n in existing]
    for pid in prefer_checkpoints or set():
        target = next((n for n in draft if n["id"] == pid), None)
        if not target:
            continue
        key = normalize_phase_key(target.get("phase_key"))
        for n in draft:
            if key and normalize_phase_key(n.get("phase_key")) == key:
                n["is_phase_checkpoint"] = False
        target["is_phase_checkpoint"] = True
    planned = apply_phase_layout(draft)
    # Clear before set: one checkpoint per phase is a unique index.
    for want in (False, True):
        for n in planned:
            if n["is_phase_checkpoint"] == want and before[n["id"]] != want:
                sb.table("nodes").update({"is_phase_checkpoint": want}).eq("id", n["id"]).execute()
    for n in planned:
        orig = next(e for e in existing if e["id"] == n["id"])
        if orig.get("phase_key") != n["phase_key"]:
            sb.table("nodes").update({"phase_key": n["phase_key"]}).eq("id", n["id"]).execute()
    ids = [n["id"] for n in planned]
    if ids != [n["id"] for n in existing]:
        sb.rpc("reorder_path_nodes", {"p_path_id": path_id, "p_ids": ids}).execute()


def insert_draft_path(
    *,
    mentor_id: str,
    title: str,
    nodes: list[dict[str, Any]],
    placeholder_name: str = "",
    claim_email: str = "",
    goal: str = "",
    description: str = "",
    student_id: str | None = None,
    brief_id: str | None = None,
    thread_id: str | None = None,
    run_id: str | None = None,
    period_months: int = 3,
    start_date: str | None = None,
) -> dict[str, Any]:
    """
    Insert paths+nodes as status=draft (student cannot see until mentor activates).
    Also records an applied agent_proposal for audit trail.
    Schedule: start Monday + period_months → end Friday; levels fill Mon–Fri weeks.
    """
    sb = get_supabase()
    clean_nodes = _normalize_nodes(nodes)
    if not clean_nodes:
        return {"error": "sem níveis para criar o percurso"}

    months = period_months if period_months and period_months >= 1 else 3
    start_monday = normalize_to_monday(start_date) if start_date else next_monday()
    end_friday = compute_path_end_date(start_monday, months)
    total_weeks = weeks_between(start_monday, end_friday)
    duration_label = "1 mês" if months == 1 else f"{months} meses"

    segments = segment_durations(
        len(clean_nodes),
        total_weeks,
        [n.get("duration_weeks") for n in clean_nodes],
    )

    sid = (student_id or "").strip() or None
    bid = (brief_id or "").strip() or None

    path_row = {
        "title": (title or "Percurso").strip()[:120],
        "placeholder_name": (placeholder_name or None) or None,
        "claim_email": (claim_email or None) or None,
        "goal": (goal or None) or None,
        "description": (description or None) or None,
        "status": "draft",
        "student_id": sid,
        "created_by": mentor_id,
        "start_date": start_monday,
        "end_date": end_friday,
        "duration_label": duration_label,
    }
    path_res = sb.table("paths").insert(path_row).execute()
    if not path_res.data:
        return {"error": "falha ao inserir percurso"}
    path = path_res.data[0]
    path_id = path["id"]

    rows = []
    for n, (week_number, duration_weeks) in zip(clean_nodes, segments):
        rows.append(
            {
                "path_id": path_id,
                "title": n["title"],
                "description": n.get("description"),
                "kind": n["kind"],
                "order_index": n["order_index"],
                "week_number": week_number,
                "duration_weeks": duration_weeks,
                "content_body": n.get("content_body"),
                "resource_url": n.get("resource_url"),
                "due_date": week_friday_for_path(
                    start_monday, week_number + duration_weeks - 1
                ),
                "status": "locked",
                **_phase_columns(n),
            }
        )
    node_res = sb.table("nodes").insert(rows).execute()
    if not node_res.data:
        sb.table("paths").delete().eq("id", path_id).execute()
        return {"error": "falha ao inserir níveis"}

    if bid:
        sb.table("student_briefs").update(
            {
                "path_id": path_id,
                "placeholder_name": placeholder_name or None,
            }
        ).eq("id", bid).execute()

    if sid:
        sb.table("profiles").update({"mentor_id": mentor_id}).eq("id", sid).eq(
            "role", "student"
        ).execute()

    proposal_payload = {
        "title": path_row["title"],
        "placeholder_name": path_row["placeholder_name"],
        "claim_email": path_row["claim_email"],
        "goal": path_row["goal"],
        "description": path_row["description"],
        "status": "draft",
        "student_id": sid,
        "brief_id": bid,
        "start_date": start_monday,
        "end_date": end_friday,
        "duration_label": duration_label,
        "period_months": months,
        "total_weeks": total_weeks,
        "nodes": [
            {**n, "week_number": seg[0], "duration_weeks": seg[1]}
            for n, seg in zip(clean_nodes, segments)
        ],
        "path_id": path_id,
    }
    now_iso = datetime.now(timezone.utc).isoformat()
    prop_row: dict[str, Any] = {
        "kind": "path_draft",
        "status": "applied",
        "title": f"Percurso: {path_row['title']}",
        "summary": f"{len(clean_nodes)} níveis · draft",
        "payload": proposal_payload,
        "target_table": "paths",
        "target_id": path_id,
        "mentor_id": mentor_id,
        "applied_at": now_iso,
        "decided_at": now_iso,
        "decided_by": mentor_id,
    }
    if thread_id:
        prop_row["thread_id"] = thread_id
    # run_id column FK → agent_runs; only set if caller passed a real UUID
    if run_id and _UUID_RE.match(run_id):
        prop_row["run_id"] = run_id

    prop_res = sb.table("agent_proposals").insert(prop_row).execute()
    proposal_id = (prop_res.data or [{}])[0].get("id")

    preview = [n["title"] for n in clean_nodes[:4]]
    result = {
        "pathId": path_id,
        "proposalId": proposal_id,
        "title": path_row["title"],
        "levelCount": len(clean_nodes),
        "totalWeeks": total_weeks,
        "periodMonths": months,
        "startDate": start_monday,
        "endDate": end_friday,
        "preview": preview,
        "studentId": sid,
        "status": "draft",
        "href": f"/studio/journeys/{path_id}",
    }
    _record("path_draft_created", result)
    return result


def apply_draft_path_changes(
    *,
    path_id: str,
    changes: dict[str, Any],
) -> dict[str, Any]:
    """
    Apply edits to an existing draft path in-place (mentor still activates later).
    changes keys:
      - title / goal / description (optional strings)
      - update_nodes: [{order_index|id, title?, description?, kind?}, ...]
      - replace_nodes: full nodes list (rebuilds levels)
    """
    pid = (path_id or "").strip()
    if not _UUID_RE.match(pid):
        return {"error": f"path_id inválido: {path_id!r}"}

    sb = get_supabase()
    path = (
        sb.table("paths")
        .select("id, title, status, student_id, goal, description")
        .eq("id", pid)
        .maybe_single()
        .execute()
    ).data
    if not path:
        return {"error": "percurso não encontrado"}
    if path.get("status") != "draft":
        return {
            "error": "só se edita rascunho (draft) por aqui — activa no studio",
            "status": path.get("status"),
            "pathId": pid,
        }

    patch: dict[str, Any] = {}
    if isinstance(changes.get("title"), str) and changes["title"].strip():
        patch["title"] = changes["title"].strip()[:120]
    if isinstance(changes.get("goal"), str):
        patch["goal"] = changes["goal"].strip() or None
    if isinstance(changes.get("description"), str):
        patch["description"] = changes["description"].strip() or None
    if patch:
        sb.table("paths").update(patch).eq("id", pid).execute()

    if isinstance(changes.get("replace_nodes"), list) and changes["replace_nodes"]:
        clean = _normalize_nodes(changes["replace_nodes"])
        if not clean:
            return {"error": "replace_nodes vazio após normalização"}
        sb.table("nodes").delete().eq("path_id", pid).execute()
        rows = [
            {
                "path_id": pid,
                "title": n["title"],
                "description": n.get("description"),
                "kind": n["kind"],
                "order_index": n["order_index"],
                "week_number": n.get("week_number"),
                "content_body": n.get("content_body"),
                "resource_url": n.get("resource_url"),
                "due_date": n.get("due_date"),
                "status": "locked",
                **_phase_columns(n),
            }
            for n in clean
        ]
        sb.table("nodes").insert(rows).execute()
    elif isinstance(changes.get("update_nodes"), list):
        existing = (
            sb.table("nodes")
            .select("id, title, description, kind, order_index, is_phase_checkpoint")
            .eq("path_id", pid)
            .execute()
        ).data or []
        by_order = {n.get("order_index"): n for n in existing}
        by_id = {n.get("id"): n for n in existing}
        phases_touched = False
        prefer: set[str] = set()
        for u in changes["update_nodes"]:
            if not isinstance(u, dict):
                continue
            target = None
            if u.get("id") and u["id"] in by_id:
                target = by_id[u["id"]]
            elif u.get("order_index") is not None:
                target = by_order.get(int(u["order_index"]))
            if not target:
                continue
            node_patch: dict[str, Any] = {}
            if isinstance(u.get("title"), str) and u["title"].strip():
                node_patch["title"] = u["title"].strip()[:200]
            if "description" in u:
                node_patch["description"] = u.get("description")
            if isinstance(u.get("kind"), str):
                node_patch["kind"] = normalize_kind(u["kind"])
            if "phase_key" in u:
                node_patch["phase_key"] = normalize_phase_key(u.get("phase_key"))
            if isinstance(u.get("node_code"), str):
                node_patch["node_code"] = u["node_code"].strip()[:20] or None
            if u.get("is_phase_checkpoint") is True or (
                "is_phase_checkpoint" not in u and target.get("is_phase_checkpoint")
            ):
                prefer.add(target["id"])
            # Checkpoint shape constraint: clear first, relayout re-flags if valid.
            if (
                u.get("is_phase_checkpoint") is False
                or "phase_key" in u
                or node_patch.get("kind") not in (None, "milestone")
            ):
                node_patch["is_phase_checkpoint"] = False
            if {"phase_key", "is_phase_checkpoint", "kind"} & set(u):
                phases_touched = True
            if node_patch:
                sb.table("nodes").update(node_patch).eq("id", target["id"]).execute()
        if phases_touched:
            relayout_path_phases(sb, pid, prefer)

    refreshed = (
        sb.table("paths")
        .select("id, title, status, student_id, nodes(id, title, order_index, kind)")
        .eq("id", pid)
        .maybe_single()
        .execute()
    ).data or path
    nodes = sorted(
        refreshed.get("nodes") or [], key=lambda n: n.get("order_index") or 0
    )
    result = {
        "pathId": pid,
        "title": refreshed.get("title") or path.get("title"),
        "levelCount": len(nodes),
        "preview": [n.get("title") for n in nodes[:4] if n.get("title")],
        "studentId": refreshed.get("student_id") or path.get("student_id"),
        "status": refreshed.get("status") or "draft",
        "href": f"/studio/journeys/{pid}",
        "updated": True,
    }
    _record("path_draft_updated", result)
    return result


def find_existing_draft(*, student_id: str) -> dict[str, Any] | None:
    sb = get_supabase()
    res = (
        sb.table("paths")
        .select("id, title, status, student_id, created_at, nodes(id, title, order_index)")
        .eq("student_id", student_id)
        .eq("status", "draft")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return None
    p = rows[0]
    nodes = sorted(p.get("nodes") or [], key=lambda n: n.get("order_index") or 0)
    return {
        "pathId": p["id"],
        "title": p["title"],
        "levelCount": len(nodes),
        "preview": [n.get("title") for n in nodes[:4] if n.get("title")],
        "studentId": student_id,
        "status": "draft",
        "href": f"/studio/journeys/{p['id']}",
        "existing": True,
    }


def find_active_path(*, student_id: str) -> dict[str, Any] | None:
    sb = get_supabase()
    res = (
        sb.table("paths")
        .select("id, title, status")
        .eq("student_id", student_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return None
    p = rows[0]
    return {
        "pathId": p["id"],
        "title": p["title"],
        "status": "active",
        "href": f"/studio/journeys/{p['id']}",
    }


def load_brief_for_student(student_id: str) -> dict[str, Any] | None:
    sb = get_supabase()
    res = (
        sb.table("student_briefs")
        .select("id, raw_markdown, structured, placeholder_name, student_id")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def load_student_name(student_id: str) -> str:
    sb = get_supabase()
    res = (
        sb.table("profiles")
        .select("full_name, email")
        .eq("id", student_id)
        .maybe_single()
        .execute()
    )
    p = res.data or {}
    return (p.get("full_name") or p.get("email") or "Aluno").strip()


def build_and_insert_draft_for_student(
    *,
    mentor_id: str,
    student_id: str,
    student_name: str | None = None,
    thread_id: str | None = None,
    force_new: bool = False,
) -> dict[str, Any]:
    """
    Full deterministic pipeline for Agents Hub create-path:
    load brief → parse or LLM → insert draft path.
    """
    name = (student_name or "").strip() or load_student_name(student_id)

    if not force_new:
        existing = find_existing_draft(student_id=student_id)
        if existing:
            return {**existing, "reused": True}

        active = find_active_path(student_id=student_id)
        if active:
            return {
                "error": "active_path",
                "message": (
                    f"{name} já tem percurso activo «{active['title']}». "
                    "Edita em Journeys ou pausa antes de criar outro rascunho."
                ),
                "pathId": active["pathId"],
                "href": active["href"],
                "status": "active",
            }

    brief = load_brief_for_student(student_id)
    if not brief or not (brief.get("raw_markdown") or "").strip():
        return {
            "error": "no_brief",
            "message": (
                f"Sem brief para {name}. Cola a ROTA DE TRANSFORMAÇÃO "
                "ou importa o onboarding primeiro."
            ),
        }

    md = brief["raw_markdown"]
    nodes = parse_nodes_from_rota(md)
    used_llm = False
    if len(nodes) < 4:
        plan = structure_nodes_with_llm(brief_markdown=md, student_name=name)
        used_llm = True
        title = plan.title
        goal = plan.goal
        description = plan.description
        nodes = [n.model_dump() for n in plan.nodes]
    else:
        title = default_title(name)
        goal = extract_goal_from_brief(md)
        description = f"Rascunho a partir do brief de {name}."

    result = insert_draft_path(
        mentor_id=mentor_id,
        title=title,
        nodes=nodes,
        placeholder_name=brief.get("placeholder_name") or name.split()[0],
        goal=goal,
        description=description,
        student_id=student_id,
        brief_id=brief.get("id"),
        thread_id=thread_id,
    )
    if "error" in result:
        return result
    result["usedLlm"] = used_llm
    result["fromBrief"] = True
    return result


def compact_answer(path_draft: dict[str, Any]) -> str:
    """Short PT-PT chat text — card carries the CTA."""
    if path_draft.get("error") == "active_path":
        return path_draft.get("message") or "Aluno já tem percurso activo."
    if path_draft.get("error") == "no_brief":
        return path_draft.get("message") or "Sem brief."
    if path_draft.get("error"):
        return f"Não foi possível criar o rascunho: {path_draft['error']}"

    title = path_draft.get("title") or "Percurso"
    n = path_draft.get("levelCount") or 0
    if path_draft.get("reused") or path_draft.get("existing"):
        return (
            f"Rascunho já existia: «{title}» · {n} níveis. "
            "Abre o cartão para editar; activa quando estiver pronto."
        )
    return (
        f"Rascunho criado: «{title}» · {n} níveis. "
        "Edita no studio; o aluno só vê depois de activares."
    )
