"""Contract tests for FastAPI agent endpoints (no LLM required for /health,/patterns)."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Avoid real Google/DB on import
os.environ.setdefault("NEUMA_AGENT_TOKEN", "test-token")
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test")

from main import app  # noqa: E402


@pytest.fixture()
def client():
    return TestClient(app)


def test_health(client: TestClient):
    r = client.get("/health", headers={"X-Neuma-Agent-Token": "test-token"})
    assert r.status_code == 200
    body = r.json()
    assert body.get("ok") is True


def test_patterns(client: TestClient):
    r = client.get("/patterns", headers={"X-Neuma-Agent-Token": "test-token"})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, (list, dict))


def test_health_requires_auth(client: TestClient):
    r = client.get("/health")
    assert r.status_code in (401, 403)


def test_run_requires_auth(client: TestClient):
    r = client.post("/run", json={"message": "hi", "mentor_id": "x", "pattern": "briefing"})
    assert r.status_code in (401, 403)


def test_run_with_token_without_google_key(client: TestClient, monkeypatch):
    monkeypatch.delenv("GOOGLE_GENERATIVE_AI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r = client.post(
        "/run",
        headers={"X-Neuma-Agent-Token": "test-token"},
        json={"message": "hi", "mentor_id": "x", "pattern": "briefing"},
    )
    # Either starts or fails gracefully without key
    assert r.status_code in (200, 400, 500)
