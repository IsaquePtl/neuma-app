"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import {
  getQuizForStudent,
  listMyQuizAttempts,
  submitQuizAttempt,
  type QuizAttemptSummary,
  type QuizOption,
} from "@/lib/actions/quiz";
import { Button } from "@/components/ui/button";

type StudentQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
};

export function CheckpointQuiz({ nodeId }: { nodeId: string }) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<QuizAttemptSummary | null>(null);
  const [lastAttempt, setLastAttempt] = useState<QuizAttemptSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void listMyQuizAttempts(nodeId)
      .then((rows) => setLastAttempt(rows[0] ?? null))
      .catch(() => setLastAttempt(null));
  }, [nodeId]);

  async function openQuiz() {
    setLoading(true);
    setResult(null);
    setAnswers({});
    setIndex(0);
    try {
      const { questions: qs } = await getQuizForStudent(nodeId);
      if (!qs.length) {
        toast.message("O mentor ainda não configurou o quiz deste nível.");
        return;
      }
      setQuestions(qs);
      setOpen(true);
    } catch {
      toast.error("Não foi possível abrir o quiz");
    } finally {
      setLoading(false);
    }
  }

  function closeQuiz() {
    setOpen(false);
  }

  function submit() {
    startTransition(async () => {
      try {
        const attempt = await submitQuizAttempt(nodeId, answers);
        setResult(attempt);
        setLastAttempt(attempt);
      } catch {
        toast.error("Não foi possível guardar a tentativa");
      }
    });
  }

  const current = questions[index];
  const isLast = index >= questions.length - 1;
  const allAnswered =
    questions.length > 0 && questions.every((q) => Boolean(answers[q.id]));

  return (
    <>
      <div className="space-y-3">
        <Button
          type="button"
          size="lg"
          className="w-full gap-2 bg-[var(--neuma-coral)] text-black hover:bg-[var(--neuma-coral)]/90"
          onClick={() => void openQuiz()}
          disabled={loading}
        >
          <Sparkles className="size-4" />
          {loading ? "A carregar…" : "Abrir quiz"}
        </Button>
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

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0c0e] text-foreground">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-medium">
              {result
                ? "Resultado"
                : `Pergunta ${index + 1} de ${questions.length}`}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar quiz"
              onClick={closeQuiz}
            >
              <X className="size-5" />
            </Button>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            {result ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
                  Check-point
                </p>
                <p className="text-5xl font-semibold tracking-tight">
                  {result.score}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Acertaste {result.correct_count} de {result.total} perguntas.
                </p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  O mentor valida a passagem de nível. Podes fechar e continuar
                  o percurso.
                </p>
                <Button type="button" onClick={closeQuiz} className="mt-2">
                  Fechar
                </Button>
              </div>
            ) : current ? (
              <div className="flex flex-1 flex-col">
                <div className="flex flex-1 items-stretch overflow-x-auto snap-x snap-mandatory">
                  <div className="flex w-full shrink-0 snap-center flex-col justify-center gap-6 px-5 py-8 sm:px-10">
                    <p className="text-lg font-medium leading-snug sm:text-xl">
                      {current.prompt}
                    </p>
                    <div className="space-y-2">
                      {current.options.map((opt) => {
                        const selected = answers[current.id] === opt.id;
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
                            className={
                              selected
                                ? "w-full rounded-xl border border-[var(--neuma-coral)]/50 bg-[var(--neuma-coral)]/15 px-4 py-3 text-left text-sm"
                                : "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm transition-colors hover:bg-white/[0.07]"
                            }
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="size-4" /> Anterior
                  </Button>
                  {!isLast ? (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1"
                      disabled={!answers[current.id]}
                      onClick={() =>
                        setIndex((i) =>
                          Math.min(questions.length - 1, i + 1),
                        )
                      }
                    >
                      Seguinte <ChevronRight className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!allAnswered || pending}
                      onClick={submit}
                    >
                      {pending ? "A enviar…" : "Ver resultado"}
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
