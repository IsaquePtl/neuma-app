"""Loader for pedagogical student contexts in contexts/neuma-1-1/."""

from __future__ import annotations

from pathlib import Path

from langchain_core.tools import tool

CONTEXTS_DIR = Path(__file__).resolve().parent / "neuma-1-1"

CONTEXT_CATALOG = {
    "eduardo": "Perfil pedagógico Edu / Eduardo (Neuma 1:1)",
    "marcio": "Perfil pedagógico Márcio (Neuma 1:1)",
    "bernardo": "Perfil pedagógico Bernardo (Neuma 1:1)",
}


def list_context_descriptions() -> str:
    lines = ["Contextos Neuma 1:1 disponíveis (usa load_student_context):"]
    for name, desc in CONTEXT_CATALOG.items():
        lines.append(f"- {name}: {desc}")
    return "\n".join(lines)


def read_context(name: str) -> str | None:
    key = name.strip().lower().replace(".md", "")
    # aliases
    aliases = {"edu": "eduardo", "márcio": "marcio", "marcio": "marcio"}
    key = aliases.get(key, key)
    if key not in CONTEXT_CATALOG:
        return None
    path = CONTEXTS_DIR / f"{key}.md"
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def inject_context_for_prompt(placeholder_or_name: str) -> str:
    """Best-effort inject matching context markdown into a system prompt fragment."""
    raw = (placeholder_or_name or "").strip().lower()
    if not raw:
        return ""
    for key in CONTEXT_CATALOG:
        if key in raw or raw in key:
            body = read_context(key)
            if body:
                return (
                    f"\n\n===== CONTEXTO ALUNO ({key}) =====\n"
                    f"{body}\n"
                    f"===== FIM CONTEXTO ({key}) =====\n"
                )
    # Try first token as name
    token = raw.split()[0] if raw else ""
    body = read_context(token) if token else None
    if body:
        return (
            f"\n\n===== CONTEXTO ALUNO ({token}) =====\n"
            f"{body}\n"
            f"===== FIM CONTEXTO ({token}) =====\n"
        )
    return ""


@tool
def load_student_context(student_key: str) -> str:
    """Carrega o markdown pedagógico de um aluno de teste (eduardo|marcio|bernardo)."""
    key = student_key.strip().lower().replace(".md", "")
    body = read_context(key)
    if not body:
        return (
            f"Contexto desconhecido: {student_key}. "
            f"Disponíveis: {', '.join(CONTEXT_CATALOG)}"
        )
    return (
        f"===== CONTEXT LOADED: {key} =====\n"
        f"{body}\n"
        f"===== END CONTEXT: {key} ====="
    )
