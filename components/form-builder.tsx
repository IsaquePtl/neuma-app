"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addQuestion,
  deleteQuestion,
  moveQuestion,
  updateQuestion,
} from "@/lib/actions/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormQuestionType } from "@/lib/types/database.types";

const typeLabel: Record<FormQuestionType, string> = {
  short_text: "Texto curto",
  long_text: "Texto longo",
  single_choice: "Escolha unica",
  multi_choice: "Escolha multipla",
  scale: "Escala 1-5",
};

type Question = {
  id: string;
  label: string;
  help_text: string | null;
  type: FormQuestionType;
  options: unknown;
  required: boolean;
  order_index: number;
};

function optionsToText(options: unknown) {
  if (!Array.isArray(options)) return "";
  return options.map(String).join("\n");
}

function QuestionFields({
  defaults,
  showTypeHint,
}: {
  defaults?: Partial<Question>;
  showTypeHint?: boolean;
}) {
  const [type, setType] = useState<FormQuestionType>(
    defaults?.type ?? "short_text",
  );
  const needsOptions = type === "single_choice" || type === "multi_choice";

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="q-label">Pergunta</Label>
        <Input
          id="q-label"
          name="label"
          defaultValue={defaults?.label ?? ""}
          placeholder="Ex: Ha quanto tempo tocas?"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="q-help">Texto de ajuda (opcional)</Label>
        <Input
          id="q-help"
          name="help_text"
          defaultValue={defaults?.help_text ?? ""}
          placeholder="Contexto curto para o aluno"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="q-type">Tipo</Label>
          <select
            id="q-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as FormQuestionType)}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="short_text">Texto curto</option>
            <option value="long_text">Texto longo</option>
            <option value="single_choice">Escolha unica</option>
            <option value="multi_choice">Escolha multipla</option>
            <option value="scale">Escala 1-5</option>
          </select>
          {showTypeHint ? (
            <p className="text-xs text-muted-foreground">
              Para escolha, define as opcoes abaixo.
            </p>
          ) : null}
        </div>
        <label className="flex items-end gap-3 pb-2 text-sm">
          <input
            type="checkbox"
            name="required"
            defaultChecked={defaults?.required ?? true}
            className="size-4 accent-[var(--neuma-coral)]"
          />
          Obrigatoria
        </label>
      </div>
      {needsOptions ? (
        <div className="space-y-2">
          <Label htmlFor="q-options">Opcoes (uma por linha)</Label>
          <Textarea
            id="q-options"
            name="options"
            rows={4}
            defaultValue={optionsToText(defaults?.options)}
            placeholder={"Opcao A\nOpcao B\nOpcao C"}
            required
          />
        </div>
      ) : (
        <input type="hidden" name="options" value="" />
      )}
    </>
  );
}

function AddQuestionDialog({ formId }: { formId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await addQuestion(fd);
        toast.success("Pergunta adicionada");
        setOpen(false);
      } catch {
        toast.error("Nao foi possivel adicionar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="w-full gap-2 sm:w-auto" size="sm" />}
      >
        <Plus className="size-4" /> Adicionar pergunta
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova pergunta</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="form_id" value={formId} />
          <QuestionFields key={String(open)} showTypeHint />
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? "A guardar..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditQuestionDialog({
  formId,
  question,
}: {
  formId: string;
  question: Question;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateQuestion(fd);
        toast.success("Pergunta atualizada");
        setOpen(false);
      } catch {
        toast.error("Nao foi possivel guardar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Editar pergunta" />
        }
      >
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar pergunta</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={question.id} />
          <input type="hidden" name="form_id" value={formId} />
          <QuestionFields key={`${question.id}-${open}`} defaults={question} />
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? "A guardar..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FormBuilder({
  formId,
  questions,
}: {
  formId: string;
  questions: Question[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Perguntas{" "}
          <span className="text-muted-foreground">({questions.length})</span>
        </h2>
        <AddQuestionDialog formId={formId} />
      </div>

      {questions.length === 0 ? (
        <Card className="space-y-3 p-8 text-center">
          <p className="text-muted-foreground">
            Ainda sem perguntas. Adiciona a primeira — o aluno ve-as na ordem
            definida.
          </p>
          <AddQuestionDialog formId={formId} />
        </Card>
      ) : (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={q.id}>
              <Card className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-sm font-semibold tabular-nums">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium">{q.label}</p>
                      {q.required ? (
                        <span className="text-xs text-[var(--neuma-coral)]">
                          *
                        </span>
                      ) : null}
                      <Badge variant="outline">{typeLabel[q.type]}</Badge>
                    </div>
                    {q.help_text ? (
                      <p className="text-sm text-muted-foreground">
                        {q.help_text}
                      </p>
                    ) : null}
                    {Array.isArray(q.options) && q.options.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {(q.options as string[]).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 border-t border-white/5 pt-2">
                  <form action={moveQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="form_id" value={formId} />
                    <input type="hidden" name="direction" value="up" />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      disabled={i === 0}
                      aria-label="Subir"
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                  </form>
                  <form action={moveQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="form_id" value={formId} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      disabled={i === questions.length - 1}
                      aria-label="Descer"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                  </form>
                  <EditQuestionDialog formId={formId} question={q} />
                  <form action={deleteQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="form_id" value={formId} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
