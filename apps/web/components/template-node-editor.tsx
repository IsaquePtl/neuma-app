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
import { NodeGateFields } from "@/components/node-gate-fields";
import { PhaseFields } from "@/components/phase-fields";
import type { PhaseOption } from "@/lib/nodes/phases";
import { defaultPassRule } from "@/lib/nodes/pass-rule";
import type { NodeKind, NodePassRule } from "@/lib/types/database.types";

export type TemplateNodeData = {
  id: string;
  title: string;
  description: string | null;
  kind: NodeKind;
  week_number: number | null;
  duration_weeks: number | null;
  default_resource_url: string | null;
  library_asset_id: string | null;
  pass_rule?: NodePassRule | null;
  pass_score?: number | null;
  check_in_kind?: string | null;
  phase_key?: string | null;
  node_code?: string | null;
  is_phase_checkpoint?: boolean | null;
};

function normalizeKind(kind: NodeKind): NodeKind {
  return kind === "resource" ? "lesson" : kind;
}

export function TemplateNodeEditor({
  templateId,
  node,
  nextLevel,
  categories,
  topics,
  assets,
  onCancel,
  onSaved,
  phases = [],
}: {
  templateId: string;
  node?: TemplateNodeData;
  nextLevel?: number;
  categories: PickerCategory[];
  topics: PickerTopic[];
  assets: PickerAsset[];
  onCancel: () => void;
  onSaved?: () => void;
  phases?: PhaseOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<NodeKind>(
    normalizeKind(node?.kind ?? "practice"),
  );
  const [passRule, setPassRule] = useState<NodePassRule>(
    node?.pass_rule ?? defaultPassRule(normalizeKind(node?.kind ?? "practice")),
  );
  const [title, setTitle] = useState(node?.title ?? "");
  const [assetId, setAssetId] = useState(node?.library_asset_id ?? "");
  const [resourceUrl, setResourceUrl] = useState(
    node?.default_resource_url ?? "",
  );
  const [durationWeeks, setDurationWeeks] = useState<number>(
    node?.duration_weeks && node.duration_weeks >= 1
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
          <p className="text-lg font-bold tracking-tight">{levelLabel}</p>
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
              setPassRule(defaultPassRule(next));
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

        <NodeGateFields
          kind={kind}
          passRule={passRule}
          onPassRuleChange={setPassRule}
          checkInKind={node?.check_in_kind}
          passScore={node?.pass_score}
          selectClass="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        />

        <PhaseFields
          kind={kind}
          phases={phases}
          nodeId={node?.id}
          initialPhaseKey={node?.phase_key}
          initialIsCheckpoint={Boolean(node?.is_phase_checkpoint)}
          selectClass="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          idPrefix="tn"
        />

        <div className="space-y-2">
          <Label htmlFor="tn-code">Código</Label>
          <Input
            id="tn-code"
            name="node_code"
            defaultValue={node?.node_code ?? ""}
            placeholder="A1"
          />
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
          <Label htmlFor="tn-duration">Duração do nível</Label>
          <div className="flex h-10 overflow-hidden rounded-lg border border-input bg-transparent">
            <Input
              id="tn-duration"
              type="number"
              min={1}
              max={52}
              step={1}
              value={durationWeeks}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next) && next >= 1) setDurationWeeks(next);
              }}
              className="h-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <span className="flex items-center border-l border-input px-3 text-sm text-muted-foreground">
              semanas
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Mínimo 1 semana (segunda a sexta).
          </p>
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
