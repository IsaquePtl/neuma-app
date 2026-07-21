"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";

import { createNode, updateNode } from "@/lib/actions/nodes";
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
import type { NodeKind, NodeStatus } from "@/lib/types/database.types";

type NodeData = {
  id: string;
  title: string;
  description: string | null;
  week_number: number | null;
  kind: NodeKind;
  status: NodeStatus;
  due_date: string | null;
};

export function NodeDialog({
  pathId,
  node,
}: {
  pathId: string;
  node?: NodeData;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(node);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      if (isEdit) await updateNode(fd);
      else await createNode(fd);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Editar bloco" />
          }
        >
          <Pencil className="size-4" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" className="gap-2" />}>
          <Plus className="size-4" /> Adicionar bloco
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar bloco" : "Novo bloco"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="path_id" value={pathId} />
          {node ? <input type="hidden" name="id" value={node.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              name="title"
              defaultValue={node?.title ?? ""}
              placeholder="Ex: Semana 1 - Acordes maiores"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descricao / objetivo do bloco</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={node?.description ?? ""}
              placeholder="O que o aluno deve dominar neste bloco..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="week_number">Semana</Label>
              <Input
                id="week_number"
                name="week_number"
                type="number"
                min={1}
                defaultValue={node?.week_number ?? ""}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Data limite</Label>
              <Input
                id="due_date"
                name="due_date"
                type="date"
                defaultValue={node?.due_date ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select name="kind" defaultValue={node?.kind ?? "practice"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Pratica</SelectItem>
                  <SelectItem value="call">Chamada</SelectItem>
                  <SelectItem value="milestone">Marco</SelectItem>
                  <SelectItem value="resource">Recurso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isEdit ? (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select name="status" defaultValue={node?.status ?? "locked"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="locked">Bloqueado</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="completed">Concluido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
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
