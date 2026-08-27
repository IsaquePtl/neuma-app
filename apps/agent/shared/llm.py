"""Gemini model selection — validates available models at startup (no invented IDs)."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import httpx
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
# Also pick up apps/web/.env.local when running locally side-by-side
load_dotenv(Path(__file__).resolve().parents[2] / "web" / ".env.local", override=False)

PREFERRED_MODELS = [
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
]

# Listed by the API but rejected at call-time for new keys.
DEPRECATED_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
}


def apply_google_env() -> None:
    """Mirror keys the way the course lab does (GOOGLE_API_KEY ↔ GEMINI_API_KEY)."""
    studio = os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
    google = os.getenv("GOOGLE_API_KEY")
    gemini = os.getenv("GEMINI_API_KEY")

    primary = (studio or google or gemini or "").strip()
    if not primary:
        return

    os.environ["GOOGLE_API_KEY"] = primary
    os.environ["GEMINI_API_KEY"] = primary
    if not studio:
        os.environ["GOOGLE_GENERATIVE_AI_API_KEY"] = primary


def has_google_key() -> bool:
    apply_google_env()
    return bool(
        os.getenv("GOOGLE_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
    )


def _api_key() -> str:
    apply_google_env()
    return (
        os.getenv("GOOGLE_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
        or ""
    ).strip()


def list_google_models() -> list[str]:
    """Query Google Generative Language API for real model IDs."""
    key = _api_key()
    if not key:
        return []
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    names: list[str] = []
    for m in data.get("models", []):
        name = m.get("name", "")
        # "models/gemini-2.0-flash" → "gemini-2.0-flash"
        short = name.split("/", 1)[-1] if name else ""
        methods = m.get("supportedGenerationMethods") or []
        if short and "generateContent" in methods:
            names.append(short)
    return names


@lru_cache(maxsize=1)
def resolve_model_id() -> str:
    """Pick first preferred model that actually exists, else env override short name."""
    apply_google_env()
    override = os.getenv("NEUMA_AGENT_MODEL", "").strip()
    if override.startswith("google_genai:"):
        override_short = override.split(":", 1)[1]
    elif override:
        override_short = override
    else:
        override_short = ""

    available = set(list_google_models())
    usable = {n for n in available if n not in DEPRECATED_MODELS} or available

    if override_short and override_short not in DEPRECATED_MODELS:
        if not usable or override_short in usable:
            return override_short

    for cand in PREFERRED_MODELS:
        if cand in DEPRECATED_MODELS:
            continue
        if not usable or cand in usable:
            return cand

    if usable:
        for name in sorted(usable):
            if "flash" in name and "embed" not in name:
                return name
        return sorted(usable)[0]

    return override_short or "gemini-3.6-flash"


def model_string() -> str:
    return f"google_genai:{resolve_model_id()}"


def get_llm(temperature: float = 0.2):
    apply_google_env()
    return init_chat_model(model_string(), temperature=temperature)
