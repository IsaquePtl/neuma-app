"""Skill loader — pattern from mas-course-web-app-assistant."""

from __future__ import annotations

from pathlib import Path

from langchain_core.tools import tool

SKILLS_DIR = Path(__file__).resolve().parent

SKILL_CATALOG = {
    "neuma-pedagogia": "Pedagogia Neuma: níveis, tipos de aula, ritmo de acompanhamento",
    "formato-rota": "Formato exacto da ROTA DE TRANSFORMAÇÃO (perfil + planeamento por níveis)",
    "regras-biblioteca": "Como criar categorias/tópicos/assets vazios e notificar o mentor",
    "tom-do-mentor": "Tom de voz PT-PT do mentor Neuma: directo, útil, sem enrolar",
    "regras-calendario": "O que vai para o calendário (datas, calls, prazos) vs. outras áreas",
}


def list_skill_descriptions() -> str:
    lines = ["Skills disponíveis (usa load_skill para carregar o conteúdo completo):"]
    for name, desc in SKILL_CATALOG.items():
        lines.append(f"- {name}: {desc}")
    return "\n".join(lines)


@tool
def load_skill(skill_name: str) -> str:
    """Carrega o conteúdo completo de uma skill markdown da Neuma."""
    key = skill_name.strip().lower().replace(".md", "")
    if key not in SKILL_CATALOG:
        return (
            f"Skill desconhecida: {skill_name}. "
            f"Disponíveis: {', '.join(SKILL_CATALOG)}"
        )
    path = SKILLS_DIR / f"{key}.md"
    if not path.exists():
        return f"Ficheiro da skill em falta: {path.name}"
    body = path.read_text(encoding="utf-8")
    return (
        f"===== SKILL LOADED: {key} =====\n"
        f"{body}\n"
        f"===== END SKILL: {key} ====="
    )
