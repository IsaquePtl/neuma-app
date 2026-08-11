"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { submitStudentReview } from "@/lib/actions/student-reviews";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function StudentReviewPage() {
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await submitStudentReview(fd);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível enviar",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          A tua opinião
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Deixar um feedback
        </h1>
        <p className="text-sm text-muted-foreground">
          Diz-nos o que pensas da app, do Mentor ou da mentoria — ajuda-nos a
          melhorar.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="topic">Sobre</Label>
          <select
            id="topic"
            name="topic"
            defaultValue="geral"
            className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="geral">Geral</option>
            <option value="app">App</option>
            <option value="1:1">Mentor / sessões</option>
            <option value="percurso">Percurso</option>
            <option value="mentor">Mentor</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rating">Nota (opcional)</Label>
          <select
            id="rating"
            name="rating"
            defaultValue=""
            className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">— sem nota —</option>
            <option value="5">5 · Excelente</option>
            <option value="4">4 · Bom</option>
            <option value="3">3 · Ok</option>
            <option value="2">2 · Fraco</option>
            <option value="1">1 · Mau</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">A tua mensagem</Label>
          <Textarea
            id="body"
            name="body"
            required
            rows={6}
            placeholder="O que correu bem? O que podemos melhorar?"
          />
        </div>

        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "A enviar…" : "Enviar feedback"}
        </Button>
      </form>
    </div>
  );
}
