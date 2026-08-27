"""Basic agent unit tests (no live API required for guard heuristics)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from graphs.guard import DAYS_RE, UUID_RE  # noqa: E402


def test_days_regex_catches_99():
    assert DAYS_RE.search("~99 dias")
    assert DAYS_RE.search("99 dias")
    m = DAYS_RE.search("~99 dias")
    assert m and int(m.group(1)) == 99


def test_uuid_regex():
    uid = "123e4567-e89b-12d3-a456-426614174000"
    assert UUID_RE.search(f"aluno {uid}")
    assert not UUID_RE.search("not-a-uuid")


def test_skills_exist():
    skills = ROOT / "skills"
    for name in (
        "neuma-pedagogia.md",
        "formato-rota.md",
        "regras-biblioteca.md",
        "tom-do-mentor.md",
        "regras-calendario.md",
    ):
        assert (skills / name).exists(), name


def test_health_import():
    # Importing main should not require live keys for module load
    import main  # noqa: F401

    assert "supervisor" in main.PATTERNS
