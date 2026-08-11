"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { upsertTemplateNode } from "@/lib/actions/path-templates";
import {
  LibraryAssetPicker,
  type PickerAsset,
  type PickerCategory,
  type PickerTopic,
} from "@/components/library-asset-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nodeKindHint, nodeKindLabel } from "@/lib/labels";
import type { NodeKind } from "@/lib/types/database.types";

export type TemplateNodeData = {
  id: string;
  title: string;
  description: string | null;
  kind: NodeKind;
  week_number: number | null;
  duration_weeks: number | null;
  default_resource_url: string | null;
  library_asset_id: string | null;
};

function normalizeKind(kind: NodeKind): NodeKind {
  return kind === "resource" ? "lesson" : kind;
}

const PERIOD_OPTIONS = [
  { value: 1, label: "1 semana" },
  { value: 2, label: "2 semanas" },
  { value: 3, label: "3 semanas" },
  { value: 4, label: "4 semanas" },
] as const;

export function TemplateNodeEditor({
  templateId,
  node,
  nextLevel,
  categories,
  topics,
  assets,
  onCancel,
  onSaved,
}: {
  templateId: string;
  node?: TemplateNodeData;
  nextLevel?: number;
  categories: PickerCategory[];
  topics: PickerTopic[];
  assets: PickerAsset[];
  onCancel: () => void;
  onSaved?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<NodeKind>(
    normalizeKind(node?.kind ?? "practice"),
  );
  const [title, setTitle] = useState(node?.title ?? "");
  const [assetId, setAssetId] = useState(node?.library_asset_id ?? "");
  const [resourceUrl, setResourceUrl] = useState(
    node?.default_resource_url ?? "",
  );
  const [durationWeeks, setDurationWeeks] = useState<number>(
    node?.duration_weeks && node.duration_weeks >= 1 && node.duration_weeks <= 4
      ? node.duration_weeks
      : 1,
  );
  const isEdit = Boolean(node);
  const levelLabel = isEdit
    ? "Editar nível"
    : `Nível ${nextLevel ?? ""}`.trim();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("kind", kind);
    fd.set("title", title);
    fd.set("duration_weeks", String(durationWeeks));
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
        onSaved?.();
        onCancel();
      } catch {
        toast.error("Não foi possível guardar o nível");
      }
    });
  }

  return (
    <div className="student-path-step student-path-step--active min-w-0 flex-1 border border-dashed border-[var(--neuma-coral)]/35">
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="template_id" value={templateId} />
        {node ? <input type="hidden" name="id" value={node.id} /> : null}

        <div>
          <p className="text-lg font-semibold tracking-tight">{levelLabel}</p>
          <p className="text-sm text-muted-foreground">
            Define o conteúdo e a duração deste nível.
          </p>
        </div>

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
            autoFocus
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
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(Number(e.target.value))}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? "A guardar…" : isEdit ? "Guardar" : "Adicionar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
