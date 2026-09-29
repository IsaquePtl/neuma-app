"""Unit tests for rota → draft path parsing (no DB)."""

from shared.path_draft import (
    compact_answer,
    extract_goal_from_brief,
    normalize_kind,
    parse_nodes_from_rota,
)

ANA_SNIPPET = """
#### Planeamento por Níveis (Nodes)
##### FASE 1: Fundamentos
* Nível 1 | Conceito — Anatomia do apoio: mitos vs. prática
* Nível 2 | Prática — Rotina diária de respiração
* Nível 3 | Conceito — Mapa do registo confortável
* Nível 4 | Check-point — Frase exigente com apoio estável
* Nível 8 | Sessão 1:1 — Técnica + repertório
* Nível 12 | Conquista — Demo de 3 temas
"""


def test_parse_nodes_from_rota_kinds():
    nodes = parse_nodes_from_rota(ANA_SNIPPET)
    assert len(nodes) == 6
    by_order = {n["order_index"]: n for n in nodes}
    # reindexed densely 1..6
    assert by_order[1]["kind"] == "lesson"
    assert by_order[2]["kind"] == "practice"
    assert by_order[4]["kind"] == "milestone"
    assert by_order[5]["kind"] == "call"
    assert by_order[6]["kind"] == "milestone"


def test_normalize_kind_aliases():
    assert normalize_kind("Conceito") == "lesson"
    assert normalize_kind("Sessão 1:1") == "call"
    assert normalize_kind("Check-point") == "milestone"


def test_extract_goal():
    md = "- **Objetivos:** Curto prazo — gravar 3 temas.\n\n#### Outro"
    assert "gravar" in extract_goal_from_brief(md)


def test_weeks_between_monday_friday():
    from shared.path_draft import (
        compute_path_end_date,
        normalize_to_monday,
        segment_durations,
        weeks_between,
    )

    assert normalize_to_monday("2026-03-04") == "2026-03-09"  # Wed → next Mon
    assert normalize_to_monday("2026-03-02") == "2026-03-02"  # already Mon
    end = compute_path_end_date("2026-03-02", 3)
    assert end  # Friday of week containing +3 months
    assert weeks_between("2026-03-02", "2026-03-06") == 1
    assert weeks_between("2026-03-02", "2026-03-13") == 2
    segs = segment_durations(3, 6, [2, None, None])
    # custom incomplete → redistribute
    assert len(segs) == 3
    assert sum(d for _, d in segs) == 6
    segs2 = segment_durations(3, 6, [2, 2, 2])
    assert segs2 == [(1, 2), (3, 2), (5, 2)]


def test_compact_answer_created():
    text = compact_answer(
        {"pathId": "abc", "title": "Percurso · Ana", "levelCount": 12}
    )
    assert "Rascunho criado" in text
    assert "12" in text
    assert "{" not in text
