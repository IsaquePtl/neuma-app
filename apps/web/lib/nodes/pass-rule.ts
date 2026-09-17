import type {
  CheckInKind,
  NodeKind,
  NodePassRule,
} from "@/lib/types/database.types";

/** Limiar completo para pass_rule=quiz. Sem half-wiring. */
export const DEFAULT_QUIZ_PASS_SCORE = 60;

export type NodeCheckInKind = Extract<CheckInKind, "video" | "text"> | null;

const NODE_KINDS: NodeKind[] = [
  "practice",
  "lesson",
  "resource",
  "call",
  "milestone",
];

/** Unknown kinds fall back to practice so agent drafts never insert invalid enums. */
export function parseNodeKind(raw: string | null | undefined): NodeKind {
  const value = (raw ?? "").trim();
  if (NODE_KINDS.includes(value as NodeKind)) return value as NodeKind;
  return "practice";
}

export function defaultPassRule(kind: NodeKind): NodePassRule {
  if (kind === "practice") return "check_in";
  if (kind === "lesson" || kind === "resource") return "none";
  return "mentor";
}

export function parsePassRule(
  raw: string | null | undefined,
  kind: NodeKind,
): NodePassRule {
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
  kind: NodeKind,
  passRule: NodePassRule,
): NodeCheckInKind {
  if (passRule !== "check_in") return null;
  return kind === "practice" ? "video" : "text";
}

export function parseCheckInKind(
  raw: string | null | undefined,
  kind: NodeKind,
  passRule: NodePassRule,
): NodeCheckInKind {
  if (passRule !== "check_in") return null;
  const value = (raw ?? "").trim();
  if (value === "video" || value === "text") return value;
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

/** Video slot / allowance applies only to video check-ins (text = mentoria). */
export function nodeUsesVideoCheckInSlot(
  passRule: NodePassRule | null | undefined,
  checkInKind: CheckInKind | string | null | undefined,
) {
  return passRule === "check_in" && checkInKind !== "text";
}
