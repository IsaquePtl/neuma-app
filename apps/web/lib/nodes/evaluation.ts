/** Pure pass/fail rules. No I/O, so the retest can execute them directly. */

export type PassRule = "mentor" | "quiz" | "check_in" | "none";

export function quizThreshold(stored: number | null | undefined): number {
  if (typeof stored === "number" && Number.isFinite(stored)) {
    return Math.min(100, Math.max(0, Math.round(stored)));
  }
  return 60;
}

export function quizUnlocksPath(input: {
  passRule: PassRule | null | undefined;
  score: number;
  passScore: number | null | undefined;
  nodeActive: boolean;
  pathActive: boolean;
}): boolean {
  return (
    input.passRule === "quiz" &&
    input.nodeActive &&
    input.pathActive &&
    input.score >= quizThreshold(input.passScore)
  );
}

export type QuizHeadline = "low" | "mid" | "high";

/** A score under the gate's threshold is never praised. */
export function quizScoreTier(
  score: number,
  passScore: number | null | undefined,
): QuizHeadline {
  if (typeof passScore === "number" && score < passScore) return "low";
  if (score > 85) return "high";
  if (score >= 60) return "mid";
  return "low";
}

export function mentorMayComplete(input: {
  passRule: PassRule | null | undefined;
  passScore: number | null | undefined;
  bestScore: number | null;
  approvedCheckIns: number;
  mode: "advance" | "approve_check_in";
}): { ok: true } | { ok: false; reason: string } {
  if (input.passRule === "quiz") {
    const threshold = quizThreshold(input.passScore);
    if (input.bestScore == null || input.bestScore < threshold) {
      return {
        ok: false,
        reason:
          input.bestScore == null
            ? `missing attempt below ${threshold}`
            : `best ${input.bestScore} below ${threshold}`,
      };
    }
  }

  if (input.passRule === "check_in" && input.mode === "advance") {
    if (input.approvedCheckIns < 1) {
      return { ok: false, reason: "no approved check-in" };
    }
  }

  return { ok: true };
}
