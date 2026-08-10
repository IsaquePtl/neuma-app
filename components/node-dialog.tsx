"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { createNode, updateNode } from "@/lib/actions/nodes";
import {
  LibraryAssetPicker,
  type PickerAsset,
  type PickerCategory,
  type PickerTopic,
} from "@/components/library-asset-picker";
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
  content_body?: string | null;
};

const KIND_HINTS: Record<NodeKind, string> = {
  practice: "Tarefa prática com check-in — só materiais de prática",
  call: "Chamada 1:1 — aluno agenda no Cal.com",
  milestone: "Marco / avaliação",
  lesson: "Aula da biblioteca — categoria → tópico → aula",
  resource: "Aula (legado)",
};

function normalizeKind(kind: NodeKind): NodeKind {
  return kind === "resource" ? "lesson" : kind;
}

export function NodeDialog({
  pathId,
  node,
  categories = [],
  topics = [],
  assets = [],
}: {
  pathId: string;
  node?: NodeData;
  categories?: PickerCategory[];
  topics?: PickerTopic[];
  assets?: PickerAsset[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<NodeKind>(
    normalizeKind(node?.kind ?? "practice"),
  );
  const [title, setTitle] = useState(node?.title ?? "");
  const [resourceUrl, setResourceUrl] = useState(node?.resource_url ?? "");
  const [contentBody, setContentBody] = useState(node?.content_body ?? "");
  const [pickedAssetId, setPickedAssetId] = useState("");
  const isEdit = Boolean(node);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("kind", kind);
    fd.set("title", title);
    fd.set(
      "resource_url",
      kind === "lesson" || kind === "practice" ? resourceUrl : "",
    );
    fd.set(
      "content_body",
      kind === "lesson" || kind === "practice" ? contentBody : "",
    );
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
        if (next) {
          setKind(normalizeKind(node?.kind ?? "practice"));
          setTitle(node?.title ?? "");
          setResourceUrl(node?.resource_url ?? "");
          setContentBody(node?.content_body ?? "");
          setPickedAssetId("");
        }
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
          <Plus className="size-4" /> Criar novo nível
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar bloco" : "Novo bloco"}</DialogTitle>
          <DialogDescription>
            O tipo filtra o que podes ligar da biblioteca.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="path_id" value={pathId} />
          {node ? <input type="hidden" name="id" value={node.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="node-kind">Tipo</Label>
            <select
              id="node-kind"
              value={kind}
              onChange={(e) => {
                const next = e.target.value as NodeKind;
                setKind(next);
                setPickedAssetId("");
                if (next === "call" || next === "milestone") {
                  setResourceUrl("");
                  setContentBody("");
                }
              }}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="practice">Prática</option>
              <option value="call">Chamada</option>
              <option value="milestone">Marco</option>
              <option value="lesson">Aula</option>
            </select>
            <p className="text-xs text-muted-foreground">{KIND_HINTS[kind]}</p>
          </div>

          <LibraryAssetPicker
            nodeKind={kind}
            categories={categories}
            topics={topics}
            assets={assets}
            value={pickedAssetId}
            onChange={(sel) => {
              if (!sel) {
                setPickedAssetId("");
                return;
              }
              setPickedAssetId(sel.assetId);
              if (sel.url) setResourceUrl(sel.url);
              setContentBody(sel.body ?? "");
              if (!title.trim()) setTitle(sel.title);
            }}
          />

          <div className="space-y-2">
            <Label htmlFor="node-title">Titulo</Label>
            <Input
              id="node-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              rows={4}
            />
          </div>

          {(kind === "lesson" || kind === "practice") && resourceUrl ? (
            <p className="truncate text-xs text-muted-foreground">
              Link: {resourceUrl}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="node-week">Semana nº</Label>
              <Input
                id="node-week"
                name="week_number"
                type="number"
                min={1}
                defaultValue={node?.week_number ?? ""}
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
              {pending ? "A guardar..." : isEdit ? "Guardar" : "Criar nível"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
