"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";

import { upsertPath } from "@/lib/actions/paths";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PathStatus } from "@/lib/types/database.types";

type PathData = {
  id: string;
  title: string;
  goal: string | null;
  duration_label: string | null;
  start_date: string | null;
  end_date: string | null;
  status: PathStatus;
};

export function PathForm({
  studentId,
  path,
}: {
  studentId: string;
  path?: PathData;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(path);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await upsertPath(fd);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger
          render={<Button variant="outline" size="sm" className="gap-2" />}
        >
          <Pencil className="size-4" /> Editar percurso
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" className="gap-2" />}>
          <Plus className="size-4" /> Criar percurso
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar percurso" : "Novo percurso"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="student_id" value={studentId} />
          {path ? <input type="hidden" name="id" value={path.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="title">Titulo do percurso</Label>
            <Input
              id="title"
              name="title"
              defaultValue={path?.title ?? ""}
              placeholder="Ex: Teclado - dos fundamentos a improvisar"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal">Objetivo global</Label>
            <Textarea
              id="goal"
              name="goal"
              defaultValue={path?.goal ?? ""}
              placeholder="Onde queremos chegar em 6 meses..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duration_label">Duracao</Label>
              <Input
                id="duration_label"
                name="duration_label"
                defaultValue={path?.duration_label ?? ""}
                placeholder="6 meses"
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select name="status" defaultValue={path?.status ?? "draft"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Em pausa</SelectItem>
                  <SelectItem value="completed">Concluido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start_date">Inicio</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={path?.start_date ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Fim previsto</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={path?.end_date ?? ""}
              />
            </div>
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
