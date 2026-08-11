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
import { NodeQuizEditor } from "@/components/node-quiz-editor";
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
import { nodeKindHint, nodeKindLabel } from "@/lib/labels";
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

function normalizeKind(kind: NodeKind): NodeKind {
  return kind === "resource" ? "lesson" : kind;
}

function allowsContent(kind: NodeKind) {
  return (
    kind === "lesson" ||
    kind === "practice" ||
    kind === "call" ||
    kind === "milestone"
  );
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
    fd.set("resource_url", allowsContent(kind) ? resourceUrl : "");
    fd.set("content_body", allowsContent(kind) ? contentBody : "");
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
            Cada tipo tem um foco diferente no percurso do aluno.
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
              }}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="practice">{nodeKindLabel.practice}</option>
              <option value="call">{nodeKindLabel.call}</option>
              <option value="milestone">{nodeKindLabel.milestone}</option>
              <option value="lesson">{nodeKindLabel.lesson}</option>
            </select>
            <p className="text-xs text-muted-foreground">{nodeKindHint[kind]}</p>
          </div>

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
              rows={3}
            />
          </div>

          {kind === "call" ? (
            <p className="rounded-lg border border-[var(--neuma-coral)]/25 bg-[var(--neuma-coral)]/10 px-3 py-2 text-sm text-muted-foreground">
              Foco desta sessão: o aluno agenda e entra no Google Meet. Texto e
              anexo abaixo são só apoio (antes ou durante a call).
            </p>
          ) : null}

          {kind === "lesson" ? (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
              Foco: vídeo em destaque. Escolhe a aula na biblioteca.
            </p>
          ) : null}

          <LibraryAssetPicker
            nodeKind={kind}
            categories={categories}
            topics={topics}
            assets={assets}
            value={pickedAssetId}
            onChange={(sel) => {
              if (!sel) {
                setPickedAssetId("");
                setResourceUrl("");
                return;
              }
              setPickedAssetId(sel.assetId);
              setResourceUrl(sel.url ?? "");
              if (sel.body) setContentBody(sel.body);
              if (!title.trim()) setTitle(sel.title);
            }}
          />

          {allowsContent(kind) ? (
            <div className="space-y-2">
              <Label htmlFor="node-content">
                {kind === "call"
                  ? "Texto de apoio à sessão"
                  : kind === "milestone"
                    ? "Texto de apoio ao check-point"
                    : "Texto / conteúdo"}
              </Label>
              <Textarea
                id="node-content"
                value={contentBody}
                onChange={(e) => setContentBody(e.target.value)}
                rows={4}
                placeholder={
                  kind === "call"
                    ? "Notas para o aluno antes ou durante a call…"
                    : undefined
                }
              />
            </div>
          ) : null}

          {allowsContent(kind) && resourceUrl ? (
            <p className="truncate text-xs text-muted-foreground">
              {kind === "call" || kind === "milestone"
                ? "Anexo de apoio: "
                : "Link: "}
              {resourceUrl}
            </p>
          ) : null}

          {kind === "milestone" && isEdit && node ? (
            <NodeQuizEditor nodeId={node.id} />
          ) : null}

          {kind === "milestone" && !isEdit ? (
            <p className="text-xs text-muted-foreground">
              Depois de criar o nível, volta a editar para configurar o quiz.
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
