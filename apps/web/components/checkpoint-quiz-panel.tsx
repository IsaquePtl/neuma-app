"use client";

import { CheckpointQuizForm } from "@/components/checkpoint-quiz-form";
import type {
  QuizAttemptSummary,
  QuizOption,
} from "@/lib/actions/quiz";
import { cn } from "@/lib/utils";

type StudentQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
};

const QUIZ_VIEWPORT =
  "neuma-mobile-viewport relative flex w-full flex-col justify-center gap-5 overflow-y-auto pb-8 " +
  "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4";

export function CheckpointQuizPanel({
  nodeId,
  nodeTitle,
  pathTitle,
  levelNumber,
  initialLastAttempt = null,
  questions,
}: {
  nodeId: string;
  nodeTitle: string;
  pathTitle?: string | null;
  levelNumber: number;
  initialLastAttempt?: QuizAttemptSummary | null;
  questions: StudentQuestion[];
}) {
  const levelHref = `/path/${nodeId}`;

  return (
    <div className={QUIZ_VIEWPORT}>
      <div className="flex w-full flex-col gap-5">
        <header className="shrink-0 space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Quiz
          </p>
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                "student-path-marker relative grid size-14 shrink-0 place-items-center rounded-full",
                "neuma-gradient text-base font-semibold tabular-nums text-white",
                "shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]",
              )}
              aria-hidden
            >
              {levelNumber}
            </span>
            <div className="min-w-0 space-y-0.5">
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                {nodeTitle}
              </h1>
              {pathTitle?.trim() ? (
                <p className="text-sm leading-tight text-muted-foreground/80">
                  {pathTitle.trim()}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {questions.length > 0 ? (
          <CheckpointQuizForm
            nodeId={nodeId}
            levelHref={levelHref}
            questions={questions}
            initialLastAttempt={initialLastAttempt}
          />
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            O mentor ainda não configurou o quiz deste nível. Volta mais tarde
            ou continua o percurso.
          </p>
        )}
      </div>
    </div>
  );
}
