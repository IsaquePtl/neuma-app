"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  initialPeriodMonths,
  PathScheduleFields,
  PeriodMonthsInput,
} from "@/components/path-schedule-fields";
import { upsertPath } from "@/lib/actions/paths";
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
import type { PathStatus } from "@/lib/types/database.types";

type PathData = {
  id: string;
  title: string;
  description?: string | null;
  goal: string | null;
  duration_label: string | null;
  start_date: string | null;
  end_date: string | null;
  status: PathStatus;
};

export function PathForm({
  studentId,
  path,
  triggerClassName,
}: {
  studentId: string;
  path?: PathData;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(path);

  const [startDate, setStartDate] = useState(path?.start_date ?? "");
  const [periodMonths, setPeriodMonths] = useState(() =>
    initialPeriodMonths(
      path?.duration_label,
      path?.start_date,
      path?.end_date,
    ),
  );

  useEffect(() => {
    if (!open) return;
    setStartDate(path?.start_date ?? "");
    setPeriodMonths(
      initialPeriodMonths(
        path?.duration_label,
        path?.start_date,
        path?.end_date,
      ),
    );
  }, [open, path?.duration_label, path?.start_date, path?.end_date]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await upsertPath(fd);
        toast.success(isEdit ? "Percurso atualizado" : "Percurso criado");
        setOpen(false);
      } catch {
        toast.error("Não foi possível guardar o percurso");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={triggerClassName ?? "gap-2"}
            />
          }
        >
          <Pencil className="size-4" /> Editar
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <Button size="sm" className={triggerClassName ?? "gap-2"} />
          }
        >
          <Plus className="size-4" /> Criar percurso
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar percurso" : "Novo percurso"}
          </DialogTitle>
          <DialogDescription>
            Define o plano global. Depois adicionas os blocos semana a semana.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="student_id" value={studentId} />
          {path ? <input type="hidden" name="id" value={path.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="path-title">Título</Label>
            <Input
              id="path-title"
              name="title"
              defaultValue={path?.title ?? ""}
              placeholder="Ex: Teclado — dos fundamentos a improvisar"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="path-description">Descrição</Label>
            <Textarea
              id="path-description"
              name="description"
              defaultValue={path?.description ?? ""}
              placeholder="O que este percurso cobre, em 1-2 frases..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="path-goal">Objetivo global</Label>
            <Textarea
              id="path-goal"
              name="goal"
              defaultValue={path?.goal ?? ""}
              placeholder="Onde queremos chegar — ex: tocar 3 standards com solidez rítmica"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="path-duration">Duração</Label>
              <PeriodMonthsInput
                id="path-duration"
                value={periodMonths}
                disabled={pending}
                onChange={setPeriodMonths}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="path-status">Estado</Label>
              <select
                id="path-status"
                name="status"
                defaultValue={path?.status ?? "draft"}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="paused">Em pausa</option>
                <option value="completed">Concluído</option>
              </select>
            </div>
          </div>

          <PathScheduleFields
            startDate={startDate}
            periodMonths={periodMonths}
            onStartDateChange={setStartDate}
            onPeriodMonthsChange={setPeriodMonths}
            disabled={pending}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? "A guardar..." : "Guardar percurso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
