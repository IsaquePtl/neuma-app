"""Workload-routed LLM factory — Gemini for cheap/fast, Claude for deep reasoning."""

from __future__ import annotations

import os
from enum import Enum
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv(Path(__file__).resolve().parents[2] / "web" / ".env.local", override=False)


class Workload(str, Enum):
    """Strict model routing per Neuma agent surface."""

    SUPERVISOR = "supervisor"  # gemini-1.5-flash
    ROUTER = "router"  # gemini-1.5-flash
    JOURNEY = "journey"  # claude-sonnet-4-5 (era 3.5-sonnet-latest)
    GUARD = "guard"  # claude-sonnet-4-5 (era 3.5-sonnet-latest)
    BRIEFING = "briefing"  # claude-haiku-4-5 (era 3.5-haiku-latest)
    SPECIALIST_FAST = "specialist_fast"  # gemini-1.5-flash (non-journey specialists)


# (provider_prefix, model_id) — init_chat_model format
# Google: 1.5/2.5 flash-lite → 404 em keys novas; equivalente barato: gemini-3.5-flash-lite
# Anthropic: claude-3-5-*-latest → 404; equivalentes actuais da API:
#   sonnet (journey/guard) → claude-sonnet-4-5-20250929
#   haiku (briefing) → claude-haiku-4-5-20251001
WORKLOAD_MODELS: dict[Workload, str] = {
    Workload.SUPERVISOR: "google_genai:gemini-3.5-flash-lite",
    Workload.ROUTER: "google_genai:gemini-3.5-flash-lite",
    Workload.SPECIALIST_FAST: "google_genai:gemini-3.5-flash-lite",
    Workload.JOURNEY: "anthropic:claude-sonnet-4-5-20250929",
    Workload.GUARD: "anthropic:claude-sonnet-4-5-20250929",
    Workload.BRIEFING: "anthropic:claude-haiku-4-5-20251001",
}


def apply_google_env() -> None:
    """Mirror Google key variants for langchain-google-genai."""
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


def has_anthropic_key() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY", "").strip())


def has_google_key_or_any() -> bool:
    return has_google_key() or has_anthropic_key()


def workload_for_pattern(pattern: str) -> Workload:
    """Map an HTTP/SSE pattern name to its primary LLM workload."""
    if pattern == "journey":
        return Workload.JOURNEY
    if pattern == "router":
        return Workload.ROUTER
    if pattern == "briefing":
        return Workload.BRIEFING
    return Workload.SUPERVISOR


def model_string(workload: Workload = Workload.SUPERVISOR) -> str:
    """Return the provider:model string for a workload (env override optional)."""
    apply_google_env()
    # Optional per-workload override: NEUMA_AGENT_MODEL_JOURNEY=anthropic:claude-...
    env_key = f"NEUMA_AGENT_MODEL_{workload.name}"
    override = os.getenv(env_key, "").strip()
    if override:
        return override if ":" in override else f"google_genai:{override}"

    return WORKLOAD_MODELS[workload]


@lru_cache(maxsize=16)
def _cached_llm(model: str, temperature: float):
    return init_chat_model(model, temperature=temperature)


def get_llm(
    workload: Workload = Workload.SUPERVISOR,
    temperature: float | None = None,
):
    """Return a chat model bound to the workload's provider/model."""
    apply_google_env()
    model = model_string(workload)
    if temperature is None:
        temperature = 0.1 if workload in (Workload.GUARD, Workload.ROUTER) else 0.2
    if model.startswith("anthropic:") and not has_anthropic_key():
        raise RuntimeError(
            f"ANTHROPIC_API_KEY em falta para workload={workload.value} ({model})"
        )
    if model.startswith("google_genai:") and not has_google_key():
        raise RuntimeError(
            f"GOOGLE_GENERATIVE_AI_API_KEY em falta para workload={workload.value} ({model})"
        )
    return _cached_llm(model, temperature)


# Back-compat for health / tracers that call resolve_model_id()
def resolve_model_id() -> str:
    return model_string(Workload.SUPERVISOR).split(":", 1)[-1]
