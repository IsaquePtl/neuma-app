"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Flag } from "lucide-react";

import type { QuizQuestion } from "@/lib/actions/quiz";
import { quizPassScore } from "@/lib/nodes/pass-rule";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Mesmo viewport centrado do check-in do aluno. */
const QUIZ_VIEWPORT =
  "neuma-mobile-viewport relative flex w-full flex-col justify-center gap-5 overflow-y-auto overscroll-contain pb-8 " +
  "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4";

export function MentorQuizPreviewPanel({
  nodeTitle,
  pathTitle,
  studentName,
  levelNumber,
  questions,
  quizGate = false,
  passScore = null,
}: {
  nodeTitle: string;
  pathTitle?: string | null;
  studentName?: string | null;
  levelNumber: number;
  questions: QuizQuestion[];
  quizGate?: boolean;
  passScore?: number | null;
}) {
  const [index, setIndex] = useState(0);
  const subtitle = [pathTitle?.trim(), studentName?.trim()]
    .filter(Boolean)
    .join(" · ");
  const current = questions[index] ?? null;
  const isLast = questions.length > 0 && index >= questions.length - 1;

  return (
    <div className={QUIZ_VIEWPORT}>
      <div className="flex w-full min-w-0 flex-col gap-5">
        <header className="shrink-0 space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Flag className="size-3.5 shrink-0" aria-hidden />
            Checkpoint
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
              {subtitle ? (
                <p className="text-sm leading-tight text-muted-foreground/80">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Respostas correctas marcadas. O aluno não vê as soluções
            {quizGate
              ? ` — precisa de ${quizPassScore(passScore)}% para avançar.`
              : "."}
          </p>
        </header>

        {questions.length === 0 || !current ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            Ainda não há perguntas neste quiz. Configura-as no editor do nível.
          </p>
        ) : (
          <div className="flex w-full flex-col gap-6">
            <section className="space-y-3">
              <div className="flex h-8 shrink-0 items-center justify-between gap-2">
                {index > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Pergunta anterior"
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                ) : (
                  <span className="size-9 shrink-0" aria-hidden />
                )}
                <p className="text-xs text-muted-foreground">
                  Pergunta {index + 1} de {questions.length}
                </p>
              </div>

              <h2 className="text-base font-semibold leading-snug sm:text-lg">
                {current.prompt}
              </h2>

              <ul className="grid gap-2.5 sm:gap-3">
                {current.options.map((option, optIndex) => {
                  const correct = option.id === current.correct_option_id;
                  const letter = String.fromCharCode(65 + optIndex);
                  return (
                    <li
                      key={option.id}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border p-4 text-left",
                        correct
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-white/10 bg-white/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
                          correct
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-white/10 text-muted-foreground",
                        )}
                      >
                        {letter}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 pt-0.5 text-sm font-medium leading-snug",
                          correct ? "text-emerald-200" : "text-muted-foreground",
                        )}
                      >
                        {option.label}
                        {correct ? (
                          <span className="ml-2 text-xs font-medium uppercase tracking-wide">
                            correcta
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className="flex flex-col gap-2">
              {!isLast ? (
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  onClick={() =>
                    setIndex((i) => Math.min(questions.length - 1, i + 1))
                  }
                  className="h-11 w-full gap-2 rounded-2xl border border-white/22 bg-white/[0.18] text-sm font-medium text-foreground shadow-none hover:bg-white/[0.24]"
                >
                  Seguinte
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Fim do quiz · {questions.length}{" "}
                  {questions.length === 1 ? "pergunta" : "perguntas"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
