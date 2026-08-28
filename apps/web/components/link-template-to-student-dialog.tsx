"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { applyPathTemplate } from "@/lib/actions/path-templates";
import {
  initialPeriodMonths,
  PathScheduleFields,
} from "@/components/path-schedule-fields";
import type { StudentOption } from "@/components/tally-submission-row-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TemplateSummary = {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_label: string | null;
  period_months?: number | null;
};

export function LinkTemplateToStudentDialog({
  open,
  onOpenChange,
  template,
  students,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateSummary;
  students: StudentOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [periodMonths, setPeriodMonths] = useState(() =>
    initialPeriodMonths(
      template.duration_label,
      null,
      null,
      template.period_months,
    ),
  );

  useEffect(() => {
    if (!open) return;
    setStartDate("");
    setPeriodMonths(
      initialPeriodMonths(
        template.duration_label,
        null,
        null,
        template.period_months,
      ),
    );
  }, [open, template.duration_label, template.period_months]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!studentId) {
      toast.error("Escolhe um aluno");
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await applyPathTemplate(fd);
        toast.success("Percurso vinculado ao aluno");
        onOpenChange(false);
        setStudentId("");
        router.refresh();
      } catch {
        toast.error("Não foi possível vincular o percurso");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setStudentId("");
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular a aluno</DialogTitle>
          <DialogDescription>
            Cria uma cópia personalizável de “{template.title}” no aluno
            escolhido.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="template_id" value={template.id} />
          <input type="hidden" name="description" value={template.description ?? ""} />

          <div className="space-y-2">
            <Label htmlFor={`link-tpl-student-${template.id}`}>Aluno</Label>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda não há alunos. Cria ou convida um aluno primeiro.
              </p>
            ) : (
              <select
                id={`link-tpl-student-${template.id}`}
                name="student_id"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                required
              >
                <option value="">Selecionar aluno…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email || s.id}
                    {s.email && s.full_name ? ` · ${s.email}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`link-tpl-title-${template.id}`}>
              Título do percurso
            </Label>
            <Input
              id={`link-tpl-title-${template.id}`}
              name="title"
              defaultValue={template.title}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`link-tpl-goal-${template.id}`}>Objetivo</Label>
            <Input
              id={`link-tpl-goal-${template.id}`}
              name="goal"
              defaultValue={template.goal ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`link-tpl-status-${template.id}`}>
              Estado inicial
            </Label>
            <select
              id={`link-tpl-status-${template.id}`}
              name="status"
              defaultValue="draft"
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="draft">Rascunho</option>
              <option value="active">Activo</option>
            </select>
          </div>

          <PathScheduleFields
            startId={`link-tpl-start-${template.id}`}
            periodId={`link-tpl-period-${template.id}`}
            startDate={startDate}
            periodMonths={periodMonths}
            disabled={pending}
            onStartDateChange={setStartDate}
            onPeriodMonthsChange={setPeriodMonths}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending || students.length === 0}>
              {pending ? "A vincular…" : "Vincular"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
