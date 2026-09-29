#!/usr/bin/env node
/**
 * Drafts (não activos) para Eduardo, Márcio e Bernardo.
 * Não mexe no Samuel. Não activa paths.
 *
 * Usage: node apps/web/scripts/seed-beta-path-drafts.mjs
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
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    }
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const VIDEO = "Vídeo em gravação. O texto deste nível já está disponível.";

function lesson(title, body) {
  return {
    kind: "lesson",
    pass_rule: "none",
    check_in_kind: null,
    title,
    content_body: `${body}\n\n${VIDEO}`,
  };
}
function practice(title, body) {
  return {
    kind: "practice",
    pass_rule: "check_in",
    check_in_kind: "text",
    title,
    content_body: body,
  };
}
function milestone(title, prompt) {
  return {
    kind: "milestone",
    pass_rule: "quiz",
    check_in_kind: null,
    title,
    content_body: prompt,
    quiz: [
      {
        prompt,
        options: ["Ainda não", "Li e consigo explicar", "Quero rever com o mentor"],
        correct: 1,
      },
    ],
  };
}
function call(title) {
  return {
    kind: "call",
    pass_rule: "mentor",
    check_in_kind: null,
    title,
    content_body: "Sessão contigo. O mentor avança este nível depois da call.",
  };
}

const PATHS = [
  {
    match: "Eduardo",
    title: "Eduardo — Harmonia e igreja",
    goal: "Consolidação harmónica, teoria e arranjo para o contexto de igreja.",
    phases: [
      {
        key: "A",
        nodes: [
          lesson(
            "Campo harmónico maior e menor",
            "Análise funcional (I, IV, V, vi) e tétrades. Inversões e voice leading.",
          ),
          lesson(
            "Modos gregos aplicados",
            "Dórico, Mixolídio e Lídio em música de adoração. Atmosferas e pads.",
          ),
          lesson(
            "Empréstimo harmónico e dominantes secundários",
            "iv, bVI, bVII e dominantes secundários com resolução.",
          ),
          milestone(
            "Check-point — fundamentos harmónicos",
            "Consegues nomear a função de I, IV, V e um dominante secundário?",
          ),
          practice(
            "Aplicar uma progressão de igreja",
            "Escreve uma progressão de 8 compassos com uma tétrade e um empréstimo. Texto, sem vídeo.",
          ),
        ],
      },
      {
        key: "B",
        nodes: [
          lesson(
            "Tensões e extensões",
            "9ª, 11ª, 13ª. Open voicings, drop 2 e drop 3. Tónica no baixo.",
          ),
          lesson(
            "Reharmonização de cânticos",
            "Substituições, diminutos de passagem e sus. Contemplação versus clímax.",
          ),
          lesson(
            "Transições e modulações",
            "Modulação directa, pivot e meio tom. Pontes sem quebrar o ambiente.",
          ),
          milestone(
            "Check-point — reharmonização",
            "Consegues trocar um acorde simples por uma extensão sem perder a função?",
          ),
          practice(
            "Reharmonizar um trecho",
            "Escolhe 4 compassos de um cântico e escreve a cifra nova, com uma nota sobre a dinâmica.",
          ),
        ],
      },
      {
        key: "C",
        nodes: [
          lesson(
            "Design de som",
            "Shimmer, delay ambiente e camadas na DAW. Vídeo deste nível fica para gravação.",
          ),
          lesson(
            "Cifra dinâmica e banda",
            "Nashville Number System e comunicação do arranjo ao vivo.",
          ),
          milestone(
            "Check-point — produção e cifra",
            "Consegues ler um trecho em números e dizer onde entra o ambiente?",
          ),
          call("Sessão — fecho do bloco"),
        ],
      },
    ],
  },
  {
    match: "Márcio",
    title: "Márcio — Braço e sonoridade",
    goal: "Mapa do braço, voicings e guitarra dentro da produção.",
    phases: [
      {
        key: "A",
        nodes: [
          lesson(
            "Notas e intervalos no braço",
            "3ªs, 5ªs, 7ªs e 9ªs a partir de qualquer tónica. String skipping e CAGED.",
          ),
          lesson(
            "Tríades e inversões",
            "Maiores, menores, aumentadas e diminuídas nos conjuntos 1-2-3, 2-3-4 e 3-4-5.",
          ),
          milestone(
            "Check-point — mapa do braço",
            "Consegues achar a 3ª e a 7ª de uma tónica sem olhar para um diagrama?",
          ),
          practice(
            "Localizar intervalos",
            "Escreve, para a tónica que escolheres, onde estão a 3ª e a 7ª em duas cordas. Texto.",
          ),
        ],
      },
      {
        key: "B",
        nodes: [
          lesson(
            "Tétrades e voicings",
            "Acordes sem tónica, drop 2 e clusters. Construção por intervalos.",
          ),
          lesson(
            "Modos e timbre",
            "Pentatónicas com empréstimo. Diminuta e hexatónica para tensão.",
          ),
          milestone(
            "Check-point — voicings",
            "Consegues montar um voicing sem a tónica e dizer que tensão acrescentaste?",
          ),
          practice(
            "Um voicing novo",
            "Descreve um voicing de 4 notas (cordas e trastes) e para que momento da música serve.",
          ),
        ],
      },
      {
        key: "C",
        nodes: [
          lesson(
            "Guitarra no estúdio",
            "Captadores, frequência no mix, simulação de amp, double tracking.",
          ),
          lesson(
            "Efeitos e edição",
            "Chorus, tremolo, phaser, delay. Alinhamento e escolha de take.",
          ),
          milestone(
            "Check-point — produção",
            "Consegues dizer onde a guitarra se senta no mix e que efeito abre o espaço?",
          ),
          call("Sessão — fecho do bloco"),
        ],
      },
    ],
  },
  {
    match: "Bernardo",
    title: "Bernardo — Da mesa para a guitarra",
    goal: "Guitarra a partir do ouvido de DJ: ritmo, cifras e camadas.",
    phases: [
      {
        key: "A",
        nodes: [
          lesson(
            "Mãos, ritmo e palhetada",
            "Postura, digitação e divisão em 8ªs e 16ªs, ligada ao grid e ao BPM.",
          ),
          lesson(
            "Cifras, abertos e power chords",
            "E, A, D, C, G. Power chords e progressões de pop/rock.",
          ),
          milestone(
            "Check-point — primeiros acordes",
            "Consegues ler E, A, D, C e G e dizer qual é maior ou menor?",
          ),
          practice(
            "Uma progressão de 4 acordes",
            "Escreve uma progressão com abertos e o ritmo (8ªs ou 16ªs). Texto, sem vídeo.",
          ),
        ],
      },
      {
        key: "B",
        nodes: [
          lesson(
            "Frequência da guitarra",
            "Médios e agudos face a baixo e bateria. Rhythm guitar com a percussão.",
          ),
          lesson(
            "Pentatónica e frases",
            "Posição 1, bends, slides, hammer-ons, pull-offs. Pergunta e resposta.",
          ),
          milestone(
            "Check-point — pentatónica",
            "Consegues nomear as notas da pentatónica menor em posição 1 de uma tónica?",
          ),
          practice(
            "Uma frase curta",
            "Descreve uma frase de 4 tempos na pentatónica (tónica e o gesto: bend, slide ou hammer).",
          ),
        ],
      },
      {
        key: "C",
        nodes: [
          lesson(
            "Loops e camadas",
            "Backing track, loop, base, riff e melodia.",
          ),
          lesson(
            "Do riff para o sample",
            "Riffs que podes reutilizar numa produção. Repertório até ao intermédio.",
          ),
          milestone(
            "Check-point — camadas",
            "Consegues separar base, riff e melodia numa ideia tua?",
          ),
          call("Sessão — fecho do bloco"),
        ],
      },
    ],
  },
];

async function findStudent(match) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "student")
    .ilike("full_name", `%${match}%`);
  if (error) throw error;
  return data ?? [];
}

async function main() {
  for (const spec of PATHS) {
    const students = await findStudent(spec.match);
    if (students.length !== 1) {
      console.log(
        `SKIP ${spec.match}: ${students.length} perfis (${students.map((s) => s.full_name).join(", ")})`,
      );
      continue;
    }
    const student = students[0];
    const { data: existing } = await supabase
      .from("paths")
      .select("id, status")
      .eq("student_id", student.id)
      .eq("title", spec.title)
      .maybeSingle();
    if (existing) {
      console.log(`SKIP ${spec.title}: já existe (${existing.status})`);
      continue;
    }

    const { data: path, error: pathError } = await supabase
      .from("paths")
      .insert({
        student_id: student.id,
        title: spec.title,
        goal: spec.goal,
        status: "draft",
      })
      .select("id")
      .single();
    if (pathError) throw pathError;

    let order = 0;
    for (const phase of spec.phases) {
      for (const node of phase.nodes) {
        const { data: inserted, error: nodeError } = await supabase
          .from("nodes")
          .insert({
            path_id: path.id,
            title: node.title,
            content_body: node.content_body,
            kind: node.kind,
            pass_rule: node.pass_rule,
            check_in_kind: node.check_in_kind,
            phase_key: phase.key,
            order_index: order,
            week_number: order + 1,
            duration_weeks: 1,
            status: "locked",
          })
          .select("id")
          .single();
        if (nodeError) throw nodeError;
        if (node.quiz) {
          const questions = node.quiz.map((q, index) => {
            const options = q.options.map((label, i) => ({
              id: `o${i}`,
              label,
            }));
            return {
              node_id: inserted.id,
              order_index: index,
              prompt: q.prompt,
              options,
              correct_option_id: options[q.correct].id,
            };
          });
          const { error: quizError } = await supabase
            .from("node_quiz_questions")
            .insert(questions);
          if (quizError) throw quizError;
        }
        order += 1;
      }
    }
    console.log(`OK draft ${spec.title} → ${student.full_name} (${order} níveis)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
