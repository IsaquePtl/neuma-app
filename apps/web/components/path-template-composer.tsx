"use client";

import { useEffect, useMemo, useState, useTransition, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
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
  deletePathTemplate,
  deleteTemplateNode,
  upsertPathTemplate,
} from "@/lib/actions/path-templates";
import {
  TemplateNodeEditor,
  type TemplateNodeData,
} from "@/components/template-node-editor";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeEndDate,
  formatPathEndDate,
  formatWeeksLabel,
  normalizeToMonday,
  weeksBetweenDates,
} from "@/lib/path-period";
import {
  initialPeriodMonths,
  PeriodMonthsInput,
} from "@/components/path-schedule-fields";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import { cn } from "@/lib/utils";
import { LIBRARY_PATH } from "@/lib/library-routes";
import { nodeKindLabel, phaseKeyLabel } from "@/lib/labels";
import {
  normalizePhaseKey,
  phaseOptions,
  resolvePhaseCheckpointIds,
} from "@/lib/nodes/phases";
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
  const router = useRouter();
  const [title, setTitle] = useState(template.title);
  const [startDate, setStartDate] = useState(template.start_date ?? "");
  const [periodMonths, setPeriodMonths] = useState(() =>
    initialPeriodMonths(
      template.duration_label,
      template.start_date,
      template.end_date,
      template.period_months,
    ),
  );
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const phases = useMemo(() => phaseOptions(nodes), [nodes]);
  const phaseByKey = useMemo(() => new Map(phases.map((p) => [p.key, p])), [phases]);
  const checkpointIds = useMemo(() => resolvePhaseCheckpointIds(nodes), [nodes]);
  const phaseKeys = useMemo(() => nodes.map((n) => normalizePhaseKey(n.phase_key)), [nodes]);
  const [metaPending, startMetaTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    setTitle(template.title);
    setStartDate(template.start_date ?? "");
    setPeriodMonths(
      initialPeriodMonths(
        template.duration_label,
        template.start_date,
        template.end_date,
        template.period_months,
      ),
    );
  }, [
    template.title,
    template.start_date,
    template.end_date,
    template.period_months,
    template.duration_label,
  ]);

  const endDate = useMemo(
    () => computeEndDate(startDate || null, periodMonths),
    [startDate, periodMonths],
  );

  const totalWeeks = useMemo(() => {
    if (!startDate || !endDate) return null;
    return weeksBetweenDates(normalizeToMonday(startDate), endDate);
  }, [startDate, endDate]);

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
    if (nextPeriod && nextPeriod > 0) fd.set("period_months", String(nextPeriod));

    startMetaTransition(async () => {
      try {
        await upsertPathTemplate(fd);
      } catch {
        toast.error("Não foi possível guardar");
      }
    });
  }

  function onDeleteTemplate() {
    if (
      !window.confirm(
        `Apagar o template “${template.title}”? Deixa de aparecer na lista.`,
      )
    ) {
      return;
    }
    startDeleteTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", template.id);
        fd.set("redirect", "0");
        await deletePathTemplate(fd);
        toast.success("Template apagado");
        router.push(LIBRARY_PATH);
      } catch {
        toast.error("Não foi possível apagar o template");
      }
    });
  }

  return (
    <div className="w-full space-y-8 pb-8">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/studio/journeys#drafts"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Voltar a Percursos
          </Link>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="gap-1.5"
            disabled={deletePending}
            onClick={onDeleteTemplate}
          >
            <Trash2 className="size-3.5" />
            {deletePending ? "A apagar…" : "Apagar template"}
          </Button>
        </div>
        <div className="space-y-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveMeta({ title })}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="h-auto border-0 bg-transparent px-0 text-2xl font-bold tracking-tight shadow-none focus-visible:ring-0"
            aria-label="Título do percurso"
            disabled={metaPending}
          />
          <p className="text-sm text-muted-foreground">
            Constrói o percurso nível a nível. O aluno vai ver este mapa.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="path-period">Duração</Label>
            <PeriodMonthsInput
              id="path-period"
              value={periodMonths}
              disabled={metaPending}
              onChange={(next) => {
                setPeriodMonths(next);
                saveMeta({ period_months: next });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="path-start">Início do percurso</Label>
            <DatePicker
              id="path-start"
              value={startDate}
              disabled={metaPending}
              className="h-10"
              onValueChange={(raw) => {
                const next = raw ? normalizeToMonday(raw) : "";
                setStartDate(next);
                if (next) saveMeta({ start_date: next });
              }}
            />
          </div>
        </div>

        {startDate && endDate && totalWeeks != null ? (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Semanas
              </p>
              <p className="text-sm font-medium">{formatWeeksLabel(totalWeeks)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Fim do percurso
              </p>
              <p className="text-sm font-medium">{formatPathEndDate(endDate)}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Define duração e início (segunda-feira) para calcular as semanas e o
            fim.
          </p>
        )}
      </div>

      <ol className="student-path-journey relative list-none pl-0">
        {nodes.map((node, i) => {
          const Icon = kindIcon(node.kind);
          const levelNum = i + 1;
          const isEditing = editing === node.id;
          const period = durationLabel(node.duration_weeks);
          const key = phaseKeys[i];
          const isPhaseStart = Boolean(key) && (i === 0 || phaseKeys[i - 1] !== key);
          const isPhaseCheckpoint = checkpointIds.has(node.id);
          const phase = key ? phaseByKey.get(key) : undefined;
          const railInPhase = Boolean(phase?.checkpoint) && !isPhaseCheckpoint;

          return (
            <Fragment key={node.id}>
              {isPhaseStart && phase ? (
                <li className="relative list-none pb-3 pt-1 first:pt-0">
                  {i > 0 ? (
                    <span
                      aria-hidden
                      className="student-path-rail absolute inset-y-0 left-[2rem] w-px -translate-x-1/2 bg-white/20"
                    />
                  ) : null}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-[5.25rem]">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {phaseKeyLabel(key)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {phase.count} {phase.count === 1 ? "nível" : "níveis"} ·{" "}
                      {phase.checkpoint
                        ? `fecha com «${phase.checkpoint.title}»`
                        : "sem check-point de fase"}
                    </p>
                  </div>
                </li>
              ) : null}
            <li
              className="relative flex gap-4 pb-8 sm:gap-5"
            >
              <span
                aria-hidden
                className={cn(
                  "student-path-rail absolute bottom-0 left-[2rem] w-px -translate-x-1/2",
                  i === nodes.length - 1 && "hidden",
                  isPhaseCheckpoint
                    ? "top-[calc(0.125rem+3.5rem+0.25rem)]"
                    : "top-[calc(0.125rem+3.5rem)]",
                  railInPhase
                    ? "bg-[color-mix(in_oklch,color-mix(in_oklch,var(--neuma-blue)_25%,white)_55%,transparent)]"
                    : "bg-white/20",
                )}
              />

              <div className="ml-1 flex w-14 shrink-0 flex-col items-center pt-0.5">
                <span className="relative z-10 inline-grid size-14 shrink-0 place-items-center rounded-full">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-[var(--neuma-ink)]"
                  />
                  <span className="student-path-marker relative grid size-full place-items-center rounded-full neuma-gradient text-base font-semibold tabular-nums text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_45%,transparent)]">
                    {levelNum}
                  </span>
                  {isPhaseCheckpoint ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-1 rounded-full border-2 border-[color-mix(in_oklch,color-mix(in_oklch,var(--neuma-blue)_30%,white)_70%,transparent)]"
                    />
                  ) : null}
                </span>
              </div>

              {isEditing ? (
                <TemplateNodeEditor
                  templateId={template.id}
                  node={node}
                  categories={categories}
                  topics={topics}
                  assets={assets}
                  phases={phases}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="student-path-step student-path-step--active min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
                        <Icon className="size-3" />
                        {isPhaseCheckpoint
                          ? `Check-point · Fecha a ${phaseKeyLabel(key)}`
                          : node.kind === "milestone"
                            ? `${nodeKindLabel.milestone} solto`
                            : nodeKindLabel[node.kind]}
                        {period ? ` · ${period}` : null}
                      </p>
                      <p className="text-lg font-bold tracking-tight">
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
            </Fragment>
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
                phases={phases}
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
