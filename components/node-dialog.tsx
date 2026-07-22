"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { createNode, updateNode } from "@/lib/actions/nodes";
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
import type { NodeKind, NodeStatus } from "@/lib/types/database.types";

type NodeData = {
  id: string;
  title: string;
  description: string | null;
  week_number: number | null;
  kind: NodeKind;
  status: NodeStatus;
  due_date: string | null;
  resource_url?: string | null;
};

const KIND_HINTS: Record<NodeKind, string> = {
  practice: "Pratica / tarefa com check-in",
  call: "Chamada 1:1 (Cal.com)",
  milestone: "Marco / avaliacao",
  resource: "Material para estudar",
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
  const [kind, setKind] = useState<NodeKind>(node?.kind ?? "practice");
  const isEdit = Boolean(node);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (isEdit) await updateNode(fd);
        else await createNode(fd);
        toast.success(isEdit ? "Bloco atualizado" : "Bloco adicionado");
        setOpen(false);
      } catch {
        toast.error("Nao foi possivel guardar o bloco");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setKind(node?.kind ?? "practice");
      }}
    >
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar bloco" : "Novo bloco"}</DialogTitle>
          <DialogDescription>
            Cada bloco e um passo do percurso — pratica, chamada, marco ou
            recurso.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="path_id" value={pathId} />
          {node ? <input type="hidden" name="id" value={node.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="node-title">Titulo</Label>
            <Input
              id="node-title"
              name="title"
              defaultValue={node?.title ?? ""}
              placeholder="Ex: Semana 1 — Acordes maiores"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-description">Objetivo do bloco</Label>
            <Textarea
              id="node-description"
              name="description"
              defaultValue={node?.description ?? ""}
              placeholder="O que o aluno deve dominar / entregar neste bloco..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-kind">Tipo</Label>
            <select
              id="node-kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as NodeKind)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="practice">Pratica</option>
              <option value="call">Chamada</option>
              <option value="milestone">Marco</option>
              <option value="resource">Recurso</option>
            </select>
            <p className="text-xs text-muted-foreground">{KIND_HINTS[kind]}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-resource">
              {kind === "call"
                ? "Link da chamada (opcional)"
                : "Link do recurso (opcional)"}
            </Label>
            <Input
              id="node-resource"
              name="resource_url"
              type="url"
              defaultValue={node?.resource_url ?? ""}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="node-week">Semana nº</Label>
              <Input
                id="node-week"
                name="week_number"
                type="number"
                min={1}
                defaultValue={node?.week_number ?? ""}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-due">Data limite</Label>
              <Input
                id="node-due"
                name="due_date"
                type="date"
                defaultValue={node?.due_date ?? ""}
              />
            </div>
          </div>

          {isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="node-status">Estado</Label>
              <select
                id="node-status"
                name="status"
                defaultValue={node?.status ?? "locked"}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="locked">Bloqueado</option>
                <option value="active">Ativo (aluno ve agora)</option>
                <option value="completed">Concluido</option>
              </select>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? "A guardar..." : isEdit ? "Guardar" : "Adicionar bloco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
