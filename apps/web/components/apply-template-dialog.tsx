"use client";

import { useEffect, useState, useTransition } from "react";
import { Library } from "lucide-react";
import { toast } from "sonner";

import { applyPathTemplate } from "@/lib/actions/path-templates";
import {
  initialPeriodMonths,
  PathScheduleFields,
} from "@/components/path-schedule-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ReadyTemplate = {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_label: string | null;
  period_months?: number | null;
  node_count: number;
};

export function ApplyTemplateDialog({
  studentId,
  templates,
}: {
  studentId: string;
  templates: ReadyTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [periodMonths, setPeriodMonths] = useState(3);
  const selected = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (!selected) return;
    setPeriodMonths(
      initialPeriodMonths(selected.duration_label, null, null, selected.period_months),
    );
  }, [selected]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!templateId) {
      toast.error("Escolhe um template");
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await applyPathTemplate(fd);
        toast.success("Percurso aplicado — podes personalizar os blocos");
        setOpen(false);
      } catch {
        toast.error("Não foi possível aplicar o template");
      }
    });
  }

  if (templates.length === 0) {
    return (
      <Button
        size="sm"
        disabled
        className="gap-2"
        title="Cria um template em Percursos primeiro"
      >
        <Library className="size-4" /> Aplicar template
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setTemplateId(templates[0]?.id ?? "");
          setStartDate("");
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" className="gap-2" />}>
        <Library className="size-4" /> Aplicar template
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aplicar template</DialogTitle>
          <DialogDescription>
            Cria uma cópia personalizável do currículo neste aluno. Alterações
            posteriores ao template não afectam este percurso.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="student_id" value={studentId} />

          <div className="space-y-2">
            <Label htmlFor="apply-tpl">Template</Label>
            <select
              id="apply-tpl"
              name="template_id"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              required
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.node_count} níveis)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apply-title">Título do percurso</Label>
            <Input
              id="apply-title"
              name="title"
              key={selected?.id}
              defaultValue={selected?.title ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apply-goal">Objetivo</Label>
            <Textarea
              id="apply-goal"
              name="goal"
              key={`goal-${selected?.id}`}
              defaultValue={selected?.goal ?? ""}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apply-status">Estado inicial</Label>
            <select
              id="apply-status"
              name="status"
              defaultValue="draft"
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="draft">Rascunho</option>
              <option value="active">Activo</option>
            </select>
          </div>

          <PathScheduleFields
            startId="apply-start"
            periodId="apply-period"
            startDate={startDate}
            periodMonths={periodMonths}
            disabled={pending}
            onStartDateChange={setStartDate}
            onPeriodMonthsChange={setPeriodMonths}
          />

          <input
            type="hidden"
            name="description"
            value={selected?.description ?? ""}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "A aplicar..." : "Aplicar e personalizar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
