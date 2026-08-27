"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { claimUnassignedPath } from "@/lib/actions/agent-proposals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ClaimUnassignedToStudent({
  studentId,
  paths,
}: {
  studentId: string;
  paths: {
    id: string;
    title: string;
    placeholder_name: string | null;
    claim_email: string | null;
  }[];
}) {
  const [pending, startTransition] = useTransition();
  if (paths.length === 0) return null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pathId = String(fd.get("path_id") ?? "");
    if (!pathId) return;
    startTransition(async () => {
      try {
        await claimUnassignedPath(pathId, studentId);
        toast.success("Percurso associado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha");
      }
    });
  }

  return (
    <Card className="mb-4 space-y-3 border-amber-500/30 bg-amber-500/5 p-4">
      <div>
        <h2 className="font-medium">Associar percurso reservado</h2>
        <p className="text-sm text-muted-foreground">
          Há percursos sem conta (ex.: Márcio/Eduardo). Liga um a este aluno.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[14rem] flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Percurso</span>
          <select
            name="path_id"
            required
            defaultValue=""
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="" disabled>
              Escolher…
            </option>
            {paths.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.placeholder_name ? ` · ${p.placeholder_name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "A ligar…" : "Associar"}
        </Button>
      </form>
    </Card>
  );
}
