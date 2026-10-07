import type {
  CheckInKind,
  NodeKind,
  NodePassRule,
} from "@/lib/types/database.types";

/** Limiar completo para pass_rule=quiz. Sem half-wiring. */
export const DEFAULT_QUIZ_PASS_SCORE = 60;

export type NodeCheckInKind = CheckInKind | null;

export function defaultPassRule(kind: NodeKind): NodePassRule {
  if (kind === "call") return "mentor";
  if (kind === "practice") return "check_in";
  if (kind === "lesson" || kind === "resource") return "none";
  if (kind === "milestone") return "quiz";
  return "mentor";
}

/**
 * Sessão não tem regra de passagem: o mentor conclui o nível.
 * O valor guardado é `mentor` para não mostrar visto, check-in nem quiz.
 */
export function effectivePassRule(
  kind: NodeKind | null | undefined,
  passRule: NodePassRule | null | undefined,
): NodePassRule {
  if (kind === "call") return "mentor";
  if (
    passRule === "mentor" ||
    passRule === "quiz" ||
    passRule === "check_in" ||
    passRule === "none"
  ) {
    return passRule;
  }
  return defaultPassRule(kind ?? "lesson");
}

export function parsePassRule(
  raw: string | null | undefined,
  kind: NodeKind,
): NodePassRule {
  if (kind === "call") return "mentor";
  const value = (raw ?? "").trim();
  if (
    value === "mentor" ||
    value === "quiz" ||
    value === "check_in" ||
    value === "none"
  ) {
    return value;
  }
  return defaultPassRule(kind);
}

export function parsePassScore(raw: string | null | undefined): number | null {
  const n = Number(raw ?? "");
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 0 || rounded > 100) return null;
  return rounded;
}

export function quizPassScore(stored: number | null | undefined): number {
  if (typeof stored === "number" && Number.isFinite(stored)) {
    return Math.min(100, Math.max(0, Math.round(stored)));
  }
  return DEFAULT_QUIZ_PASS_SCORE;
}

export function defaultCheckInKind(
  _kind: NodeKind,
  passRule: NodePassRule,
): NodeCheckInKind {
  if (passRule !== "check_in") return null;
  return "video";
}

export function parseCheckInKind(
  raw: string | null | undefined,
  kind: NodeKind,
  passRule: NodePassRule,
): NodeCheckInKind {
  if (kind === "call" || passRule !== "check_in") return null;
  const value = (raw ?? "").trim();
  if (value === "video" || value === "text" || value === "call") return value;
  return defaultCheckInKind(kind, passRule);
}

export function nodeRequiresCheckIn(passRule: NodePassRule | null | undefined) {
  return passRule === "check_in";
}

export function nodeAllowsMarkSeen(passRule: NodePassRule | null | undefined) {
  return passRule === "none";
}

export function nodeUsesQuizGate(passRule: NodePassRule | null | undefined) {
  return passRule === "quiz";
}

/** True when the level uses a video check-in (vs text/call) — only for CTA copy/UI. */
export function nodeUsesVideoCheckInSlot(
  passRule: NodePassRule | null | undefined,
  checkInKind: CheckInKind | string | null | undefined,
) {
  return passRule === "check_in" && checkInKind !== "text" && checkInKind !== "call";
}
