"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Dumbbell,
  Flag,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteTemplateNode,
  upsertPathTemplate,
} from "@/lib/actions/path-templates";
import {
  TemplateNodeEditor,
  type TemplateNodeData,
} from "@/components/template-node-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import { cn } from "@/lib/utils";
import { nodeKindLabel } from "@/lib/labels";
import type { NodeKind, PathTemplateStatus } from "@/lib/types/database.types";

type Template = {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_label: string | null;
  suggested_node_count: number | null;
  status: PathTemplateStatus;
  start_date: string | null;
  end_date: string | null;
  period_months: number | null;
};

type TemplateNode = TemplateNodeData & {
  order_index: number;
  asset_title: string | null;
};

const PERIOD_MONTHS = [2, 3, 4, 5, 6] as const;

function kindIcon(kind: NodeKind) {
  switch (kind) {
    case "call":
      return Phone;
    case "lesson":
    case "resource":
      return Video;
    case "milestone":
      return Flag;
    default:
      return Dumbbell;
  }
}

function addMonths(isoDate: string, months: number) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function durationLabel(weeks: number | null) {
  if (!weeks) return null;
  return weeks === 1 ? "1 semana" : `${weeks} semanas`;
}

export function PathTemplateComposer({
  template,
  nodes,
  categories,
  topics,
  assets,
}: {
  template: Template;
  nodes: TemplateNode[];
  categories: PickerCategory[];
  topics: PickerTopic[];
  assets: PickerAsset[];
}) {
  const [title, setTitle] = useState(template.title);
  const [startDate, setStartDate] = useState(template.start_date ?? "");
  const [periodMonths, setPeriodMonths] = useState<number>(
    template.period_months && template.period_months >= 2
      ? template.period_months
      : 3,
  );
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [metaPending, startMetaTransition] = useTransition();

  useEffect(() => {
    setTitle(template.title);
    setStartDate(template.start_date ?? "");
    if (template.period_months && template.period_months >= 2) {
      setPeriodMonths(template.period_months);
    }
  }, [template.title, template.start_date, template.period_months]);

  const endDate = useMemo(() => {
    if (!startDate) return null;
    return addMonths(startDate, periodMonths);
  }, [startDate, periodMonths]);

  function saveMeta(overrides?: {
    title?: string;
    start_date?: string;
    period_months?: number;
  }) {
    const nextTitle = (overrides?.title ?? title).trim() || "Novo percurso";
    const nextStart = overrides?.start_date ?? startDate;
    const nextPeriod = overrides?.period_months ?? periodMonths;

    const fd = new FormData();
    fd.set("id", template.id);
    fd.set("title", nextTitle);
    fd.set("description", template.description ?? "");
    fd.set("goal", template.goal ?? "");
    fd.set("status", template.status);
    if (template.suggested_node_count != null) {
      fd.set("suggested_node_count", String(template.suggested_node_count));
    }
    if (nextStart) fd.set("start_date", nextStart);
    fd.set("period_months", String(nextPeriod));

    startMetaTransition(async () => {
      try {
        await upsertPathTemplate(fd);
      } catch {
        toast.error("Não foi possível guardar");
      }
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 pb-8">
      <div className="space-y-5">
        <div className="space-y-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveMeta({ title })}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
            aria-label="Título do percurso"
            disabled={metaPending}
          />
          <p className="text-sm text-muted-foreground">
            Constrói o percurso nível a nível. O aluno vai ver este mapa.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="path-start">Data de início</Label>
            <Input
              id="path-start"
              type="date"
              value={startDate}
              disabled={metaPending}
              onChange={(e) => {
                const next = e.target.value;
                setStartDate(next);
                if (next) saveMeta({ start_date: next });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="path-period">Período</Label>
            <select
              id="path-period"
              value={periodMonths}
              disabled={metaPending}
              onChange={(e) => {
                const next = Number(e.target.value);
                setPeriodMonths(next);
                saveMeta({ period_months: next });
              }}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-50"
            >
              {PERIOD_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m} meses
                </option>
              ))}
            </select>
          </div>
        </div>

        {startDate && endDate ? (
          <p className="text-xs text-muted-foreground">
            Fim previsto:{" "}
            <span className="text-foreground/90">
              {formatShortDate(endDate)}
            </span>
            {" · "}
            {periodMonths} meses
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Define a data de início para calcular o fim do percurso.
          </p>
        )}
      </div>

      <ol className="student-path-journey relative list-none pl-0">
        {nodes.map((node, i) => {
          const Icon = kindIcon(node.kind);
          const levelNum = i + 1;
          const isEditing = editing === node.id;
          const period = durationLabel(node.duration_weeks);

          return (
            <li
              key={node.id}
              className="relative flex gap-4 pb-8 sm:gap-5"
            >
              <span
                aria-hidden
                className="student-path-rail absolute bottom-0 left-[1.7rem] top-14 w-px bg-white/15"
              />

              <div className="flex flex-col items-center pt-0.5">
                <span className="student-path-marker relative z-10 grid size-14 shrink-0 place-items-center rounded-full neuma-gradient text-base font-semibold tabular-nums text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_45%,transparent)]">
                  {levelNum}
                </span>
              </div>

              {isEditing ? (
                <TemplateNodeEditor
                  templateId={template.id}
                  node={node}
                  categories={categories}
                  topics={topics}
                  assets={assets}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="student-path-step student-path-step--active min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
                        <Icon className="size-3" />
                        {nodeKindLabel[node.kind]}
                        {period ? ` · ${period}` : null}
                      </p>
                      <p className="text-lg font-semibold tracking-tight">
                        {node.title}
                      </p>
                      {node.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {node.description}
                        </p>
                      ) : null}
                      {node.asset_title ? (
                        <p className="text-xs text-muted-foreground">
                          Biblioteca: {node.asset_title}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Editar nível"
                        onClick={() => setEditing(node.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <form
                        action={deleteTemplateNode}
                        onSubmit={(e) => {
                          if (!confirm("Eliminar este nível?"))
                            e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={node.id} />
                        <input
                          type="hidden"
                          name="template_id"
                          value={template.id}
                        />
                        <Button
                          type="submit"
                          size="icon"
                          variant="ghost"
                          aria-label="Eliminar nível"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}

        <li className="relative flex gap-4 sm:gap-5">
          {editing === "new" ? (
            <>
              <div className="flex flex-col items-center pt-0.5">
                <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full border-2 border-dashed border-[var(--neuma-coral)]/50 bg-white/[0.03] text-sm font-semibold tabular-nums text-[var(--neuma-coral)]">
                  {nodes.length + 1}
                </span>
              </div>
              <TemplateNodeEditor
                templateId={template.id}
                nextLevel={nodes.length + 1}
                categories={categories}
                topics={topics}
                assets={assets}
                onCancel={() => setEditing(null)}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="group flex w-full gap-4 rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50 sm:gap-5"
            >
              <span className="flex flex-col items-center pt-0.5">
                <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full border-2 border-dashed border-white/20 bg-white/[0.03] text-muted-foreground transition-colors group-hover:border-[var(--neuma-coral)]/50 group-hover:text-[var(--neuma-coral)]">
                  <Plus className="size-5" />
                </span>
              </span>
              <span
                className={cn(
                  "student-path-step min-w-0 flex-1 border border-dashed border-white/10 bg-white/[0.02]",
                  "transition-colors group-hover:border-[var(--neuma-coral)]/30",
                )}
              >
                <span className="block text-lg font-semibold tracking-tight text-muted-foreground group-hover:text-foreground">
                  Adicionar nível {nodes.length + 1}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Próximo passo do percurso
                </span>
              </span>
            </button>
          )}
        </li>
      </ol>
    </div>
  );
}
