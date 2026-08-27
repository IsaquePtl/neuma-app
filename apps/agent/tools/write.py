"""Write tools — low-risk audited writes (library shells + memories)."""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.tools import tool

from shared.db import get_supabase
from tools.read import _record


def _slug(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9àáâãéêíóôõúç\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    return s[:80] or "item"


@tool
def create_library_category(name: str, theme: str = "") -> str:
    """Cria uma categoria na biblioteca. theme opcional: acoustic|electric|piano."""
    sb = get_supabase()
    payload: dict[str, Any] = {"name": name, "slug": _slug(name)}
    if theme in ("acoustic", "electric", "piano"):
        payload["theme"] = theme
    # sort_index = max+1
    existing = (
        sb.table("library_categories").select("sort_index").order("sort_index", desc=True).limit(1).execute()
    ).data
    payload["sort_index"] = (existing[0]["sort_index"] + 1) if existing else 0
    res = sb.table("library_categories").insert(payload).execute()
    return _record("created_category", res.data)


@tool
def create_library_topic(category_id: str, name: str, rationale: str = "") -> str:
    """Cria um tópico vazio (agent) sob uma categoria, com rationale para o mentor."""
    sb = get_supabase()
    existing = (
        sb.table("library_topics")
        .select("sort_index")
        .eq("category_id", category_id)
        .order("sort_index", desc=True)
        .limit(1)
        .execute()
    ).data
    payload = {
        "category_id": category_id,
        "name": name,
        "slug": _slug(name),
        "sort_index": (existing[0]["sort_index"] + 1) if existing else 0,
        "created_by_agent": True,
        "rationale": rationale or None,
    }
    res = sb.table("library_topics").insert(payload).execute()
    return _record("created_topic", res.data)


@tool
def create_empty_library_asset(
    title: str,
    usage: str = "lesson",
    kind: str = "video",
    topic_id: str = "",
    summary: str = "",
) -> str:
    """Cria um asset vazio (content_status=empty, created_by_agent=true) para o mentor preencher."""
    sb = get_supabase()
    if usage not in ("lesson", "practice"):
        usage = "lesson"
    if kind not in ("video", "text", "image", "file", "link"):
        kind = "video"
    payload: dict[str, Any] = {
        "title": title,
        "usage": usage,
        "kind": kind,
        "summary": summary or None,
        "content_status": "empty",
        "created_by_agent": True,
    }
    if topic_id:
        payload["topic_id"] = topic_id
    res = sb.table("library_assets").insert(payload).execute()
    return _record("created_empty_asset", res.data)


@tool
def upsert_agent_memory(mentor_id: str, scope: str, key: str, value: str) -> str:
    """Guarda memória de longo prazo do mentor em Postgres (sem embeddings)."""
    sb = get_supabase()
    res = (
        sb.table("agent_memories")
        .upsert(
            {
                "mentor_id": mentor_id,
                "scope": scope or "global",
                "key": key,
                "value": value,
            },
            on_conflict="mentor_id,scope,key",
        )
        .execute()
    )
    return _record("memory", res.data)


WRITE_TOOLS = [
    create_library_category,
    create_library_topic,
    create_empty_library_asset,
    upsert_agent_memory,
]
