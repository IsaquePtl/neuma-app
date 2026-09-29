"""LangGraph checkpointer — Postgres (Supabase schema langgraph) with InMemory fallback."""

from __future__ import annotations

import logging
import os
from typing import Any

from langgraph.checkpoint.memory import InMemorySaver

logger = logging.getLogger("neuma.agent.checkpointer")

_pool: Any = None
_pg_saver: Any = None


def get_checkpointer(*, use_memory: bool = True) -> Any:
    """
    Prefer PostgresSaver via SUPABASE_DB_URI → schema `langgraph`.
    Falls back to InMemorySaver when URI missing or connection fails.
    """
    global _pool, _pg_saver

    if not use_memory:
        return None

    uri = (os.getenv("SUPABASE_DB_URI") or "").strip()
    if not uri:
        logger.warning("[checkpointer] SUPABASE_DB_URI em falta — InMemorySaver")
        return InMemorySaver()

    if _pg_saver is not None:
        return _pg_saver

    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        from psycopg_pool import ConnectionPool

        _pool = ConnectionPool(
            conninfo=uri,
            min_size=1,
            max_size=4,
            kwargs={
                "autocommit": True,
                "prepare_threshold": 0,
                "options": "-c search_path=langgraph,public",
            },
        )
        saver = PostgresSaver(_pool)
        saver.setup()
        _pg_saver = saver
        logger.info("[checkpointer] PostgresSaver activo (schema langgraph)")
        return saver
    except Exception as exc:
        logger.exception(
            "[checkpointer] PostgresSaver falhou (%s) — InMemorySaver", exc
        )
        return InMemorySaver()


def checkpointer_backend() -> str:
    if _pg_saver is not None:
        return "postgres"
    if (os.getenv("SUPABASE_DB_URI") or "").strip():
        return "postgres-or-memory"
    return "memory"
