"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { claimUnassignedPath } from "@/lib/actions/agent-proposals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type StudentOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export function ClaimPathForm({
  pathId,
  placeholderName,
  claimEmail,
  students,
}: {
  pathId: string;
  placeholderName: string | null;
  claimEmail: string | null;
  students: StudentOption[];
}) {
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const studentId = String(fd.get("student_id") ?? "");
    if (!studentId) {
      toast.error("Escolhe um aluno");
      return;
    }
    startTransition(async () => {
      try {
        await claimUnassignedPath(pathId, studentId);
        toast.success("Percurso ligado ao aluno");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao ligar");
      }
    });
  }

  return (
    <Card className="space-y-3 border-amber-500/30 bg-amber-500/5 p-4">
      <div>
        <h2 className="font-medium">Percurso sem conta</h2>
        <p className="text-sm text-muted-foreground">
          {placeholderName
            ? `Reservado para ${placeholderName}.`
            : "Ainda sem aluno associado."}
          {claimEmail ? ` Email previsto: ${claimEmail}.` : ""} Liga quando a
          conta existir.
        </p>
      </div>
      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há alunos registados para associar.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
          <label className="min-w-[14rem] flex-1 space-y-1">
            <span className="text-xs text-muted-foreground">Aluno</span>
            <select
              name="student_id"
              required
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Escolher…
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name ?? s.email ?? s.id}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "A ligar…" : "Ligar à conta"}
          </Button>
        </form>
      )}
    </Card>
  );
}
