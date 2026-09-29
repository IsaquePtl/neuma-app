"use client";

import { useMemo, useState, useTransition, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";

import { NodeDialog, NodeEditorForm } from "@/components/node-dialog";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import {
  initialPeriodMonths,
  PeriodMonthsInput,
} from "@/components/path-schedule-fields";
import { PathStatusMenu } from "@/components/path-status-menu";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  activateNode,
  deleteNode,
  moveNode,
} from "@/lib/actions/nodes";
import { deletePath, upsertPath } from "@/lib/actions/paths";
import { useJourneyEditDirty } from "@/lib/journey-path/edit-dirty-context";
import { formatDate, isPhaseBoundary, nodeKindLabel, phaseKeyLabel } from "@/lib/labels";
import {
  computeEndDate,
  formatPathEndDate,
  formatWeeksLabel,
  normalizeToMonday,
  weeksBetweenDates,
} from "@/lib/path-period";
import type { StudentNode, StudentPath } from "@/lib/students/queries";
import type { NodeKind } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import {
  Dumbbell,
  Flag,
  Phone,
  Video,
} from "lucide-react";

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

function kindAccent(
  kind: NodeKind,
): "practice" | "milestone" | "call" | null {
  if (kind === "practice") return "practice";
  if (kind === "milestone") return "milestone";
  if (kind === "call") return "call";
  return null;
}

/** Edit mode keeps every level fully readable, including locked and completed. */
function stepClass() {
  return "student-path-step--active";
}

export function JourneyPathComposer({
  studentId,
  studentName,
  path,
  nodes,
  libraryCategories = [],
  libraryTopics = [],
  libraryAssets = [],
  autoFocusTitle = false,
}: {
  studentId: string;
  studentName: string;
  path: StudentPath;
  nodes: StudentNode[];
  libraryCategories?: PickerCategory[];
  libraryTopics?: PickerTopic[];
  libraryAssets?: PickerAsset[];
  autoFocusTitle?: boolean;
}) {
  const router = useRouter();
  const { isDirty, save: savePathChanges, pending: savePending } =
    useJourneyEditDirty();
  const activeId = nodes.find((n) => n.status === "active")?.id ?? null;
  const [expanded, setExpanded] = useState<string | null>(activeId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [metaPending, startMetaTransition] = useTransition();
  const [title, setTitle] = useState(path.title);
  const [description, setDescription] = useState(path.description ?? "");
  const [goal, setGoal] = useState(path.goal ?? "");
  const [startDate, setStartDate] = useState(path.start_date ?? "");
  const [periodMonths, setPeriodMonths] = useState(() =>
    initialPeriodMonths(
      path.duration_label,
      path.start_date,
      path.end_date,
    ),
  );
  const [snapHint, setSnapHint] = useState(false);

  const schedule = useMemo(() => {
    if (!startDate || periodMonths < 1) return null;
    const startMonday = normalizeToMonday(startDate);
    const endDate = computeEndDate(startMonday, periodMonths);
    if (!endDate) return null;
    return {
      endDate,
      weeks: weeksBetweenDates(startMonday, endDate),
    };
  }, [startDate, periodMonths]);

  function saveMeta(overrides?: {
    title?: string;
    description?: string;
    goal?: string;
    start_date?: string;
    period_months?: number;
  }) {
    const nextTitle = (overrides?.title ?? title).trim();
    if (!nextTitle) {
      setTitle(path.title);
      return;
    }
    const nextDescription = (overrides?.description ?? description).trim();
    const nextGoal = (overrides?.goal ?? goal).trim();
    const nextStart = overrides?.start_date ?? startDate;
    const nextPeriod = overrides?.period_months ?? periodMonths;
    const savedPeriod = initialPeriodMonths(
      path.duration_label,
      path.start_date,
      path.end_date,
    );
    if (
      nextTitle === path.title &&
      nextDescription === (path.description ?? "").trim() &&
      nextGoal === (path.goal ?? "").trim() &&
      nextStart === (path.start_date ?? "") &&
      nextPeriod === savedPeriod
    ) {
      return;
    }

    const fd = new FormData();
    fd.set("id", path.id);
    fd.set("student_id", studentId);
    fd.set("title", nextTitle);
    fd.set("description", nextDescription);
    fd.set("goal", nextGoal);
    fd.set("status", path.status);
    if (nextStart) fd.set("start_date", nextStart);
    if (nextPeriod > 0) fd.set("period_months", String(nextPeriod));

    const refreshNodes =
      overrides?.start_date !== undefined ||
      overrides?.period_months !== undefined;

    startMetaTransition(async () => {
      try {
        await upsertPath(fd);
        if (refreshNodes) router.refresh();
      } catch {
        toast.error("Não foi possível guardar o percurso");
      }
    });
  }

  function confirmDelete() {
    startDeleteTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", path.id);
        fd.set("student_id", studentId);
        await deletePath(fd);
        toast.success("Percurso eliminado");
        setDeleteOpen(false);
        router.push("/studio/journeys");
      } catch {
        toast.error("Não foi possível eliminar o percurso");
      }
    });
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Input
                value={title}
                autoFocus={autoFocusTitle}
                disabled={metaPending}
                aria-label="Título do percurso"
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => saveMeta({ title })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 text-xl font-bold tracking-tight shadow-none focus-visible:ring-0 sm:text-2xl dark:bg-transparent"
              />
              {isDirty ? (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  disabled={savePending}
                  onClick={savePathChanges}
                >
                  {savePending ? "A guardar…" : "Guardar"}
                </Button>
              ) : null}
            </div>
            <p className="break-words text-sm text-muted-foreground">
              {studentName}
            </p>
            <div className="flex min-w-0 flex-wrap items-end gap-3">
              <PathStatusMenu
                pathId={path.id}
                studentId={studentId}
                status={path.status}
              />
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Duração
                </p>
                <div className="w-40">
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
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Início
                </p>
                <DatePicker
                  id="path-start"
                  value={startDate}
                  disabled={metaPending}
                  className="h-10 w-44"
                  onValueChange={(raw) => {
                    if (!raw) {
                      setSnapHint(false);
                      setStartDate("");
                      saveMeta({ start_date: "" });
                      return;
                    }
                    const monday = normalizeToMonday(raw);
                    setSnapHint(monday !== raw);
                    setStartDate(monday);
                    saveMeta({ start_date: monday });
                  }}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="mb-0.5"
                onClick={() => setDeleteOpen(true)}
              >
                Eliminar
              </Button>
            </div>
            {snapHint ? (
              <p className="text-xs text-muted-foreground">
                Ajustámos para segunda-feira — os percursos começam sempre nesse dia.
              </p>
            ) : null}
            {schedule ? (
              <p className="text-xs text-muted-foreground">
                {formatWeeksLabel(schedule.weeks)} · fim{" "}
                {formatPathEndDate(schedule.endDate)}
              </p>
            ) : null}
            <Textarea
              value={description}
              disabled={metaPending}
              rows={2}
              placeholder="Descrição"
              aria-label="Descrição"
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => saveMeta({ description })}
              className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Textarea
              value={goal}
              disabled={metaPending}
              rows={2}
              placeholder="Objetivo"
              aria-label="Objetivo"
              onChange={(event) => setGoal(event.target.value)}
              onBlur={() => saveMeta({ goal })}
              className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button
              render={<Link href={`/studio/journeys/${path.id}`} />}
              nativeButton={false}
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 sm:flex-none"
            >
              Ver percurso
            </Button>
            <NodeDialog
              pathId={path.id}
              categories={libraryCategories}
              topics={libraryTopics}
              assets={libraryAssets}
            />
          </div>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={!deletePending}>
          <DialogHeader>
            <DialogTitle>Eliminar percurso?</DialogTitle>
            <DialogDescription>
              Este percurso e todos os níveis serão apagados permanentemente.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletePending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={confirmDelete}
            >
              {deletePending ? "A eliminar…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-muted-foreground">
          Ainda sem níveis. Adiciona o primeiro bloco.
        </div>
      ) : (
        <ol className="student-path-journey relative list-none pl-0">
          {nodes.map((node, i) => {
            const Icon = kindIcon(node.kind);
            const levelNum = i + 1;
            const isOpen = expanded === node.id;

            return (
              <Fragment key={node.id}>
                {isPhaseBoundary(nodes, i) ? (
                  <li className="relative list-none pb-3 pt-1 first:pt-0">
                    <p className="pl-[3.5rem] text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:pl-[4.25rem]">
                      {phaseKeyLabel(node.phase_key)}
                    </p>
                  </li>
                ) : null}
              <li
                className="relative flex min-w-0 gap-3 pb-8 sm:gap-5"
              >
                {i < nodes.length - 1 ? (
                  <span
                    aria-hidden
                    className="student-path-rail absolute bottom-0 left-[1.45rem] top-12 w-px bg-white/15 sm:left-[1.7rem] sm:top-14"
                  />
                ) : null}

                <div className="flex flex-col items-center pt-0.5">
                  <span
                    className={cn(
                      "student-path-marker relative z-10 grid size-12 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums sm:size-14 sm:text-base",
                      node.status === "active"
                        ? "neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_45%,transparent)]"
                        : "border-2 border-white/20 bg-white/10 text-foreground",
                    )}
                  >
                    {levelNum}
                  </span>
                </div>

                <div
                  className={cn(
                    "student-path-step relative min-w-0 flex-1 overflow-hidden",
                    stepClass(),
                  )}
                >
                  {kindAccent(node.kind) === "practice" ||
                  kindAccent(node.kind) === "milestone" ? (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-[3px]",
                        kindAccent(node.kind) === "practice"
                          ? "bg-[color-mix(in_srgb,var(--neuma-lime)_42%,var(--neuma-cream))]"
                          : "bg-[color-mix(in_srgb,var(--neuma-coral)_40%,var(--neuma-cream))]",
                      )}
                    />
                  ) : null}
                  <div className="flex w-full min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p
                        className={cn(
                          "inline-flex max-w-full flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em]",
                          kindAccent(node.kind) === "practice" &&
                            "text-[color-mix(in_srgb,var(--neuma-lime)_38%,var(--neuma-cream))]",
                          kindAccent(node.kind) === "milestone" &&
                            "text-[color-mix(in_srgb,var(--neuma-coral)_36%,var(--neuma-cream))]",
                          kindAccent(node.kind) === "call" &&
                            "text-[color-mix(in_srgb,var(--neuma-coral)_36%,var(--neuma-cream))]",
                          !kindAccent(node.kind) && "text-[var(--neuma-coral)]",
                        )}
                      >
                        <Icon className="size-3 shrink-0" />
                        <span className="min-w-0 break-words">
                          {nodeKindLabel[node.kind]}
                          {node.duration_weeks
                            ? ` · ${node.duration_weeks === 1 ? "1 semana" : `${node.duration_weeks} semanas`}`
                            : node.week_number
                              ? ` · Sem. ${node.week_number}`
                              : ""}
                          {node.due_date
                            ? ` · até ${formatDate(node.due_date)}`
                            : null}
                        </span>
                      </p>
                      <p className="break-words text-base font-bold tracking-tight sm:text-lg">
                        {node.title}
                      </p>
                      {node.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {node.description}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isOpen ? "default" : "outline"}
                      className="shrink-0 gap-1.5"
                      aria-label={isOpen ? "Fechar edição" : "Editar nível"}
                      onClick={() =>
                        setExpanded((prev) =>
                          prev === node.id ? null : node.id,
                        )
                      }
                    >
                      <Pencil className="size-3.5" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                  </div>

                  {isOpen ? (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                      <div className="flex flex-wrap items-center gap-1">
                        <form action={moveNode}>
                          <input type="hidden" name="id" value={node.id} />
                          <input
                            type="hidden"
                            name="path_id"
                            value={path.id}
                          />
                          <input type="hidden" name="direction" value="up" />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            disabled={i === 0}
                            aria-label="Subir"
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                        </form>
                        <form action={moveNode}>
                          <input type="hidden" name="id" value={node.id} />
                          <input
                            type="hidden"
                            name="path_id"
                            value={path.id}
                          />
                          <input
                            type="hidden"
                            name="direction"
                            value="down"
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            disabled={i === nodes.length - 1}
                            aria-label="Descer"
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </form>
                        {node.status !== "active" ? (
                          <form action={activateNode}>
                            <input type="hidden" name="id" value={node.id} />
                            <input
                              type="hidden"
                              name="path_id"
                              value={path.id}
                            />
                            <Button type="submit" variant="outline" size="sm">
                              Ativar nível
                            </Button>
                          </form>
                        ) : null}
                        <form action={deleteNode}>
                          <input type="hidden" name="id" value={node.id} />
                          <input
                            type="hidden"
                            name="path_id"
                            value={path.id}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      </div>

                      <NodeEditorForm
                        key={node.id}
                        pathId={path.id}
                        node={node}
                        categories={libraryCategories}
                        topics={libraryTopics}
                        assets={libraryAssets}
                        inline
                        idPrefix={node.id}
                        onSuccess={() => setExpanded(null)}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// Types shared with admin view and data loader
export type JourneyCheckIn = {
  id: string;
  node_id: string;
  status: import("@/lib/types/database.types").CheckInStatus;
  kind: import("@/lib/types/database.types").CheckInKind;
  created_at: string;
  notes: string | null;
  video_url: string | null;
  feedback: {
    notes: string | null;
    next_steps: string | null;
    video_url: string | null;
    approved: boolean;
  } | null;
  draft: {
    id: string;
    body_notes: string | null;
    body_next_steps: string | null;
  } | null;
};

export type JourneyLevelFeedback = {
  id: string;
  node_id: string;
  notes: string | null;
  video_url: string | null;
  file_url: string | null;
  created_at: string;
};
