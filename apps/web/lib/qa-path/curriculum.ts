import type { NodeKind, NodePassRule } from "../types/database.types";

/** Keep in sync with DEFAULT_QUIZ_PASS_SCORE in pass-rule.ts. */
const QA_QUIZ_PASS_SCORE = 60;

export const QA_TEMPLATE_TITLE = "QA — Percurso Completo";
export const QA_CATEGORY_NAME = "QA Teste";
export const QA_CATEGORY_SLUG = "qa-teste";
export const QA_TOPIC_NAME = "Stubs";
export const QA_TOPIC_SLUG = "stubs";

export const ANA_EMAIL = "ana.ribeiro.teste@neuma.test";
export const ANA_NAME = "Ana Ribeiro";
export const ANA_PASSWORD = "neuma123";

export const QA_STUB_VIDEO_LESSON =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
export const QA_STUB_VIDEO_PRACTICE =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";
export const QA_STUB_TEXT_BODY =
  "Stub de texto QA. Placeholder — substitui pelo conteúdo real da biblioteca quando existir.";

export type QaAssetKey = "video_lesson" | "video_practice" | "text";

export type QaCheckInKind = "video" | "text" | null;

export type QaQuizQuestion = {
  prompt: string;
  options: { id: string; label: string }[];
  correct_option_id: string;
};

export type QaNodeDef = {
  code: string;
  kind: Extract<NodeKind, "lesson" | "practice" | "milestone" | "call" | "resource">;
  passRule: NodePassRule;
  checkInKind: QaCheckInKind;
  phaseKey: "A" | "B";
  durationWeeks: number;
  asset: QaAssetKey | null;
  title: string;
  description: string;
  quiz?: QaQuizQuestion[];
};

function mc(
  prompt: string,
  options: [string, string, string?],
  correctIndex: 0 | 1 | 2,
): QaQuizQuestion {
  const parsed = options
    .filter((label): label is string => Boolean(label))
    .map((label, i) => ({
      id: `o${i + 1}`,
      label,
    }));
  return {
    prompt,
    options: parsed,
    correct_option_id: parsed[correctIndex]?.id ?? parsed[0].id,
  };
}

/**
 * 10-node coverage table: kinds, pass_rules, check-ins, phases, quizzes, call.
 * Stubs only — no invented pedagogy.
 */
export const QA_NODES: QaNodeDef[] = [
  {
    code: "QA-L1",
    kind: "lesson",
    passRule: "none",
    checkInKind: null,
    phaseKey: "A",
    durationWeeks: 1,
    asset: "video_lesson",
    title: "QA-L1 — Aula (visto)",
    description:
      "Aula com vídeo stub. Marcar como visto avança o nível seguinte.",
  },
  {
    code: "QA-P1",
    kind: "practice",
    passRule: "check_in",
    checkInKind: "video",
    phaseKey: "A",
    durationWeeks: 1,
    asset: "video_practice",
    title: "QA-P1 — Prática (check-in vídeo)",
    description:
      "Check-in em vídeo. O mentor aprova para avançar. 1 slot + revisões.",
  },
  {
    code: "QA-P2",
    kind: "practice",
    passRule: "check_in",
    checkInKind: "text",
    phaseKey: "A",
    durationWeeks: 2,
    asset: "text",
    title: "QA-P2 — Prática (check-in texto)",
    description:
      "Check-in em texto (mentoria). Não consome o slot de vídeo. Duração 2 semanas.",
  },
  {
    code: "QA-M1",
    kind: "milestone",
    passRule: "quiz",
    checkInKind: null,
    phaseKey: "A",
    durationWeeks: 1,
    asset: null,
    title: "QA-M1 — Check-point (quiz)",
    description: `Quiz ≥ ${QA_QUIZ_PASS_SCORE}% avança sozinho.`,
    quiz: [
      mc(
        "Qual é a regra de passagem deste check-point?",
        ["Quiz", "Visto", "Check-in"],
        0,
      ),
      mc(
        "Qual é a nota mínima por omissão para avançar?",
        ["50%", "60%", "100%"],
        1,
      ),
    ],
  },
  {
    code: "QA-C1",
    kind: "call",
    passRule: "mentor",
    checkInKind: null,
    phaseKey: "A",
    durationWeeks: 1,
    asset: null,
    title: "QA-C1 — Sessão 1:1",
    description:
      "Booking Cal.com. Marcar a sessão não avança — só o mentor no Studio.",
  },
  {
    code: "QA-L2",
    kind: "lesson",
    passRule: "none",
    checkInKind: null,
    phaseKey: "B",
    durationWeeks: 2,
    asset: "video_lesson",
    title: "QA-L2 — Aula (fase B)",
    description:
      "Segunda aula e fronteira da Fase B. Duração 2 semanas. Marcar visto avança.",
  },
  {
    code: "QA-M2",
    kind: "milestone",
    passRule: "mentor",
    checkInKind: null,
    phaseKey: "B",
    durationWeeks: 1,
    asset: null,
    title: "QA-M2 — Check-point (só mentor)",
    description:
      "Checkpoint sem auto-quiz. O aluno não conclui sozinho — o mentor avança.",
  },
  {
    code: "QA-R1",
    kind: "resource",
    passRule: "none",
    checkInKind: null,
    phaseKey: "B",
    durationWeeks: 1,
    asset: "text",
    title: "QA-R1 — Recurso legado (visto)",
    description:
      "Kind `resource` (legado, tratado como aula). Texto stub, sem vídeo. Marcar visto.",
  },
  {
    code: "QA-P3",
    kind: "practice",
    passRule: "check_in",
    checkInKind: "video",
    phaseKey: "B",
    durationWeeks: 2,
    asset: "video_practice",
    title: "QA-P3 — Prática (2.º vídeo / revisão)",
    description:
      "Segundo check-in vídeo. Testa slot esgotado, needs_revision e week_extensions.",
  },
  {
    code: "QA-END",
    kind: "milestone",
    passRule: "quiz",
    checkInKind: null,
    phaseKey: "B",
    durationWeeks: 1,
    asset: null,
    title: "QA-END — Fechar percurso",
    description:
      "Último nível. Quiz ≥ 60% conclui o percurso (status completed).",
    quiz: [
      mc(
        "O que acontece ao passar o último nível?",
        [
          "O percurso fica completed",
          "Abre um nível extra",
          "O path volta a draft",
        ],
        0,
      ),
      mc(
        "Quem avança um nível com regra Mentor?",
        ["O mentor no Studio", "O aluno sozinho", "O quiz automático"],
        0,
      ),
    ],
  },
];

export const QA_TEMPLATE_GOAL =
  "Percurso de QA: cobre kinds, pass_rules, check-ins vídeo/texto, fases A/B, quizzes e sessão 1:1. Stubs de conteúdo.";

export const QA_TEMPLATE_DESCRIPTION =
  "Template de teste para Ana Ribeiro. Não activa percursos beta (Eduardo/Márcio/Bernardo).";

export function qaNodeTitle(node: QaNodeDef): string {
  return node.title.trim();
}

export function flattenQaNodes(): Array<QaNodeDef & { orderIndex: number }> {
  return QA_NODES.map((node, orderIndex) => ({ ...node, orderIndex }));
}
