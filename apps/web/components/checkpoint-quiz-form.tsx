"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  submitQuizAttempt,
  type QuizAttemptSummary,
  type QuizOption,
} from "@/lib/actions/quiz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StudentQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
};

type QuizScoreTier = "low" | "mid" | "high";

function getQuizScoreTier(score: number): QuizScoreTier {
  if (score > 85) return "high";
  if (score >= 60) return "mid";
  return "low";
}

const quizScoreTheme: Record<
  QuizScoreTier,
  {
    headline: string;
    accent: string;
    accentMuted: string;
    gradient: string;
    progress: string;
  }
> = {
  low: {
    headline: "Continua a praticar",
    accent: "text-[var(--neuma-orange)]",
    accentMuted: "text-[var(--neuma-orange)]/75",
    gradient:
      "from-[color-mix(in_oklch,var(--neuma-coral)_10%,transparent)] to-transparent",
    progress: "bg-[var(--neuma-orange)]",
  },
  mid: {
    headline: "Bom trabalho",
    accent: "text-[var(--neuma-blue)]",
    accentMuted: "text-[var(--neuma-blue)]/75",
    gradient:
      "from-[color-mix(in_oklch,var(--neuma-blue)_10%,transparent)] to-transparent",
    progress: "bg-[var(--neuma-blue)]",
  },
  high: {
    headline: "Excelente!",
    accent: "text-[var(--neuma-lime)]",
    accentMuted: "text-[var(--neuma-lime)]/75",
    gradient:
      "from-[color-mix(in_oklch,var(--neuma-lime)_10%,transparent)] to-transparent",
    progress: "bg-[var(--neuma-lime)]",
  },
};

function QuizResults({
  result,
  onClose,
}: {
  result: QuizAttemptSummary;
  onClose: () => void;
}) {
  const tier = getQuizScoreTier(result.score);
  const theme = quizScoreTheme[tier];
  const progressPct =
    result.total > 0 ? Math.round((result.correct_count / result.total) * 100) : 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[var(--neuma-ink)] px-5 py-6 sm:px-6 sm:py-7">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b",
            theme.gradient,
          )}
          aria-hidden
        />

        <div className="relative space-y-4 sm:space-y-5">
          <div className="space-y-1">
            <p
              className={cn(
                "text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl",
                theme.accent,
              )}
            >
              {result.score}%
            </p>
            <p className={cn("text-base font-semibold sm:text-lg", theme.accent)}>
              {theme.headline}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Acertaste{" "}
            <span className={cn("font-medium tabular-nums", theme.accentMuted)}>
              {result.correct_count}
            </span>{" "}
            de{" "}
            <span className="font-medium tabular-nums text-foreground/80">
              {result.total}
            </span>{" "}
            perguntas.
          </p>

          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                theme.progress,
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            O mentor valida a passagem de nível. Podes voltar ao nível e
            continuar o percurso.
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="h-8 self-start rounded-xl px-4 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
      >
        Fechar
      </Button>
    </div>
  );
}

export function CheckpointQuizForm({
  nodeId,
  levelHref,
  questions,
  initialLastAttempt = null,
}: {
  nodeId: string;
  levelHref: string;
  questions: StudentQuestion[];
  initialLastAttempt?: QuizAttemptSummary | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<QuizAttemptSummary | null>(null);
  const [pending, startTransition] = useTransition();

  function goBack() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function goNext() {
    if (!current) return;
    if (!answers[current.id]) {
      toast.error("Escolhe uma resposta antes de continuar");
      return;
    }
    setIndex((i) => Math.min(questions.length - 1, i + 1));
  }

  function submit() {
    startTransition(async () => {
      try {
        const attempt = await submitQuizAttempt(nodeId, answers);
        setResult(attempt);
      } catch {
        toast.error("Não foi possível guardar a tentativa");
      }
    });
  }

  const current = questions[index];
  const isLast = index >= questions.length - 1;
  const allAnswered =
    questions.length > 0 && questions.every((q) => Boolean(answers[q.id]));
  const canAdvance = Boolean(current && answers[current.id]);
  const canSubmit = allAnswered && !pending;

  if (result) {
    return (
      <QuizResults
        result={result}
        onClose={() => router.push(levelHref)}
      />
    );
  }

  if (!current) {
    return null;
  }

  return (
    <form
      className="flex w-full flex-col gap-6"
      onSubmit={(e) => e.preventDefault()}
    >
      {initialLastAttempt ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground">
          Última nota: {initialLastAttempt.score}% (
          {initialLastAttempt.correct_count}/{initialLastAttempt.total}) — podes
          repetir quando quiseres.
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex h-8 shrink-0 items-center justify-between gap-2">
          {index > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Pergunta anterior"
              disabled={pending}
              onClick={goBack}
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
        <div className="grid gap-2.5 sm:gap-3">
          {current.options.map((opt, optIndex) => {
            const selected = answers[current.id] === opt.id;
            const letter = String.fromCharCode(65 + optIndex);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  setAnswers((prev) => ({
                    ...prev,
                    [current.id]: opt.id,
                  }))
                }
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                  selected
                    ? "border-white/22 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.06]",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
                    selected
                      ? "bg-white/20 text-foreground"
                      : "bg-white/10 text-muted-foreground",
                  )}
                >
                  {letter}
                </span>
                <span className="min-w-0 pt-0.5 text-sm font-medium leading-snug">
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-2">
        {!isLast ? (
          <Button
            type="button"
            size="lg"
            variant="secondary"
            disabled={!canAdvance}
            onClick={goNext}
            className={cn(
              "h-11 w-full gap-2 rounded-2xl border text-sm font-medium shadow-none",
              canAdvance
                ? "border-white/22 bg-white/[0.18] text-foreground hover:bg-white/[0.24] hover:text-foreground"
                : "border-white/8 bg-white/[0.06] text-muted-foreground/70 hover:bg-white/[0.06] hover:text-muted-foreground/70",
            )}
          >
            Seguinte
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            variant="secondary"
            disabled={!canSubmit}
            onClick={submit}
            className={cn(
              "h-11 w-full gap-2 rounded-2xl border text-sm font-medium shadow-none",
              canSubmit
                ? "border-white/22 bg-white/[0.18] text-foreground hover:bg-white/[0.24] hover:text-foreground"
                : "border-white/8 bg-white/[0.06] text-muted-foreground/70 hover:bg-white/[0.06] hover:text-muted-foreground/70",
            )}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                A enviar…
              </>
            ) : (
              "Terminar"
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
