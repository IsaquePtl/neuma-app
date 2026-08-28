"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  initialPeriodMonths,
  PeriodMonthsInput,
} from "@/components/path-schedule-fields";
import { upsertPathTemplate } from "@/lib/actions/path-templates";
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
import { cn } from "@/lib/utils";
import type { PathTemplateStatus } from "@/lib/types/database.types";

type TemplateData = {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_label: string | null;
  suggested_node_count: number | null;
  status: PathTemplateStatus;
};

export function PathTemplateForm({
  template,
  triggerLabel = "Criar Percurso",
  triggerClassName,
}: {
  template?: TemplateData;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = Boolean(template);
  const [periodMonths, setPeriodMonths] = useState(() =>
    initialPeriodMonths(template?.duration_label),
  );

  useEffect(() => {
    if (!open) return;
    setPeriodMonths(initialPeriodMonths(template?.duration_label));
  }, [open, template?.duration_label]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const id = await upsertPathTemplate(fd);
        toast.success(isEdit ? "Template atualizado" : "Template criado");
        setOpen(false);
        if (!isEdit && id) router.push(`/studio/library?compose=${id}`);
      } catch {
        toast.error("Não foi possível guardar o template");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger
          render={<Button variant="outline" size="sm" className="gap-2" />}
        >
          <Pencil className="size-4" /> Editar
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <Button
              className={cn("h-12 gap-2 px-6 text-sm", triggerClassName)}
            />
          }
        >
          <Plus className="size-4" /> {triggerLabel}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar template" : "Novo template de percurso"}
          </DialogTitle>
          <DialogDescription>
            Currículo-base reutilizável. Depois defines os níveis e os recursos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {template ? (
            <input type="hidden" name="id" value={template.id} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="tpl-title">Título</Label>
            <Input
              id="tpl-title"
              name="title"
              defaultValue={template?.title ?? ""}
              required
              autoFocus
              placeholder="Ex: Mentoria 3 meses — fundamentos"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-description">Descrição</Label>
            <Textarea
              id="tpl-description"
              name="description"
              defaultValue={template?.description ?? ""}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-goal">Objetivo global</Label>
            <Textarea
              id="tpl-goal"
              name="goal"
              defaultValue={template?.goal ?? ""}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tpl-duration">Duração sugerida</Label>
              <PeriodMonthsInput
                id="tpl-duration"
                name="period_months"
                value={periodMonths}
                disabled={pending}
                onChange={setPeriodMonths}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-nodes">Níveis sugeridos</Label>
              <Input
                id="tpl-nodes"
                name="suggested_node_count"
                type="number"
                min={1}
                defaultValue={template?.suggested_node_count ?? ""}
                placeholder="8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-status">Estado</Label>
            <select
              id="tpl-status"
              name="status"
              defaultValue={template?.status ?? "draft"}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="draft">Rascunho</option>
              <option value="ready">Pronto a aplicar</option>
              <option value="archived">Arquivado</option>
            </select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
