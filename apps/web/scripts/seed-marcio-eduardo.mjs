#!/usr/bin/env node
/**
 * Seed student briefs + path draft proposals for Márcio and Eduardo.
 * Does NOT create login accounts — paths stay unassigned until claim.
 *
 * Usage: node apps/web/scripts/seed-marcio-eduardo.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(webRoot, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      }
    }
  }
}
loadEnv();

const EDUARDO_MD = `### 🗺️ ROTA DE TRANSFORMAÇÃO: EDUARDO

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
* Nível 12 | Conquista — Performance completa`;

const MARCIO_MD = `### 🗺️ ROTA DE TRANSFORMAÇÃO: MÁRCIO

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
* Nível 12 | Conquista — Tema/loop produzido`;

function eduardoNodes() {
  return [
    { title: "A Lógica das Escalas Maiores & Menores", kind: "lesson", order_index: 1, description: "Estrutura de tons/semitons e visualização geométrica das teclas." },
    { title: "Fluidez em 3 Tons-Chave (C, G, D)", kind: "practice", order_index: 2, description: "Gravação: campo harmónico e inversões básicas sem hesitar." },
    { title: "Círculo de Quintas no Piano", kind: "lesson", order_index: 3, description: "Transpor qualquer música de louvor para o tom correcto." },
    { title: "Check-point — Progressão em 2 tons", kind: "milestone", order_index: 4, description: "Vídeo a tocar progressão completa em 2 tons escolhidos pelo mentor." },
    { title: "Leitura Rítmica Essencial", kind: "lesson", order_index: 5, description: "Divisão de tempos, ligaduras e coordenação no teclado." },
    { title: "Mão Esquerda vs Mão Direita", kind: "practice", order_index: 6, description: "Padrão rítmico com ligaduras e metrónomo." },
    { title: "Modos Gregos na Prática de Louvor", kind: "lesson", order_index: 7, description: "Dórico, Lídio e Mixolídio para atmosferas." },
    { title: "Sessão 1:1 — Modos e técnica", kind: "call", order_index: 8, description: "Tirar dúvidas e ajustar postura/execução ao vivo." },
    { title: "Introdução à DAW & Timbres", kind: "lesson", order_index: 9, description: "Pianos de cauda, PADS e Synths para Worship." },
    { title: "Patch/Preset para Louvor", kind: "practice", order_index: 10, description: "Demonstração do som criado + execução sobre backing track." },
    { title: "Mixagem e Frequências no Piano", kind: "lesson", order_index: 11, description: "Como não atropelar Baixo e Guitarra na igreja." },
    { title: "Conquista — Performance completa", kind: "milestone", order_index: 12, description: "Performance de música de igreja com timbre próprio." },
  ];
}

function marcioNodes() {
  return [
    { title: "Descodificar o Braço da Guitarra", kind: "lesson", order_index: 1, description: "Oitavas, intervalos e localização a partir das cordas 6 e 5." },
    { title: "Tríades e Tétrades do Zero", kind: "practice", order_index: 2, description: "Mesma tétrade em 3 zonas sem pestana tradicional." },
    { title: "Anatomia dos Voicings & Extensões", kind: "lesson", order_index: 3, description: "9ªs, 11ªs e 13ªs conscientes para produção." },
    { title: "Check-point — Voicings sofisticados", kind: "milestone", order_index: 4, description: "3 variações de voicings para o mesmo ciclo." },
    { title: "Funções Harmónicas & Campo Harmónico", kind: "lesson", order_index: 5, description: "Tónica, subdominante, dominante." },
    { title: "Estudo Bossa Nova / Neo-Soul", kind: "practice", order_index: 6, description: "Gravar voicings e progressão característica." },
    { title: "Escalas com Intenção", kind: "lesson", order_index: 7, description: "Pentatónicas, CAGED e modos para consciência melódica." },
    { title: "Sessão 1:1 — Alinhamento harmónico", kind: "call", order_index: 8, description: "Análise dos voicings e refinamento do tacto." },
    { title: "Guitarra + Beatmaking", kind: "lesson", order_index: 9, description: "Sampling, looping e texturas no MPC." },
    { title: "Arranjo para Igreja / Lo-Fi", kind: "practice", order_index: 10, description: "Harmonia com inversões e extensões sobre pad." },
    { title: "Cadeia de Sinal & Timbre", kind: "lesson", order_index: 11, description: "Pedais, amps e encaixe na mistura." },
    { title: "Conquista — Tema/loop produzido", kind: "milestone", order_index: 12, description: "Guitarra com voicings conscientes e aplicação harmónica." },
  ];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: mentors, error: mErr } = await sb
    .from("profiles")
    .select("id")
    .eq("role", "mentor")
    .limit(1);
  if (mErr) throw mErr;
  const mentorId = mentors?.[0]?.id;
  if (!mentorId) throw new Error("No mentor profile found");

  for (const student of [
    {
      name: "Eduardo",
      md: EDUARDO_MD,
      nodes: eduardoNodes(),
      goal: "Autonomia no piano e fluência em todos os tons para ministério de louvor",
    },
    {
      name: "Márcio",
      md: MARCIO_MD,
      nodes: marcioNodes(),
      goal: "Consciência teórica do braço para produção e igreja",
    },
  ]) {
    const { data: brief, error: bErr } = await sb
      .from("student_briefs")
      .insert({
        placeholder_name: student.name,
        raw_markdown: student.md,
        structured: { source: "seed" },
        source: "imported",
        created_by: mentorId,
      })
      .select("id")
      .single();
    if (bErr) throw bErr;

    const { data: proposal, error: pErr } = await sb
      .from("agent_proposals")
      .insert({
        kind: "path_draft",
        status: "pending",
        title: `Percurso ${student.name}`,
        summary: `${student.nodes.length} níveis · rascunho do Agent`,
        mentor_id: mentorId,
        payload: {
          title: `Percurso ${student.name}`,
          placeholder_name: student.name,
          goal: student.goal,
          description: `Rota de transformação para ${student.name}`,
          status: "draft",
          brief_id: brief.id,
          nodes: student.nodes,
        },
        target_table: "paths",
      })
      .select("id")
      .single();
    if (pErr) throw pErr;

    console.log(`OK ${student.name}: brief=${brief.id} proposal=${proposal.id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
