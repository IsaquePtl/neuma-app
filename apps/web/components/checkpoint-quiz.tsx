"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  listMyQuizAttempts,
  type QuizAttemptSummary,
} from "@/lib/actions/quiz";

const OPEN_QUIZ_LINK_CLASS =
  "neuma-quiz-cta neuma-accent-top group relative z-10 flex h-auto w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--neuma-coral)]/25 bg-[var(--neuma-coral)] px-5 py-4 text-black sm:py-[1.125rem] font-heading text-base font-semibold tracking-tight sm:text-lg shadow-[0_1px_0_0_oklch(1_0_0/22%)_inset] desktop:overflow-visible desktop:shadow-[0_1px_0_0_oklch(1_0_0/22%)_inset,0_0_32px_-6px_color-mix(in_oklch,var(--neuma-coral)_50%,transparent)] transition-[transform,box-shadow,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--neuma-coral)]/40 hover:bg-[color-mix(in_oklch,var(--neuma-coral)_90%,white)] desktop:hover:shadow-[0_1px_0_0_oklch(1_0_0/28%)_inset,0_0_40px_-4px_color-mix(in_oklch,var(--neuma-coral)_60%,transparent)] active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50";

const OPEN_QUIZ_INNER_GLOW_CLASS =
  "pointer-events-none absolute inset-0 scale-110 rounded-2xl bg-[color-mix(in_oklch,var(--neuma-coral)_55%,white)] opacity-70 blur-2xl desktop:hidden";

export function CheckpointQuiz({ nodeId }: { nodeId: string }) {
  const [lastAttempt, setLastAttempt] = useState<QuizAttemptSummary | null>(
    null,
  );

  useEffect(() => {
    void listMyQuizAttempts(nodeId)
      .then((rows) => setLastAttempt(rows[0] ?? null))
      .catch(() => setLastAttempt(null));
  }, [nodeId]);

  return (
    <div className="space-y-3">
      <div className="neuma-quiz-cta-host">
        <Link href={`/path/${nodeId}/quiz`} className={OPEN_QUIZ_LINK_CLASS}>
          <span aria-hidden className={OPEN_QUIZ_INNER_GLOW_CLASS} />
          <span className="relative z-10">Abrir quiz</span>
        </Link>
      </div>
      {lastAttempt ? (
        <p className="text-center text-xs text-muted-foreground">
          Última nota: {lastAttempt.score}% ({lastAttempt.correct_count}/
          {lastAttempt.total}) — podes repetir quando quiseres. O quiz não
          bloqueia o percurso.
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Responde ao quiz quando estiveres pronto. A nota é automática e não
          bloqueia o avanço.
        </p>
      )}
    </div>
  );
}
