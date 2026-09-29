#!/usr/bin/env python3
"""Replace short seed briefs with full ROTA texts (estilo Márcio/Eduardo/Bernardo)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv(Path(__file__).resolve().parents[2] / "web" / ".env.local")

from shared.db import get_supabase

# Canónicos (apps/web/scripts/seed-marcio-eduardo.mjs + Bernardo alinhado)
EDUARDO_MD = """### 🗺️ ROTA DE TRANSFORMAÇÃO: EDUARDO

#### Perfil do Aluno (Eduardo)
- **Histórico:** Músico autodidata focado em tocar no ministério de louvor.
- **Ponto de Partida:** Tem noções básicas de graus, cifras e campo harmónico básico, mas toca por intuição e precisa de estrutura.
- **Objetivos:** Construir autonomia no piano, entender a lógica das escalas e tocar fluentemente em todos os tons sem depender de "decoreba". Quer aprofundar leitura rítmica e ligaduras via partitura e, mais tarde, explorar DAWs, timbres e mixagem para igreja.

#### Planeamento por Níveis (Nodes)
##### FASE 1: Consolidação Harmónica & Escalas
* Nível 1 | Conceito — A Lógica das Escalas Maiores & Menores
* Nível 2 | Prática — Fluidez em 3 Tons-Chave (C, G, D)
* Nível 3 | Conceito — Círculo de Quintas no Piano
* Nível 4 | Check-point — Progressão em 2 tons
##### FASE 2: Teoria Avançada, Modos & Leitura Rítmica
* Nível 5 | Conceito — Leitura Rítmica Essencial
* Nível 6 | Prática — Mão Esquerda vs Direita
* Nível 7 | Conceito — Modos Gregos na Prática de Louvor
* Nível 8 | Sessão 1:1
##### FASE 3: Áudio, DAW & Contexto de Igreja
* Nível 9 | Conceito — Introdução à DAW & Timbres
* Nível 10 | Prática — Patch/Preset para Louvor
* Nível 11 | Conceito — Mixagem e Frequências no Piano
* Nível 12 | Conquista — Performance completa
"""

MARCIO_MD = """### 🗺️ ROTA DE TRANSFORMAÇÃO: MÁRCIO

#### Perfil do Aluno (Márcio)
- **Histórico:** Músico experiente, produtor hip-hop/beats (AKAI MPC). Excelente ouvido, sem consciência teórica.
- **Ponto de Partida:** Toca guitarra no feeling, conhece cifras e nomes de notas, voicings memorizados, mas não entende formação de acordes.
- **Objetivos:** Consciência teórica do braço para produções e igreja. Formação de acordes, extensões, funções harmónicas, Bossa Nova.

#### Planeamento por Níveis (Nodes)
##### FASE 1: Mapeamento Consciente do Braço
* Nível 1 | Conceito — Descodificar o Braço
* Nível 2 | Prática — Tríades e Tétrades do Zero
* Nível 3 | Conceito — Anatomia dos Voicings & Extensões
* Nível 4 | Check-point — 3 variações de voicings
##### FASE 2: Harmonia Aplicada & Bossa / Neo-Soul
* Nível 5 | Conceito — Funções Harmónicas
* Nível 6 | Prática — Estudo Bossa Nova / R&B
* Nível 7 | Conceito — Escalas com Intenção
* Nível 8 | Sessão 1:1
##### FASE 3: Produção, Igreja & Timbre
* Nível 9 | Conceito — Guitarra + Beatmaking
* Nível 10 | Prática — Arranjo para Igreja / Lo-Fi
* Nível 11 | Conceito — Cadeia de Sinal & Timbre
* Nível 12 | Conquista — Tema/loop produzido
"""

BERNARDO_MD = """### 🗺️ ROTA DE TRANSFORMAÇÃO: BERNARDO

#### Perfil do Aluno (Bernardo)
- **Histórico:** DJ com sensibilidade forte a ritmo, estrutura de faixa, BPM e timbres. Quer aprender guitarra do zero aproveitando esse background.
- **Ponto de Partida:** Pouca técnica de guitarra; excelência em percepção rítmica e de frequências. Precisa traduzir conceitos de DJ/produção para o instrumento.
- **Objetivos:** Fundamentos sólidos de guitarra (postura, acordes, ritmo), pentatónica e primeiros solos, e autonomia para criar riffs/samples úteis nas suas produções.

#### Planeamento por Níveis (Nodes)
##### FASE 1: Fundamentos Práticos e Adaptação Física
* Nível 1 | Conceito — Mão esquerda (mecanismo) e mão direita (ritmo/palhetada)
* Nível 2 | Prática — Postura, digitação e grid rítmico (8ªs/16ªs ↔ BPM)
* Nível 3 | Conceito — Cifras, acordes abertos e power chords
* Nível 4 | Check-point — Progressão pop/rock limpa com metrónomo
##### FASE 2: Percepção, Camadas e Teoria Aplicada
* Nível 5 | Conceito — Guitarra no espectro (médios/agudos) vs baixo/bateria
* Nível 6 | Prática — Rhythm guitar sincronizado com backing
* Nível 7 | Conceito — Pentatónica menor (posição 1) + expressão (bends/slides)
* Nível 8 | Sessão 1:1
##### FASE 3: Repertório, Loops e Criação
* Nível 9 | Conceito — Loop station e arranjo por camadas
* Nível 10 | Prática — Base → riff → melodia em tempo real
* Nível 11 | Conceito — Riffs/samples para DJ/EDM
* Nível 12 | Conquista — Performance intermédia + sample original
"""

# Test students — mesmo grau de detalhe
TEST_BRIEFS = {
    "Ana Ribeiro": """### 🗺️ ROTA DE TRANSFORMAÇÃO: ANA RIBEIRO

#### Perfil do Aluno (Ana Ribeiro)
- **Histórico:** Canta desde os 16 em bandas cover e temas originais (pop/soul). Já teve aulas particulares intermitentes, nunca um percurso 1:1 estruturado.
- **Ponto de Partida:** Interpretação forte (autodeclarado ~6/10); técnica de respiração e apoio falha sob pressão (gravações e temas exigentes). Nervosismo em studio.
- **Objetivos:** Curto prazo — gravar 3 temas com confiança e ar controlado. Longo prazo — shows pagos com consistência vocal e rotina de ensaio semanal.

#### Planeamento por Níveis (Nodes)
##### FASE 1: Fundamentos de Apoio e Respiração
* Nível 1 | Conceito — Anatomia do apoio: mitos vs. prática
* Nível 2 | Prática — Rotina diária de respiração + frase longa (check-in vídeo)
* Nível 3 | Conceito — Mapa do registo confortável e passagem de registos
* Nível 4 | Check-point — Frase exigente com apoio estável (vídeo)
##### FASE 2: Fraseado, Dinâmica e Presença
* Nível 5 | Conceito — Dinâmica, vibrato e intenção emocional
* Nível 6 | Prática — 2 takes do mesmo tema com intenções diferentes
* Nível 7 | Conceito — Presença em gravação vs. palco
* Nível 8 | Sessão 1:1 — Técnica + repertório
##### FASE 3: Repertório Próprio e Entrega
* Nível 9 | Conceito — Preparar sessão de gravação (warm-up + takes)
* Nível 10 | Prática — Gravar tema 1 e 2 com notas de produção
* Nível 11 | Conceito — Stamina e recuperação entre temas
* Nível 12 | Conquista — Demo de 3 temas com feedback de produção
""",
    "Tiago Mendes": """### 🗺️ ROTA DE TRANSFORMAÇÃO: TIAGO MENDES

#### Perfil do Aluno (Tiago Mendes)
- **Histórico:** Guitarrista autodidata (YouTube + 6 meses de escola há anos). Para e volta; agora quer consistência para jams.
- **Ponto de Partida:** Acordes open e algumas progressões (~4/10). Não improvisa; timing e limpeza falham em andamentos mais rápidos. Sem método de prática.
- **Objetivos:** Em ~4 meses — improvisar em blues/rock, tocar 5 temas de ponta a ponta, e entrar numa jam sem vergonha.

#### Planeamento por Níveis (Nodes)
##### FASE 1: Timing, Limpeza e Método
* Nível 1 | Conceito — O que praticar 25 min/dia (estrutura)
* Nível 2 | Prática — Metrónomo + mudanças de acordes limpas
* Nível 3 | Conceito — Pentatónica menor: mapa do braço (posição 1–2)
* Nível 4 | Check-point — Progressão + pentatónica a tempo
##### FASE 2: Improviso e Vocabulário
* Nível 5 | Conceito — Frases blues: pergunta e resposta
* Nível 6 | Prática — Solo de 2 min sobre backing track
* Nível 7 | Conceito — Power chords, riffs e groove de rock
* Nível 8 | Sessão 1:1 — Improviso e tacto
##### FASE 3: Repertório de Jam e Confiança
* Nível 9 | Conceito — 5 temas essenciais (forma e cues)
* Nível 10 | Prática — Tocar 3 temas sem parar (vídeo)
* Nível 11 | Conceito — Etiqueta de jam e comunicação
* Nível 12 | Conquista — Jam guiada / vídeo a improvisar 2 minutos
""",
    "Sofia Carvalho": """### 🗺️ ROTA DE TRANSFORMAÇÃO: SOFIA CARVALHO

#### Perfil do Aluno (Sofia Carvalho)
- **Histórico:** Quer começar do zero no piano/teoria para compor. Só apps esporádicas; nunca aulas formais. Motivação alta, risco de overwhelm.
- **Ponto de Partida:** Quase zero teoria (~2/10). Poucas notas no teclado. Objectivo emocional: música como linguagem própria para vídeos/composição.
- **Objetivos:** Em ~6 meses — tocar 4 músicas simples, escrever uma melodia própria, e ter literacia básica sem se perder em tutoriais.

#### Planeamento por Níveis (Nodes)
##### FASE 1: Teclado, Postura e Leitura Relativa
* Nível 1 | Conceito — Mapa do teclado e postura
* Nível 2 | Prática — Digitação 5 dedos + mãos separadas
* Nível 3 | Conceito — Acordes maiores/menores: ouvir e tocar
* Nível 4 | Check-point — 1 peça simples mãos juntas (vídeo)
##### FASE 2: Progressões Pop e Fluência
* Nível 5 | Conceito — Progressões I–V–vi–IV e variantes
* Nível 6 | Prática — Acompanhar 2 temas pop com metrónomo
* Nível 7 | Conceito — Inversões básicas e voz condutora simples
* Nível 8 | Sessão 1:1 — Técnica e escolhas de repertório
##### FASE 3: Primeira Composição Guiada
* Nível 9 | Conceito — Melodia sobre progressão (8 compassos)
* Nível 10 | Prática — Escrever e gravar melodia original
* Nível 11 | Conceito — Mini-arranjo (mão esq. + melodia)
* Nível 12 | Conquista — 4 peças + melodia original documentada
""",
    "Ricardo Alves": """### 🗺️ ROTA DE TRANSFORMAÇÃO: RICARDO ALVES

#### Perfil do Aluno (Ricardo Alves)
- **Histórico:** Produz no Ableton há ~3 anos (home studio). Muitos sketches; raramente fecha temas. Um workshop de mixing; sem mentor contínuo.
- **Ponto de Partida:** Arranjo intermédio (~5/10); mix e “definição de done” fracos. Perfeccionismo bloqueia publicação. Adulto ocupado — precisa de sistema e deadlines.
- **Objetivos:** Curto prazo — 2 tracks finalizadas. Longo prazo — EP de 4 temas com ritual de fecho e publicação.

#### Planeamento por Níveis (Nodes)
##### FASE 1: Critérios de Done e Workflow
* Nível 1 | Conceito — Checklist de fecho de um tema
* Nível 2 | Prática — Escolher 1 sketch e levar a 80%
* Nível 3 | Conceito — Referências de mix: ouvir com intenção
* Nível 4 | Check-point — Track A em estado “release candidate”
##### FASE 2: Arranjo e Mix Mínimo Viável
* Nível 5 | Conceito — Arranjo: tensão, drop, espaço
* Nível 6 | Prática — Mix mínimo (EQ, compressão, loudness alvo)
* Nível 7 | Conceito — Segunda track: reutilizar sistema, não reinventar
* Nível 8 | Sessão 1:1 — Mix e decisões artísticas
##### FASE 3: Publicação e Retrospectiva
* Nível 9 | Conceito — Metadados, capa, plataforma
* Nível 10 | Prática — Publicar track 1 + 2
* Nível 11 | Conceito — Retrospectiva: o que repetir no EP
* Nível 12 | Conquista — 2 tracks publicadas + plano de EP
""",
    "Beatriz Lopes": """### 🗺️ ROTA DE TRANSFORMAÇÃO: BEATRIZ LOPES

#### Perfil do Aluno (Beatriz Lopes)
- **Histórico:** Violinista de conservatório e orquestra. Técnica clássica alta; nunca mentoria de improviso. Quer transição para jazz/pop e um duo experimental.
- **Ponto de Partida:** Avançada no score (~7/10); bloqueio criativo fora da partitura (“medo de soar mal”).
- **Objetivos:** Vocabulário de improviso seguro, conforto em contextos jazz/pop, e gravar um duo experimental.

#### Planeamento por Níveis (Nodes)
##### FASE 1: Improviso Seguro (Motivos e Escalas)
* Nível 1 | Conceito — Motivos de 2 compassos sem julgamento
* Nível 2 | Prática — Solo de 8 barras sobre backing
* Nível 3 | Conceito — Escalas e modos úteis no violino contemporâneo
* Nível 4 | Check-point — Improviso guiado filmado (1 min)
##### FASE 2: Linguagens Jazz/Pop no Violino
* Nível 5 | Conceito — Transcrever 4 bars de referência
* Nível 6 | Prática — Aplicar a transcrição noutro tom
* Nível 7 | Conceito — Groove, articulações e “falar” com a banda
* Nível 8 | Sessão 1:1 — Improviso e identidade
##### FASE 3: Projecto Duo e Identidade
* Nível 9 | Conceito — Estrutura de duo (roles, forma)
* Nível 10 | Prática — Ensaios e takes com parceiro
* Nível 11 | Conceito — Edição/seleção de take final
* Nível 12 | Conquista — Duo experimental gravado (take final)
""",
    "João Ferreira": """### 🗺️ ROTA DE TRANSFORMAÇÃO: JOÃO FERREIRA

#### Perfil do Aluno (João Ferreira)
- **Histórico:** Rapper/songwriter amador; escreve quase todos os dias. Freestyle com amigos; producer ocasional; sem coach. Volume alto de drafts.
- **Ponto de Partida:** Writing intermédio (~5/10); flow e estrutura de faixa irregulares. Começa muitas faixas, fecha poucas com qualidade.
- **Objetivos:** Sistema de escrita, EP de 5 faixas em ~6 meses, e presença Instagram mais profissional.

#### Planeamento por Níveis (Nodes)
##### FASE 1: Estrutura de Faixa e Hooks
* Nível 1 | Conceito — Anatomia (verso / hook / bridge)
* Nível 2 | Prática — Escrever 1 faixa completa em 7 dias
* Nível 3 | Conceito — Hooks memoráveis e coerência temática
* Nível 4 | Check-point — Faixa 1 fechada (letra + demo)
##### FASE 2: Flow, Delivery e Gravação Caseira
* Nível 5 | Conceito — Delivery: timing, respiração, ênfase
* Nível 6 | Prática — 3 takes e escolher o melhor (vídeo/áudio)
* Nível 7 | Conceito — Cadernos de flow e variação de cadência
* Nível 8 | Sessão 1:1 — Letras e performance
##### FASE 3: EP e Lançamento
* Nível 9 | Conceito — Sequência do EP e narrativa
* Nível 10 | Prática — Fechar faixas 2–5 com o mesmo sistema
* Nível 11 | Conceito — Presença IG: conteúdo vs. promo
* Nível 12 | Conquista — EP de 5 faixas publicado
""",
}

CANONICAL = {
    "Márcio Klay": MARCIO_MD,
    "Eduardo Monteiro": EDUARDO_MD,
    "Bernardo Silva": BERNARDO_MD,
}


def upsert_brief(sb, *, student_id: str, name: str, md: str, mentor_id: str) -> None:
    existing = (
        sb.table("student_briefs")
        .select("id")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    payload = {
        "raw_markdown": md.strip() + "\n",
        "structured": {
            "source": "upgrade_full_rota_v2",
            "format": "rota_transformacao",
            "placeholder_name": name,
        },
        "placeholder_name": name.split()[0],
        "source": "imported",
        "created_by": mentor_id,
    }
    if existing:
        sb.table("student_briefs").update(payload).eq("id", existing[0]["id"]).execute()
        print(f"UPDATE brief  {name}  ({existing[0]['id']})")
    else:
        payload["student_id"] = student_id
        res = sb.table("student_briefs").insert(payload).execute()
        print(f"INSERT brief  {name}  ({res.data[0]['id']})")


def main() -> None:
    sb = get_supabase()
    mentor = (
        sb.table("profiles")
        .select("id")
        .eq("role", "mentor")
        .limit(1)
        .execute()
        .data
    )
    mentor_id = mentor[0]["id"]

    # Canonical 3 + test 6 — sync student_briefs AND internal_notes (ficha UI)
    all_briefs = {**CANONICAL, **TEST_BRIEFS}
    for full_name, md in all_briefs.items():
        if full_name in TEST_BRIEFS:
            rows = (
                sb.table("profiles")
                .select("id, full_name")
                .eq("full_name", full_name)
                .eq("role", "student")
                .limit(1)
                .execute()
                .data
                or []
            )
            match = rows[0] if rows else None
        else:
            rows = (
                sb.table("profiles")
                .select("id, full_name")
                .eq("role", "student")
                .ilike("full_name", f"%{full_name.split()[0]}%")
                .execute()
                .data
                or []
            )
            match = next(
                (
                    r
                    for r in rows
                    if full_name.split()[0].lower()
                    in (r.get("full_name") or "").lower()
                ),
                None,
            )
        if not match:
            print(f"SKIP missing {full_name}")
            continue
        text = md.strip() + "\n"
        sb.table("profiles").update({"internal_notes": text}).eq(
            "id", match["id"]
        ).execute()
        upsert_brief(
            sb,
            student_id=match["id"],
            name=match["full_name"],
            md=text,
            mentor_id=mentor_id,
        )
        print(f"NOTES {match['full_name']} ({len(text)} chars)")

    print("Done.")


if __name__ == "__main__":
    main()
