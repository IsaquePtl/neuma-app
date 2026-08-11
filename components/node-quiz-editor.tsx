"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  listQuizAttempts,
  listQuizQuestions,
  saveQuizQuestions,
  type QuizAttemptSummary,
  type QuizOption,
  type QuizQuestionInput,
} from "@/lib/actions/quiz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DraftQuestion = {
  key: string;
  id?: string;
  prompt: string;
  options: QuizOption[];
  correct_option_id: string;
};

function newOption(): QuizOption {
  return { id: crypto.randomUUID(), label: "" };
}

function emptyQuestion(): DraftQuestion {
  const a = newOption();
  const b = newOption();
  return {
    key: crypto.randomUUID(),
    prompt: "",
    options: [a, b],
    correct_option_id: a.id,
  };
}

export function NodeQuizEditor({ nodeId }: { nodeId: string }) {
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [attempts, setAttempts] = useState<QuizAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qs, atts] = await Promise.all([
        listQuizQuestions(nodeId),
        listQuizAttempts(nodeId),
      ]);
      setQuestions(
        qs.length
          ? qs.map((q) => ({
              key: q.id,
              id: q.id,
              prompt: q.prompt,
              options:
                q.options.length >= 2
                  ? q.options
                  : [...q.options, newOption(), newOption()].slice(0, 2),
              correct_option_id: q.correct_option_id,
            }))
          : [emptyQuestion()],
      );
      setAttempts(atts);
    } catch {
      toast.error("Nao foi possivel carregar o quiz");
      setQuestions([emptyQuestion()]);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) =>
      prev.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    );
  }

  function updateOption(qKey: string, optId: string, label: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key !== qKey
          ? q
          : {
              ...q,
              options: q.options.map((o) =>
                o.id === optId ? { ...o, label } : o,
              ),
            },
      ),
    );
  }

  function onSave() {
    const payload: QuizQuestionInput[] = questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      correct_option_id: q.correct_option_id,
    }));
    startTransition(async () => {
      try {
        await saveQuizQuestions(nodeId, payload);
        toast.success("Quiz guardado");
        await load();
      } catch {
        toast.error("Nao foi possivel guardar o quiz");
      }
    });
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">A carregar quiz…</p>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div>
        <p className="text-sm font-medium">Quiz do check-point</p>
        <p className="text-xs text-muted-foreground">
          Escolha múltipla com nota automática. Não bloqueia o percurso — tu
          validas a passagem de nível.
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div
            key={q.key}
            className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <Label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <GripVertical className="size-3.5 opacity-50" />
                Pergunta {qi + 1}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Remover pergunta"
                disabled={questions.length <= 1}
                onClick={() =>
                  setQuestions((prev) => prev.filter((x) => x.key !== q.key))
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <Textarea
              value={q.prompt}
              onChange={(e) =>
                updateQuestion(q.key, { prompt: e.target.value })
              }
              rows={2}
              placeholder="Enunciado da pergunta…"
            />
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.key}`}
                    checked={q.correct_option_id === opt.id}
                    onChange={() =>
                      updateQuestion(q.key, { correct_option_id: opt.id })
                    }
                    className="size-4 accent-[var(--neuma-coral)]"
                    aria-label={`Marcar opção ${oi + 1} como correta`}
                  />
                  <Input
                    value={opt.label}
                    onChange={(e) =>
                      updateOption(q.key, opt.id, e.target.value)
                    }
                    placeholder={`Opção ${oi + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={q.options.length <= 2}
                    aria-label="Remover opção"
                    onClick={() => {
                      const next = q.options.filter((o) => o.id !== opt.id);
                      updateQuestion(q.key, {
                        options: next,
                        correct_option_id:
                          q.correct_option_id === opt.id
                            ? next[0]?.id ?? ""
                            : q.correct_option_id,
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              {q.options.length < 6 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    updateQuestion(q.key, {
                      options: [...q.options, newOption()],
                    })
                  }
                >
                  <Plus className="size-3.5" /> Opção
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              O círculo seleccionado é a resposta correcta.
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
        >
          <Plus className="size-3.5" /> Pergunta
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={onSave}>
          {pending ? "A guardar…" : "Guardar quiz"}
        </Button>
      </div>

      {attempts.length > 0 ? (
        <div className="space-y-1.5 border-t border-white/10 pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Últimas tentativas
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {attempts.slice(0, 5).map((a) => (
              <li key={a.id}>
                {a.score}% ({a.correct_count}/{a.total}) —{" "}
                {new Date(a.created_at).toLocaleString("pt-PT")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
