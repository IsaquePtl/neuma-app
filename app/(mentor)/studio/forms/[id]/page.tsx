import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2, MessageSquare } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addQuestion, deleteQuestion, updateForm } from "@/lib/actions/forms";
import type { FormQuestionType } from "@/lib/types/database.types";

const typeLabel: Record<FormQuestionType, string> = {
  short_text: "Texto curto",
  long_text: "Texto longo",
  single_choice: "Escolha unica",
  multi_choice: "Escolha multipla",
  scale: "Escala 1-5",
};

export default async function FormEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: form } = await supabase
    .from("forms")
    .select("*")
    .eq("id", id)
    .single();

  if (!form) notFound();

  const { data: questions } = await supabase
    .from("form_questions")
    .select("*")
    .eq("form_id", id)
    .order("order_index", { ascending: true });

  const { count } = await supabase
    .from("form_responses")
    .select("id", { count: "exact", head: true })
    .eq("form_id", id);

  return (
    <div className="space-y-8">
      <Link
        href="/studio/forms"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Formularios
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{form.title}</h1>
        <Button
          render={<Link href={`/studio/forms/${id}/responses`} />}
          nativeButton={false}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <MessageSquare className="size-4" /> Respostas ({count ?? 0})
        </Button>
      </header>

      {/* Definicoes */}
      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Definicoes</h2>
        <form action={updateForm} className="space-y-4">
          <input type="hidden" name="id" value={form.id} />
          <div className="space-y-2">
            <Label htmlFor="title">Titulo</Label>
            <Input id="title" name="title" defaultValue={form.title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={form.description ?? ""}
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={form.is_active}
                className="size-4 accent-[var(--neuma-coral)]"
              />
              Ativo
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="is_onboarding"
                defaultChecked={form.is_onboarding}
                className="size-4 accent-[var(--neuma-coral)]"
              />
              Formulario de onboarding
            </label>
          </div>
          <Button type="submit" variant="outline">
            Guardar definicoes
          </Button>
        </form>
      </Card>

      {/* Perguntas */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Perguntas{" "}
          <span className="text-muted-foreground">
            ({questions?.length ?? 0})
          </span>
        </h2>

        {questions && questions.length > 0 ? (
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={q.id}>
                <Card className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {i + 1}.
                      </span>
                      <p className="font-medium">{q.label}</p>
                      {q.required ? (
                        <span className="text-xs text-[var(--neuma-coral)]">
                          *
                        </span>
                      ) : null}
                      <Badge variant="outline">{typeLabel[q.type]}</Badge>
                    </div>
                    {q.help_text ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {q.help_text}
                      </p>
                    ) : null}
                    {Array.isArray(q.options) && q.options.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Opcoes: {(q.options as string[]).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <form action={deleteQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="form_id" value={form.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar pergunta"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </Card>
              </li>
            ))}
          </ol>
        ) : (
          <Card className="p-6 text-center text-muted-foreground">
            Sem perguntas ainda.
          </Card>
        )}

        {/* Nova pergunta */}
        <Card className="space-y-4 p-6">
          <h3 className="font-semibold">Adicionar pergunta</h3>
          <form action={addQuestion} className="space-y-4">
            <input type="hidden" name="form_id" value={form.id} />
            <div className="space-y-2">
              <Label htmlFor="label">Pergunta</Label>
              <Input
                id="label"
                name="label"
                placeholder="Ex: Ha quanto tempo tocas teclado?"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="help_text">Texto de ajuda (opcional)</Label>
              <Input id="help_text" name="help_text" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select name="type" defaultValue="short_text">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short_text">Texto curto</SelectItem>
                    <SelectItem value="long_text">Texto longo</SelectItem>
                    <SelectItem value="single_choice">Escolha unica</SelectItem>
                    <SelectItem value="multi_choice">
                      Escolha multipla
                    </SelectItem>
                    <SelectItem value="scale">Escala 1-5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-end gap-3 pb-2 text-sm">
                <input
                  type="checkbox"
                  name="required"
                  className="size-4 accent-[var(--neuma-coral)]"
                />
                Obrigatoria
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="options">
                Opcoes (uma por linha - so para escolha)
              </Label>
              <Textarea
                id="options"
                name="options"
                rows={3}
                placeholder={"Opcao A\nOpcao B\nOpcao C"}
              />
            </div>
            <Button type="submit">Adicionar</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
