"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { upsertTemplateNode } from "@/lib/actions/path-templates";
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
import { nodeKindHint, nodeKindLabel } from "@/lib/labels";
import type { NodeKind } from "@/lib/types/database.types";

type TemplateNodeData = {
  id: string;
  title: string;
  description: string | null;
  kind: NodeKind;
  week_number: number | null;
  duration_weeks?: number | null;
  default_resource_url: string | null;
  library_asset_id: string | null;
};

function normalizeKind(kind: NodeKind): NodeKind {
  return kind === "resource" ? "lesson" : kind;
}

export function TemplateNodeDialog({
  templateId,
  node,
  categories,
  topics,
  assets,
  trigger = "default",
  nextLevel,
}: {
  templateId: string;
  node?: TemplateNodeData;
  categories: PickerCategory[];
  topics: PickerTopic[];
  assets: PickerAsset[];
  trigger?: "default" | "journey";
  nextLevel?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<NodeKind>(
    normalizeKind(node?.kind ?? "practice"),
  );
  const [title, setTitle] = useState(node?.title ?? "");
  const [assetId, setAssetId] = useState(node?.library_asset_id ?? "");
  const [resourceUrl, setResourceUrl] = useState(
    node?.default_resource_url ?? "",
  );
  const isEdit = Boolean(node);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("kind", kind);
    fd.set("title", title);
    fd.set(
      "library_asset_id",
      kind === "lesson" ||
        kind === "practice" ||
        kind === "call" ||
        kind === "milestone"
        ? assetId
        : "",
    );
    fd.set(
      "default_resource_url",
      kind === "lesson" ||
        kind === "practice" ||
        kind === "call" ||
        kind === "milestone"
        ? resourceUrl
        : "",
    );
    startTransition(async () => {
      try {
        await upsertTemplateNode(fd);
        toast.success(isEdit ? "Nível atualizado" : "Nível adicionado");
        setOpen(false);
      } catch {
        toast.error("Não foi possível guardar o nível");
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
          setAssetId(node?.library_asset_id ?? "");
          setResourceUrl(node?.default_resource_url ?? "");
        }
      }}
    >
      {isEdit ? (
        <DialogTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Editar nível" />
          }
        >
          <Pencil className="size-4" />
        </DialogTrigger>
      ) : trigger === "journey" ? (
        <DialogTrigger
          render={
            <button
              type="button"
              className="group flex w-full gap-4 rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50 sm:gap-5"
            />
          }
        >
          <span className="flex flex-col items-center pt-0.5">
            <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full border-2 border-dashed border-white/20 bg-white/[0.03] text-muted-foreground transition-colors group-hover:border-[var(--neuma-coral)]/50 group-hover:text-[var(--neuma-coral)]">
              <Plus className="size-5" />
            </span>
          </span>
          <span className="student-path-step min-w-0 flex-1 border border-dashed border-white/10 bg-white/[0.02] transition-colors group-hover:border-[var(--neuma-coral)]/30">
            <span className="block text-lg font-semibold tracking-tight text-muted-foreground group-hover:text-foreground">
              Adicionar nível
              {nextLevel != null ? ` ${nextLevel}` : ""}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Próximo passo do percurso
            </span>
          </span>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" className="gap-2" />}>
          <Plus className="size-4" /> Adicionar nível
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar nível" : "Novo nível"}</DialogTitle>
          <DialogDescription>
            Cada tipo tem um foco diferente. Em Aula: categoria → tópico →
            vídeo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="template_id" value={templateId} />
          {node ? <input type="hidden" name="id" value={node.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="tn-kind">Tipo</Label>
            <select
              id="tn-kind"
              value={kind}
              onChange={(e) => {
                const next = e.target.value as NodeKind;
                setKind(next);
                setAssetId("");
                setResourceUrl("");
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

          <LibraryAssetPicker
            nodeKind={kind}
            categories={categories}
            topics={topics}
            assets={assets}
            value={assetId}
            initialAssetId={node?.library_asset_id}
            onChange={(sel) => {
              if (!sel) {
                setAssetId("");
                setResourceUrl("");
                return;
              }
              setAssetId(sel.assetId);
              setResourceUrl(sel.url ?? "");
              if (!title.trim()) setTitle(sel.title);
            }}
          />

          <div className="space-y-2">
            <Label htmlFor="tn-title">Título</Label>
            <Input
              id="tn-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tn-description">Objetivo</Label>
            <Textarea
              id="tn-description"
              name="description"
              defaultValue={node?.description ?? ""}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tn-duration">Período</Label>
            <select
              id="tn-duration"
              name="duration_weeks"
              defaultValue={node?.duration_weeks ?? 1}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value={1}>1 semana</option>
              <option value={2}>2 semanas</option>
              <option value={3}>3 semanas</option>
              <option value={4}>4 semanas</option>
            </select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar..." : isEdit ? "Guardar" : "Criar nível"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
