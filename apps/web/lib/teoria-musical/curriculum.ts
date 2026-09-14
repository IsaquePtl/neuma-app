import { nodeKindLabel } from "../labels";
import type { NodeKind, NodePassRule } from "../types/database.types";
import { DEFAULT_QUIZ_PASS_SCORE } from "../nodes/pass-rule";

/** Stable slug for the library category + template lookup. */
export const TEORIA_MUSICAL_SLUG = "teoria-musical";
export const TEORIA_MUSICAL_TITLE = "Teoria Musical";

export type TeoriaNodeKind = Extract<
  NodeKind,
  "lesson" | "practice" | "milestone" | "call"
>;

export type TeoriaCheckInKind = "video" | "text" | null;

export type TeoriaNodeDef = {
  code: string;
  kind: TeoriaNodeKind;
  passRule: NodePassRule;
  /** UI only when pass_rule=check_in. Video só quando o aluno tem de tocar. */
  checkInKind: TeoriaCheckInKind;
  /** Optional Portuguese override. Default is `{code} — {kindLabel}`. */
  title?: string;
  description?: string;
};

export type TeoriaPhaseDef = {
  key: string;
  name: string;
  optional: boolean;
  nodes: TeoriaNodeDef[];
};

const SKELETON =
  "Esqueleto Spec v1 — o mentor anexa o conteúdo da biblioteca.";

function lesson(code: string, description = SKELETON): TeoriaNodeDef {
  return {
    code,
    kind: "lesson",
    passRule: "none",
    checkInKind: null,
    description,
  };
}

function practice(
  code: string,
  checkInKind: Exclude<TeoriaCheckInKind, null>,
  description: string,
): TeoriaNodeDef {
  return {
    code,
    kind: "practice",
    passRule: "check_in",
    checkInKind,
    description,
  };
}

function milestone(code: string): TeoriaNodeDef {
  return {
    code,
    kind: "milestone",
    passRule: "quiz",
    checkInKind: null,
    description: `Check-point com quiz. Nota ≥ ${DEFAULT_QUIZ_PASS_SCORE}% desbloqueia o nível seguinte.`,
  };
}

function call(code: string, description = "Sessão 1:1 (cal.com / Meet)."): TeoriaNodeDef {
  return {
    code,
    kind: "call",
    passRule: "mentor",
    checkInKind: null,
    description,
  };
}

/**
 * Spec v1 tree (equipa de Música). Order and kinds are stable.
 * Portuguese titles follow existing app labels + stable codes — do not invent
 * pedagogy. Music team can rename titles in Studio without reordering.
 */
export const TEORIA_PHASES: TeoriaPhaseDef[] = [
  {
    key: "A",
    name: "Fase A",
    optional: false,
    nodes: [
      lesson("A1"),
      lesson("A2"),
      milestone("MA"),
      lesson("A3"),
      lesson("A4"),
      milestone("MB"),
      practice(
        "A5",
        "text",
        "Prática de escuta — check-in em texto (não é obrigatório tocar).",
      ),
      call("A6"),
    ],
  },
  {
    key: "B",
    name: "Fase B",
    optional: false,
    nodes: [
      lesson("B1"),
      lesson("B2"),
      lesson("B3"),
      milestone("MC"),
      practice("B4", "text", "Prática — check-in em texto."),
      call("B5", "Sessão 1:1 (opcional no Spec)."),
    ],
  },
  {
    key: "C",
    name: "Fase C",
    optional: false,
    nodes: [
      lesson("C1"),
      lesson("C2"),
      milestone("MD"),
      practice("C3", "text", "Prática — check-in em texto."),
      call("C4"),
    ],
  },
  {
    key: "D",
    name: "Fase D",
    optional: false,
    nodes: [
      lesson("D1"),
      lesson("D2"),
      lesson("D3"),
      milestone("ME"),
      practice(
        "D4",
        "video",
        "Prática a tocar — check-in em vídeo.",
      ),
      lesson("D5"),
      milestone("MF"),
      call("D6"),
    ],
  },
  {
    key: "E",
    name: "Fase E",
    optional: false,
    nodes: [
      lesson("E1"),
      milestone("MG"),
      practice("E2", "text", "Prática — check-in em texto."),
      lesson("E3"),
      lesson("E4"),
      milestone("MH"),
      practice("E5", "text", "Prática — check-in em texto."),
      call("E6"),
    ],
  },
  {
    key: "F",
    name: "Fase F",
    optional: false,
    nodes: [
      lesson("F1"),
      lesson("F2"),
      lesson("F3"),
      milestone("MI"),
      lesson("F4"),
      milestone("MJ"),
      practice("F5", "text", "Prática — check-in em texto."),
      call("F6"),
    ],
  },
  {
    key: "G",
    name: "Fase G",
    optional: false,
    nodes: [
      lesson("G1"),
      milestone("MK"),
      practice("G2", "text", "Prática — check-in em texto."),
      lesson("G3"),
      milestone("ML"),
      call("G4"),
    ],
  },
  {
    key: "H",
    name: "Fase H",
    optional: false,
    nodes: [
      lesson("H1"),
      milestone("MM"),
      practice("H2", "text", "Prática — check-in em texto."),
      practice("H3", "text", "Prática — check-in em texto."),
      call("H4"),
    ],
  },
  {
    key: "I",
    name: "Fase I (opcional)",
    optional: true,
    nodes: [
      lesson("I1"),
      lesson("I2"),
      practice("I3", "text", "Prática — check-in em texto."),
      lesson("I4"),
      practice("I5", "text", "Prática — check-in em texto."),
      call("I6"),
    ],
  },
];

export function teoriaNodeTitle(node: TeoriaNodeDef): string {
  if (node.title?.trim()) return node.title.trim();
  return `${node.code} — ${nodeKindLabel[node.kind]}`;
}

export function teoriaPhaseLabel(phaseKey: string | null | undefined): string {
  if (!phaseKey) return "";
  const phase = TEORIA_PHASES.find((p) => p.key === phaseKey);
  return phase?.name ?? `Fase ${phaseKey}`;
}

export function flattenTeoriaNodes(): Array<
  TeoriaNodeDef & { phaseKey: string; orderIndex: number }
> {
  const out: Array<TeoriaNodeDef & { phaseKey: string; orderIndex: number }> =
    [];
  let order = 0;
  for (const phase of TEORIA_PHASES) {
    for (const node of phase.nodes) {
      out.push({ ...node, phaseKey: phase.key, orderIndex: order });
      order += 1;
    }
  }
  return out;
}

const OPTION_READY = "ready";
const OPTION_WAIT = "wait";

/** Skeleton MC quiz so milestone submitQuizAttempt works before real questions. */
export function teoriaSkeletonQuiz(code: string): Array<{
  prompt: string;
  options: { id: string; label: string }[];
  correct_option_id: string;
}> {
  return [
    {
      prompt: `${code}: este check-point ainda é um esqueleto. O mentor substitui as perguntas. Selecciona «Pronto» para testar o envio.`,
      options: [
        { id: OPTION_READY, label: "Pronto" },
        { id: OPTION_WAIT, label: "Ainda não" },
      ],
      correct_option_id: OPTION_READY,
    },
    {
      prompt:
        "A nota é automática. Com regra Quiz, a nota ≥ limiar desbloqueia o nível seguinte.",
      options: [
        { id: OPTION_READY, label: "Entendi" },
        { id: OPTION_WAIT, label: "Não percebi" },
      ],
      correct_option_id: OPTION_READY,
    },
  ];
}

export const TEORIA_TEMPLATE_GOAL =
  "Percurso de Teoria Musical (fases A–H, I opcional): aulas sem check-in forçado, práticas com check-in (vídeo só quando é para tocar), check-points com quiz e sessões 1:1.";

export const TEORIA_TEMPLATE_DESCRIPTION =
  "Rascunho Spec v1 (equipa de Música). Só estrutura de nós — não toca na biblioteca live nem activa alunos.";
