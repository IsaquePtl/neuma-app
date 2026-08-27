"""Shared secret auth between Next.js and the agent service."""

from __future__ import annotations

import os

from fastapi import Header, HTTPException


def require_agent_token(
    x_neuma_agent_token: str | None = Header(default=None, alias="X-Neuma-Agent-Token"),
) -> None:
    expected = (os.getenv("NEUMA_AGENT_TOKEN") or "").strip()
    # In local dev without a token configured, allow (documented in .env.example)
    if not expected:
        return
    if not x_neuma_agent_token or x_neuma_agent_token != expected:
        raise HTTPException(status_code=401, detail="Invalid agent token")
