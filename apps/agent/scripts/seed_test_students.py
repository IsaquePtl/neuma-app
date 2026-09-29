#!/usr/bin/env python3
"""Seed test students with full profiles, onboarding + ROTA briefs (HITL path drafting).

Usage (from apps/agent with .env loaded):
  python scripts/seed_test_students.py
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Allow `python scripts/seed_test_students.py` from apps/agent
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv(Path(__file__).resolve().parents[2] / "web" / ".env.local")

from shared.db import get_supabase

MENTOR_ID = "470e1664-0680-4b24-9d3c-684b62f2234a"
PASSWORD = "NeumaTest2026!"
ONBOARDING_FORM_ID = "44RJrA"
ONBOARDING_FORM_NAME = "Onboarding Neuma 1:1"

# Tally keys from apps/web/lib/onboarding/questions.ts
K = {
    "name": "a55288a3-5482-4472-8c28-471838e88515",
    "age": "604ae37b-6b0b-4275-a333-fdb3bcdc9fba",
    "musicRelation": "86a6d9ff-7ad7-43d5-a54c-230f363141b8",
    "levelScale": "799ab9bb-ae8a-434d-8fe4-1556e73302b9",
    "levelWhy": "e15a84b4-e646-48c6-b2c3-6375c55d5945",
    "challenge": "932cf1d1-e975-45c8-b1e8-4621596d9cf2",
    "goals": "3423c463-f3dc-4a83-9d06-e7f09d68c2f6",
    "goalsWhy": "14b4343b-7566-48b9-a1bd-dc0a7e40fe12",
    "experience": "ea61e981-937a-4cb5-8ab6-33382413533f",
    "expectations": "3093280b-4bb0-4942-be84-bd44eafa31a0",
    "timeline": "a2925c8b-0101-4154-9d47-c26d0f9e81d4",
    "investment": "5e0e45d4-4bd0-4a69-b4f1-7d76f2850aba",
    "priority": "13ee43c4-64a3-4101-a6c2-2b1ef45c931e",
    "email": "193ecba6-0e70-4b2e-a223-09530742d6e9",
    "whatsapp": "11459f9d-76f4-4e5f-90f5-8cc711b751c7",
    "instagram": "14921da9-ff34-4e8f-9d8b-586b3b7f8e32",
    "contactPreference": "6171a334-29d6-4c7d-ba02-338e2ec05379",
    "studentId": "26a821c1-4484-43a9-9a17-c626d06bc5b5",
}


def brief_markdown(s: dict) -> str:
    name = s["full_name"]
    return f"""### 🗺️ ROTA DE TRANSFORMAÇÃO: {name.upper()}

#### Perfil do Aluno ({name})
- **Histórico:** {s['brief']['historico']}
- **Ponto de Partida:** {s['brief']['partida']}
- **Objetivos:** {s['brief']['objetivos']}

---

#### Planeamento por Níveis (Nodes)

##### FASE 1: {s['brief']['fase1']}
* **Nível 1 | Conceito (Vídeo-Guia Gravado):**
  - *Tema:* {s['brief']['n1']}
  - *Entregável:* Notas pessoais + 1 pergunta ao mentor
* **Nível 2 | Prática (Desafio com Check-in em Vídeo):**
  - *Tema:* {s['brief']['n2']}
  - *Exercício:* Gravar 60–90s a aplicar o conceito
* **Nível 3 | Conceito (Vídeo-Guia Gravado):**
  - *Tema:* {s['brief']['n3']}
  - *Entregável:* Mapa mental do que ficou claro
* **Nível 4 | Check-point (Marco de Transição):**
  - *Validação:* Call curta ou check-in escrito — avançar só com clareza

##### FASE 2: {s['brief']['fase2']}
* **Nível 5 | Conceito**
* **Nível 6 | Prática**
* **Nível 7 | Sessão 1:1**
* **Nível 8 | Check-point**

##### FASE 3: {s['brief']['fase3']}
* **Nível 9–12 | Progressão + Conquista final**
  - *Marco final:* {s['brief']['conquista']}
"""


def structured_from(s: dict) -> dict:
    return {
        "historico": s["brief"]["historico"],
        "ponto_de_partida": s["brief"]["partida"],
        "objetivos": s["brief"]["objetivos"],
        "instrumento": s.get("instrumento"),
        "nivel_autodeclarado": s["onboarding"]["levelScale"],
        "timeline": s["onboarding"]["timeline"],
        "investimento": s["onboarding"]["investment"],
        "prioridade": s["onboarding"]["priority"],
        "seed": "test_students_v1",
    }


def answers_payload(s: dict, student_id: str) -> list[dict]:
    o = s["onboarding"]
    name = s["full_name"]
    rows = [
        (K["name"], "Qual o teu nome?", "INPUT_TEXT", name),
        (K["age"], "Qual a tua idade?", "INPUT_NUMBER", s["age"]),
        (
            K["musicRelation"],
            f"{name}, como descreves a tua relação atual com a música?",
            "MULTIPLE_CHOICE",
            o["musicRelation"],
        ),
        (
            K["levelScale"],
            "Numa escala de 0 a 10, como avalias o teu nível atual na música?",
            "LINEAR_SCALE",
            o["levelScale"],
        ),
        (K["levelWhy"], "Porquê?", "TEXTAREA", o["levelWhy"]),
        (
            K["challenge"],
            "Qual é o teu maior desafio na música neste momento?",
            "TEXTAREA",
            o["challenge"],
        ),
        (
            K["goals"],
            "Qual é o teu objetivo a curto e longo prazo?",
            "TEXTAREA",
            o["goals"],
        ),
        (K["goalsWhy"], "Porque é que tens esse objetivo?", "TEXTAREA", o["goalsWhy"]),
        (
            K["experience"],
            "Fala-me da tua experiência na música.\nJá foste acompanhado antes?",
            "TEXTAREA",
            o["experience"],
        ),
        (
            K["expectations"],
            "O que estás à espera de alcançar com a Neuma 1:1?",
            "TEXTAREA",
            o["expectations"],
        ),
        (
            K["timeline"],
            "Se fizer sentido avançarmos com este percurso,\ncomo vês a nossa timeline?",
            "MULTIPLE_CHOICE",
            o["timeline"],
        ),
        (
            K["investment"],
            "Para alinharmos expectativas, que faixa de investimento mensal estarias disposto(a) a investir?",
            "MULTIPLE_CHOICE",
            o["investment"],
        ),
        (
            K["priority"],
            "Neste momento da tua vida, onde encaixa o nosso trabalho nas tuas prioridades?",
            "MULTIPLE_CHOICE",
            o["priority"],
        ),
        (K["email"], "Email", "INPUT_EMAIL", s["email"]),
        (K["whatsapp"], "Whatsapp", "INPUT_PHONE_NUMBER", s["whatsapp"]),
        (K["instagram"], "Instagram", "INPUT_LINK", s["instagram"]),
        (
            K["contactPreference"],
            "Como preferes ser contactado?",
            "MULTIPLE_CHOICE",
            o["contactPreference"],
        ),
        (K["studentId"], "student_id", "HIDDEN", student_id),
    ]
    out = []
    for key, label, typ, value in rows:
        out.append(
            {
                "key": key,
                "label": label,
                "type": typ,
                "value": value,
                "options": None,
            }
        )
    return out


STUDENTS = [
    {
        "full_name": "Ana Ribeiro",
        "email": "ana.ribeiro.teste@neuma.test",
        "age": 27,
        "gender": "female",
        "whatsapp": "+351912000101",
        "instagram": "https://instagram.com/ana.ribeiro.teste",
        "bio": "Cantora pop / soul. Quer profissionalizar a voz e a presença em palco.",
        "instrumento": "voz",
        "internal_notes": "[TESTE] Seed 2026-03 — prioridade alta, pronta a começar percurso.",
        "onboarding": {
            "musicRelation": "Toco regularmente, mas sinto que me faltam bases/técnica",
            "levelScale": 6,
            "levelWhy": "Canto há anos em bandas, mas a técnica de respiração e apoio ainda falha em temas exigentes.",
            "challenge": "Fico nervosa em gravações e perco o controlo do ar no fim das frases.",
            "goals": "Curto prazo: gravar 3 temas com confiança. Longo prazo: shows pagos com consistência vocal.",
            "goalsWhy": "Quero viver da música a sério e deixar de depender só de trabalhos freelance.",
            "experience": "Aulas particulares intermitentes; nunca tive um percurso estruturado 1:1.",
            "expectations": "Alguém que me empurre com método, feedback honesto e prazos claros.",
            "timeline": "Médio prazo (3-6 meses)",
            "investment": "150€ a 200€",
            "priority": "Super prioritário",
            "contactPreference": "Whatsapp",
        },
        "brief": {
            "historico": "Canta desde os 16; banda cover + temas originais. Técnica irregular sob pressão.",
            "partida": "Nível intermédio (6/10). Força em interpretação; gap em apoio e stamina.",
            "objetivos": "Técnica vocal estável + 3 temas gravados + rotina de ensaio semanal.",
            "fase1": "Fundamentos de apoio e respiração",
            "fase2": "Fraseado, dinâmica e presença",
            "fase3": "Repertório próprio e entrega em performance",
            "n1": "Anatomia do apoio — mitos vs. prática",
            "n2": "Exercício diário de respiração + frase longa",
            "n3": "Mapa do teu registo confortável",
            "conquista": "Demo de 3 temas com notas de produção",
        },
    },
    {
        "full_name": "Tiago Mendes",
        "email": "tiago.mendes.teste@neuma.test",
        "age": 34,
        "gender": "male",
        "whatsapp": "+351913000202",
        "instagram": "https://instagram.com/tiago.mendes.teste",
        "bio": "Guitarrista amador; quer sair da estagnação e tocar com outros.",
        "instrumento": "guitarra",
        "internal_notes": "[TESTE] Seed — estagnado no básico; bom candidato a percurso 4 meses.",
        "onboarding": {
            "musicRelation": "Sei o básico, mas estou estagnado",
            "levelScale": 4,
            "levelWhy": "Sei acordes e algumas progressões, mas não improviso nem toco limpo em andamentos rápidos.",
            "challenge": "Não sei o que praticar a seguir — salto de música em música sem método.",
            "goals": "Em 4 meses: improvisar em blues/rock e tocar 5 temas de ponta a ponta.",
            "goalsWhy": "Quero entrar numa jam sem vergonha e sentir progresso real.",
            "experience": "YouTube + 6 meses de escola há 8 anos. Sem acompanhamento recente.",
            "expectations": "Plano claro semana a semana e accountability.",
            "timeline": "Médio prazo (3-6 meses)",
            "investment": "100€ a 150€",
            "priority": "Prioridade média",
            "contactPreference": "Whatsapp",
        },
        "brief": {
            "historico": "Guitarra autodidata; parou e voltou várias vezes. Agora quer consistência.",
            "partida": "Básico sólido (4/10). Acordes open; gap em pentatónica e timing.",
            "objetivos": "Método de prática + improvisação blues + 5 temas memoráveis.",
            "fase1": "Timing, limpeza e pentatónica",
            "fase2": "Improviso em backing tracks",
            "fase3": "Repertório de jam e confiança em grupo",
            "n1": "O que praticar 25 min/dia — estrutura",
            "n2": "Metrónomo + mudança de acordes limpa",
            "n3": "Pentatónica menor — mapa do braço",
            "conquista": "Jam guiada / vídeo a improvisar 2 minutos",
        },
    },
    {
        "full_name": "Sofia Carvalho",
        "email": "sofia.carvalho.teste@neuma.test",
        "age": 22,
        "gender": "female",
        "whatsapp": "+351914000303",
        "instagram": "https://instagram.com/sofia.carvalho.teste",
        "bio": "Quer começar do zero no piano / teoria para compor.",
        "instrumento": "piano",
        "internal_notes": "[TESTE] Seed — beginner; brief rico para journey draft.",
        "onboarding": {
            "musicRelation": "Quero começar do zero",
            "levelScale": 2,
            "levelWhy": "Sei poucas notas no teclado; quase zero teoria. Motivação alta.",
            "challenge": "Não sei por onde começar sem me perder em apps e tutoriais.",
            "goals": "Em 6 meses: tocar 4 músicas simples e escrever uma melodia própria.",
            "goalsWhy": "Quero compor para vídeos e sentir que a música é minha linguagem.",
            "experience": "Nunca tive aulas formais. Só apps esporádicas.",
            "expectations": "Um percurso guiado, sem overwhelm, com marcos claros.",
            "timeline": "Longo prazo (1 ano/+)",
            "investment": "100€ a 150€",
            "priority": "Algo que estou a considerar para breve",
            "contactPreference": "Instagram",
        },
        "brief": {
            "historico": "Zero formal. Curiosidade forte por composição e piano pop.",
            "partida": "Iniciante (2/10). Motivação alta; precisa de estrutura mínima viável.",
            "objetivos": "Literacia básica + 4 peças + 1 melodia original.",
            "fase1": "Teclado, postura e leitura relativa",
            "fase2": "Acordes triádicos e progressões pop",
            "fase3": "Primeira composição guiada",
            "n1": "Mapa do teclado e postura",
            "n2": "5 digitação + mãos separadas",
            "n3": "Acordes maiores/menores — ouvir e tocar",
            "conquista": "Peça + melodia original de 8 compassos",
        },
    },
    {
        "full_name": "Ricardo Alves",
        "email": "ricardo.alves.teste@neuma.test",
        "age": 41,
        "gender": "male",
        "whatsapp": "+351915000404",
        "instagram": "https://instagram.com/ricardo.alves.teste",
        "bio": "Produtor caseiro; quer fechar temas e deixar de abandonar projectos.",
        "instrumento": "produção / DAW",
        "internal_notes": "[TESTE] Seed — adulto ocupado; timeline curto prazo.",
        "onboarding": {
            "musicRelation": "Toco regularmente, mas sinto que me faltam bases/técnica",
            "levelScale": 5,
            "levelWhy": "Produzo no Ableton há 3 anos, mas misturas soam amadoras e raramente fecho um tema.",
            "challenge": "Perfeccionismo — nunca considero um track 'done'.",
            "goals": "Curto prazo: 2 tracks finalizadas. Longo prazo: EP de 4 temas.",
            "goalsWhy": "Quero publicar e sentir fecho criativo, não só pastas a meio.",
            "experience": "Tutoriais online; um workshop de mixing. Sem mentor contínuo.",
            "expectations": "Deadlines, feedback de arranjo/mix e ritual de fecho.",
            "timeline": "Curto prazo (1 mês)",
            "investment": "200€ a 250€+",
            "priority": "Super prioritário",
            "contactPreference": "Whatsapp",
        },
        "brief": {
            "historico": "Home studio Ableton; muitos sketches, poucos finishes.",
            "partida": "Intermédio produção (5/10). Arranjo ok; mix e fecho fracos.",
            "objetivos": "Sistema de fecho + 2 tracks + base de EP.",
            "fase1": "Critérios de 'done' e workflow",
            "fase2": "Arranjo e mix mínimo viável",
            "fase3": "Publicação e retrospectiva",
            "n1": "Checklist de fecho de um tema",
            "n2": "Escolher 1 sketch e levar a 80%",
            "n3": "Referências de mix — ouvir com intenção",
            "conquista": "2 tracks publicadas (SoundCloud/Bandcamp)",
        },
    },
    {
        "full_name": "Beatriz Lopes",
        "email": "beatriz.lopes.teste@neuma.test",
        "age": 29,
        "gender": "female",
        "whatsapp": "+351916000505",
        "instagram": "https://instagram.com/beatriz.lopes.teste",
        "bio": "Violinista clássica a querer transição para improvisação e música contemporânea.",
        "instrumento": "violino",
        "internal_notes": "[TESTE] Seed — perfil avançado técnico, gap criativo.",
        "onboarding": {
            "musicRelation": "Toco regularmente, mas sinto que me faltam bases/técnica",
            "levelScale": 7,
            "levelWhy": "Formação clássica forte; improviso e criatividade livre são o buraco.",
            "challenge": "Saio do score e fico bloqueada — medo de 'soar mal'.",
            "goals": "Improvisar em contextos jazz/pop e gravar um duo experimental.",
            "goalsWhy": "Quero expandir identidade artística para além do clássico.",
            "experience": "Conservatório + orquestra. Nunca mentoria de improviso.",
            "expectations": "Exercícios seguros de improviso + feedback sem julgamento.",
            "timeline": "Médio prazo (3-6 meses)",
            "investment": "150€ a 200€",
            "priority": "Prioridade média",
            "contactPreference": "Instagram",
        },
        "brief": {
            "historico": "Conservatório e orquestra; técnica alta, criatividade travada.",
            "partida": "Avançado clássico (7/10). Gap em linguagem de improviso.",
            "objetivos": "Vocabulário de improviso + duo gravado + conforto fora do score.",
            "fase1": "Improviso seguro em escalas e motivos",
            "fase2": "Linguagens jazz/pop no violino",
            "fase3": "Projecto duo e identidade",
            "n1": "Motivos de 2 compassos — variar sem julgamento",
            "n2": "Backing track: solo de 8 barras",
            "n3": "Ouvir e transcrever 4 bars de referência",
            "conquista": "Duo experimental gravado (take final)",
        },
    },
    {
        "full_name": "João Ferreira",
        "email": "joao.ferreira.teste@neuma.test",
        "age": 19,
        "gender": "male",
        "whatsapp": "+351917000606",
        "instagram": "https://instagram.com/joao.ferreira.teste",
        "bio": "Rapper / songwriter; quer estrutura para letras e flow consistente.",
        "instrumento": "voz / writing",
        "internal_notes": "[TESTE] Seed — jovem; prioridade curiosidade→converter para top.",
        "onboarding": {
            "musicRelation": "Sei o básico, mas estou estagnado",
            "levelScale": 5,
            "levelWhy": "Escrevo letras todos os dias mas o flow e a estrutura das faixas falham.",
            "challenge": "Começo 10 faixas e não fecho nenhuma com qualidade.",
            "goals": "EP de 5 faixas em 6 meses + presença mais profissional no IG.",
            "goalsWhy": "Quero ser levado a sério na cena local e abrir portas a features.",
            "experience": "Freestyle com amigos; um producer ocasional. Sem coach.",
            "expectations": "Feedback directo às letras/flows e ritmo de releases.",
            "timeline": "Médio prazo (3-6 meses)",
            "investment": "Até 100€",
            "priority": "Curiosidade, sem urgência",
            "contactPreference": "Instagram",
        },
        "brief": {
            "historico": "Rap amador activo; volume alto de drafts, pouca disciplina de fecho.",
            "partida": "Intermédio writing (5/10). Ideias boas; estrutura e delivery irregulares.",
            "objetivos": "Sistema de escrita + 5 faixas + presença IG coerente.",
            "fase1": "Estrutura de faixa e hooks",
            "fase2": "Flow, delivery e gravação caseira",
            "fase3": "EP e lançamento",
            "n1": "Anatomia de uma faixa (verso/hook/bridge)",
            "n2": "Escrever 1 faixa completa em 7 dias",
            "n3": "Delivery: gravar 3 takes e escolher",
            "conquista": "EP de 5 faixas publicado",
        },
    },
]

# Briefs for existing named students (if missing) — for agent x-ray / journey tests
EXISTING_BRIEFS = [
    {
        "match_name": "Márcio Klay",
        "brief": {
            "historico": "Percurso Neuma em preparação; perfil ativo no Studio.",
            "partida": "Onboarding concluído; aguarda draft/aprovação de percurso.",
            "objetivos": "Clareza de níveis e ritmo de check-ins com o mentor.",
            "fase1": "Diagnóstico e alinhamento",
            "fase2": "Prática estruturada",
            "fase3": "Consolidação e marco",
            "n1": "Mapa do ponto de partida",
            "n2": "Primeiro desafio filmado",
            "n3": "Critérios de progresso",
            "conquista": "Primeiro ciclo de 4 semanas concluído",
        },
        "instrumento": "a definir",
    },
    {
        "match_name": "Bernardo Silva",
        "brief": {
            "historico": "Aluno com onboarding feito; ideal para testar alertas e drafts.",
            "partida": "Sem percurso activo ainda — candidato a propose_path_draft.",
            "objetivos": "Arranque de percurso 4 meses com níveis flexíveis.",
            "fase1": "Fundamentos",
            "fase2": "Aplicação",
            "fase3": "Performance / fecho",
            "n1": "Diagnóstico musical",
            "n2": "Rotina mínima viável",
            "n3": "Primeiro marco",
            "conquista": "Nível 4 validado com mentor",
        },
        "instrumento": "a definir",
    },
    {
        "match_name": "Eduardo Monteiro",
        "brief": {
            "historico": "Aluno de referência nos contexts do agent.",
            "partida": "Onboarding + brief existentes; usar para raio-X e journey.",
            "objetivos": "Manter ficheiro completo para testes de agentes.",
            "fase1": "Alinhamento",
            "fase2": "Prática",
            "fase3": "Marco",
            "n1": "Revisão de objectivos",
            "n2": "Check-in diagnóstico",
            "n3": "Plano 4 meses",
            "conquista": "Draft de percurso aprovado",
        },
        "instrumento": "a definir",
        "skip_if_brief_exists": True,
    },
]


def upsert_brief(sb, *, student_id: str, name: str, shell: dict, mentor_id: str) -> str:
    existing = (
        sb.table("student_briefs")
        .select("id")
        .eq("student_id", student_id)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        return existing[0]["id"]

    fake = {
        "full_name": name,
        "brief": shell["brief"],
        "instrumento": shell.get("instrumento"),
        "onboarding": {
            "levelScale": 5,
            "timeline": "Médio prazo (3-6 meses)",
            "investment": "150€ a 200€",
            "priority": "Prioridade média",
        },
    }
    raw = brief_markdown(fake)
    row = {
        "student_id": student_id,
        "placeholder_name": name,
        "raw_markdown": raw,
        "structured": structured_from(fake),
        "source": "imported",
        "created_by": mentor_id,
    }
    res = sb.table("student_briefs").insert(row).execute()
    return res.data[0]["id"]


def create_auth_user(sb, s: dict) -> str:
    # Idempotent: find by email first
    found = (
        sb.table("profiles")
        .select("id, email")
        .eq("email", s["email"])
        .limit(1)
        .execute()
        .data
    )
    if found:
        return found[0]["id"]

    # Also match @neuma.test by name
    by_name = (
        sb.table("profiles")
        .select("id")
        .eq("full_name", s["full_name"])
        .eq("role", "student")
        .ilike("email", "%@neuma.test")
        .limit(1)
        .execute()
        .data
    )
    if by_name:
        return by_name[0]["id"]

    res = sb.auth.admin.create_user(
        {
            "email": s["email"],
            "password": PASSWORD,
            "email_confirm": True,
            "user_metadata": {
                "full_name": s["full_name"],
                "age": s["age"],
                "gender": s["gender"],
                "seed": "test_students_v1",
            },
        }
    )
    user = res.user
    if not user or not user.id:
        raise RuntimeError(f"Failed to create auth user for {s['email']}: {res}")
    return user.id


def seed_student(sb, s: dict, mentor_id: str) -> dict:
    student_id = create_auth_user(sb, s)

    sb.table("profiles").update(
        {
            "role": "student",
            "full_name": s["full_name"],
            "email": s["email"],
            "age": s["age"],
            "gender": s["gender"],
            "bio": s["bio"],
            "whatsapp": s["whatsapp"].replace("+", "").replace(" ", ""),
            "instagram": s["instagram"].replace("https://instagram.com/", ""),
            "onboarding_completed": True,
            "mentor_id": mentor_id,
            "billing_exempt": True,
            "is_one_to_one": True,
            "internal_notes": s["internal_notes"],
        }
    ).eq("id", student_id).execute()

    # Onboarding submission
    existing_ob = (
        sb.table("tally_submissions")
        .select("id")
        .eq("student_id", student_id)
        .eq("submission_kind", "onboarding")
        .neq("status", "archived")
        .limit(1)
        .execute()
        .data
    )
    if not existing_ob:
        response_id = str(uuid.uuid4())
        answers = answers_payload(s, student_id)
        payload = {
            "eventId": f"seed:{response_id}",
            "eventType": "FORM_RESPONSE",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "data": {
                "responseId": response_id,
                "submissionId": response_id,
                "formId": ONBOARDING_FORM_ID,
                "formName": ONBOARDING_FORM_NAME,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "fields": answers,
                "student_id": student_id,
            },
            "seed": "test_students_v1",
        }
        sb.table("tally_submissions").insert(
            {
                "source": "native",
                "source_event_id": f"seed:{response_id}",
                "source_response_id": response_id,
                "source_submission_id": response_id,
                "source_form_id": ONBOARDING_FORM_ID,
                "source_form_name": ONBOARDING_FORM_NAME,
                "submission_kind": "onboarding",
                "status": "linked",
                "respondent_name": s["full_name"],
                "respondent_email": s["email"],
                "student_id": student_id,
                "notes": "[TESTE] seed onboarding",
                "answers": answers,
                "payload": payload,
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

    brief_id = upsert_brief(
        sb,
        student_id=student_id,
        name=s["full_name"],
        shell=s,
        mentor_id=mentor_id,
    )

    return {
        "id": student_id,
        "name": s["full_name"],
        "email": s["email"],
        "brief_id": brief_id,
    }


def main() -> None:
    if not os.getenv("SUPABASE_URL") and not os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
        raise SystemExit("Missing SUPABASE_URL")
    sb = get_supabase()
    mentor_id = MENTOR_ID

    created = []
    for s in STUDENTS:
        info = seed_student(sb, s, mentor_id)
        created.append(info)
        print(f"OK  {info['name']}  {info['id']}  brief={info['brief_id']}")

    for shell in EXISTING_BRIEFS:
        rows = (
            sb.table("profiles")
            .select("id, full_name")
            .eq("role", "student")
            .ilike("full_name", f"%{shell['match_name'].split()[0]}%")
            .execute()
            .data
            or []
        )
        match = next(
            (r for r in rows if shell["match_name"].lower() in (r.get("full_name") or "").lower()),
            None,
        )
        if not match:
            print(f"SKIP existing brief — not found: {shell['match_name']}")
            continue
        if shell.get("skip_if_brief_exists"):
            has = (
                sb.table("student_briefs")
                .select("id")
                .eq("student_id", match["id"])
                .limit(1)
                .execute()
                .data
            )
            if has:
                print(f"SKIP {match['full_name']} — brief already exists")
                continue
        bid = upsert_brief(
            sb,
            student_id=match["id"],
            name=match["full_name"],
            shell=shell,
            mentor_id=mentor_id,
        )
        print(f"BRIEF {match['full_name']} → {bid}")

    print("\n--- Resumo ---")
    print(f"Password de teste (auth): {PASSWORD}")
    print(json.dumps(created, indent=2, ensure_ascii=False))
    print(
        "\nNo Agents Hub: «Cria percurso para a Ana Ribeiro» / "
        "«Diz-me tudo sobre o Tiago Mendes» / card Criação de Percurso."
    )


if __name__ == "__main__":
    main()
