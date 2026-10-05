"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  listMyQuizAttempts,
  type QuizAttemptSummary,
} from "@/lib/actions/quiz";
import { mentorLevelQuizHref } from "@/lib/journey-path/level-review-url";
import { quizPassScore } from "@/lib/nodes/pass-rule";
import { cn } from "@/lib/utils";

const OPEN_QUIZ_LINK_CLASS =
  "neuma-quiz-cta group relative z-10 flex h-auto w-full items-center justify-center rounded-2xl " +
  "border border-white/10 bg-[var(--neuma-coral)] px-5 py-4 sm:py-[1.125rem] " +
  "font-heading text-base font-semibold tracking-tight text-white sm:text-lg " +
  "shadow-[inset_0_1px_0_0_oklch(1_0_0/18%)] " +
  "hover:bg-[color-mix(in_oklch,var(--neuma-coral)_92%,black)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35";

/** Clip só o brilho interior — não o drop-shadow do CTA. */
const OPEN_QUIZ_SHINE_CLASS =
  "pointer-events-none absolute inset-0 overflow-hidden rounded-2xl";

const OPEN_QUIZ_SHINE_INNER_CLASS =
  "absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/14 to-transparent";

function OpenQuizShine() {
  return (
    <span aria-hidden className={OPEN_QUIZ_SHINE_CLASS}>
      <span className={OPEN_QUIZ_SHINE_INNER_CLASS} />
    </span>
  );
}

export function CheckpointQuiz({
  nodeId,
  quizGate = false,
  passScore = null,
  preview = false,
  pathId,
  phase = null,
}: {
  nodeId: string;
  quizGate?: boolean;
  passScore?: number | null;
  /** Mentor Studio: link to full-page preview (not student /path). */
  preview?: boolean;
  /** Required when preview — Studio journey path id. */
  pathId?: string;
  /** Quiz closes a phase; `pendingReview` > 0 locks it after a failed attempt. */
  phase?: { label: string; reviewCount: number; pendingReview: number } | null;
}) {
  const [lastAttempt, setLastAttempt] = useState<QuizAttemptSummary | null>(
    null,
  );

  useEffect(() => {
    if (preview) return;
    void listMyQuizAttempts(nodeId)
      .then((rows) => setLastAttempt(rows[0] ?? null))
      .catch(() => setLastAttempt(null));
  }, [nodeId, preview]);

  if (preview) {
    const href = pathId ? mentorLevelQuizHref(pathId, nodeId) : null;
    return (
      <div className="space-y-3">
        <div className="neuma-quiz-cta-host neuma-quiz-cta-host--inset">
          {href ? (
            <Link href={href} className={OPEN_QUIZ_LINK_CLASS}>
              <OpenQuizShine />
              <span className="relative z-10">Responder ao Quiz</span>
            </Link>
          ) : (
            <span className={OPEN_QUIZ_LINK_CLASS} aria-disabled>
              <OpenQuizShine />
              <span className="relative z-10">Responder ao Quiz</span>
            </span>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Vista do mentor — o aluno abre o quiz numa página própria
          {quizGate
            ? ` e precisa de ${quizPassScore(passScore)}% para avançar.`
            : ". A nota não bloqueia o percurso."}
          {phase
            ? ` Fecha a ${phase.label}: se falhar, revê os ${phase.reviewCount} níveis da fase antes de repetir.`
            : ""}
        </p>
      </div>
    );
  }

  if (phase && phase.pendingReview > 0) {
    return (
      <div className="space-y-3">
        <div className="neuma-quiz-cta-host">
          <span
            aria-disabled
            className={cn(OPEN_QUIZ_LINK_CLASS, "pointer-events-none opacity-45 saturate-50")}
          >
            <OpenQuizShine />
            <span className="relative z-10">Abrir quiz</span>
          </span>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {phase.pendingReview === 1
            ? "Falta rever 1 nível para repetir o quiz."
            : `Faltam rever ${phase.pendingReview} níveis para repetir o quiz.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="neuma-quiz-cta-host">
        <Link href={`/path/${nodeId}/quiz`} className={OPEN_QUIZ_LINK_CLASS}>
          <OpenQuizShine />
          <span className="relative z-10">Abrir quiz</span>
        </Link>
      </div>
      {phase ? (
        <p className="text-center text-xs text-muted-foreground">
          {lastAttempt
            ? `Última nota: ${lastAttempt.score}% — precisas de ${quizPassScore(passScore)}% para fechar a ${phase.label}.`
            : `Este check-point fecha a ${phase.label}. Precisas de ${quizPassScore(passScore)}% — se não passares, revês os ${phase.reviewCount} níveis da fase antes de repetir.`}
        </p>
      ) : lastAttempt ? (
        <p className="text-center text-xs text-muted-foreground">
          Última nota: {lastAttempt.score}% ({lastAttempt.correct_count}/
          {lastAttempt.total})
          {quizGate
            ? ` — precisas de ${quizPassScore(passScore)}% para avançar.`
            : " — podes repetir quando quiseres. O quiz não bloqueia o percurso."}
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {quizGate
            ? `Responde ao quiz. A nota ≥ ${quizPassScore(passScore)}% desbloqueia o nível seguinte.`
            : "Responde ao quiz quando estiveres pronto. A nota é automática e não bloqueia o avanço."}
        </p>
      )}
    </div>
  );
}
