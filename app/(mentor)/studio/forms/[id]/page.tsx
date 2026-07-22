import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { FormBuilder } from "@/components/form-builder";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteForm, updateForm } from "@/lib/actions/forms";
import type { FormQuestionType } from "@/lib/types/database.types";

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

  const [{ data: questions }, { count }] = await Promise.all([
    supabase
      .from("form_questions")
      .select("*")
      .eq("form_id", id)
      .order("order_index", { ascending: true }),
    supabase
      .from("form_responses")
      .select("id", { count: "exact", head: true })
      .eq("form_id", id),
  ]);

  return (
    <div className="space-y-6 pb-4">
      <Link
        href="/studio/forms"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Formularios
      </Link>

      <header className="neuma-accent-top space-y-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {form.title}
            </h1>
            {form.description ? (
              <p className="text-sm text-muted-foreground">{form.description}</p>
            ) : null}
          </div>
          <Button
            render={<Link href={`/studio/forms/${id}/responses`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <MessageSquare className="size-4" /> Respostas ({count ?? 0})
          </Button>
        </div>
      </header>

      <Card className="space-y-4 p-5 sm:p-6">
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
          <Button type="submit" variant="outline" size="sm">
            Guardar definicoes
          </Button>
        </form>
        <form action={deleteForm} className="border-t border-white/5 pt-4">
          <input type="hidden" name="id" value={form.id} />
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            className="gap-2"
          >
            <Trash2 className="size-4" /> Eliminar formulario
          </Button>
        </form>
      </Card>

      <FormBuilder
        formId={form.id}
        questions={(questions ?? []).map((q) => ({
          id: q.id,
          label: q.label,
          help_text: q.help_text,
          type: q.type as FormQuestionType,
          options: q.options,
          required: q.required,
          order_index: q.order_index,
        }))}
      />
    </div>
  );
}
