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
import { cn } from "@/lib/utils";

export type NodeEditorData = {
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

const glassInputClass =
  "border-white/10 bg-black/20 focus-visible:border-white/20 focus-visible:ring-white/10";
const glassSelectClass =
  "h-10 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 text-sm";

export function NodeEditorForm({
  pathId,
  node,
  categories = [],
  topics = [],
  assets = [],
  inline = false,
  idPrefix = "",
  onSuccess,
  className,
}: {
  pathId: string;
  node?: NodeEditorData;
  categories?: PickerCategory[];
  topics?: PickerTopic[];
  assets?: PickerAsset[];
  inline?: boolean;
  idPrefix?: string;
  onSuccess?: () => void;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<NodeKind>(
    normalizeKind(node?.kind ?? "practice"),
  );
  const [title, setTitle] = useState(node?.title ?? "");
  const [resourceUrl, setResourceUrl] = useState(node?.resource_url ?? "");
  const [contentBody, setContentBody] = useState(node?.content_body ?? "");
  const [pickedAssetId, setPickedAssetId] = useState("");
  const isEdit = Boolean(node);

  const fieldId = (name: string) =>
    idPrefix ? `${idPrefix}-${name}` : `node-${name}`;

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
        onSuccess?.();
      } catch {
        toast.error("Nao foi possivel guardar o bloco");
      }
    });
  }

  const inputClass = inline ? glassInputClass : undefined;
  const selectClass = inline
    ? glassSelectClass
    : "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

  return (
    <form
      onSubmit={onSubmit}
      className={cn(inline ? "space-y-3" : "space-y-4", className)}
    >
      <input type="hidden" name="path_id" value={pathId} />
      {node ? <input type="hidden" name="id" value={node.id} /> : null}

      <div className={cn("space-y-2", inline && "space-y-1.5")}>
        <Label htmlFor={fieldId("kind")}>Tipo</Label>
        <select
          id={fieldId("kind")}
          value={kind}
          onChange={(e) => {
            const next = e.target.value as NodeKind;
            setKind(next);
            setPickedAssetId("");
          }}
          className={selectClass}
        >
          <option value="practice">{nodeKindLabel.practice}</option>
          <option value="call">{nodeKindLabel.call}</option>
          <option value="milestone">{nodeKindLabel.milestone}</option>
          <option value="lesson">{nodeKindLabel.lesson}</option>
        </select>
        <p className="text-xs text-muted-foreground">{nodeKindHint[kind]}</p>
      </div>

      <div className={cn("space-y-2", inline && "space-y-1.5")}>
        <Label htmlFor={fieldId("title")}>Titulo</Label>
        <Input
          id={fieldId("title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus={!inline}
          className={inputClass}
        />
      </div>

      <div className={cn("space-y-2", inline && "space-y-1.5")}>
        <Label htmlFor={fieldId("description")}>Objetivo do bloco</Label>
        <Textarea
          id={fieldId("description")}
          name="description"
          defaultValue={node?.description ?? ""}
          rows={3}
          className={inputClass}
        />
      </div>

      {kind === "call" ? (
        <p
          className={cn(
            "rounded-lg border border-[var(--neuma-coral)]/25 bg-[var(--neuma-coral)]/10 px-3 py-2 text-sm text-muted-foreground",
            inline && "rounded-xl",
          )}
        >
          Foco desta sessão: o aluno agenda e entra no Google Meet. Texto e
          anexo abaixo são só apoio (antes ou durante a call).
        </p>
      ) : null}

      {kind === "lesson" ? (
        <p
          className={cn(
            "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground",
            inline && "rounded-xl bg-black/20",
          )}
        >
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
        <div className={cn("space-y-2", inline && "space-y-1.5")}>
          <Label htmlFor={fieldId("content")}>
            {kind === "call"
              ? "Texto de apoio à sessão"
              : kind === "milestone"
                ? "Texto de apoio ao check-point"
                : "Texto / conteúdo"}
          </Label>
          <Textarea
            id={fieldId("content")}
            value={contentBody}
            onChange={(e) => setContentBody(e.target.value)}
            rows={4}
            placeholder={
              kind === "call"
                ? "Notas para o aluno antes ou durante a call…"
                : undefined
            }
            className={inputClass}
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
        <div className={cn("space-y-2", inline && "space-y-1.5")}>
          <Label htmlFor={fieldId("week")}>Semana nº</Label>
          <Input
            id={fieldId("week")}
            name="week_number"
            type="number"
            min={1}
            defaultValue={node?.week_number ?? ""}
            className={inputClass}
          />
        </div>
        <div className={cn("space-y-2", inline && "space-y-1.5")}>
          <Label htmlFor={fieldId("due")}>Data limite</Label>
          <Input
            id={fieldId("due")}
            name="due_date"
            type="date"
            defaultValue={node?.due_date ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      {isEdit ? (
        <div className={cn("space-y-2", inline && "space-y-1.5")}>
          <Label htmlFor={fieldId("status")}>Estado</Label>
          <select
            id={fieldId("status")}
            name="status"
            defaultValue={node?.status ?? "locked"}
            className={selectClass}
          >
            <option value="locked">Bloqueado</option>
            <option value="active">Ativo (aluno ve agora)</option>
            <option value="completed">Concluido</option>
          </select>
        </div>
      ) : null}

      {inline ? (
        <div className="pt-1">
          <Button
            type="submit"
            disabled={pending}
            className="h-11 w-full gap-2 py-3 text-base"
          >
            {pending ? "A guardar..." : isEdit ? "Guardar" : "Criar nível"}
          </Button>
        </div>
      ) : (
        <DialogFooter>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "A guardar..." : isEdit ? "Guardar" : "Criar nível"}
          </Button>
        </DialogFooter>
      )}
    </form>
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
  node?: NodeEditorData;
  categories?: PickerCategory[];
  topics?: PickerTopic[];
  assets?: PickerAsset[];
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const isEdit = Boolean(node);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((k) => k + 1);
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
        <DialogTrigger
          render={
            <Button
              size="sm"
              className="min-w-0 flex-1 gap-2 sm:flex-none"
            />
          }
        >
          <Plus className="size-4 shrink-0" />
          <span className="truncate">Criar novo nível</span>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar bloco" : "Novo bloco"}</DialogTitle>
          <DialogDescription>
            Cada tipo tem um foco diferente no percurso do aluno.
          </DialogDescription>
        </DialogHeader>
        <NodeEditorForm
          key={formKey}
          pathId={pathId}
          node={node}
          categories={categories}
          topics={topics}
          assets={assets}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
