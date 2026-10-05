"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";

import { NodeDialog, NodeEditorForm } from "@/components/node-dialog";
import {
  PathCalendarPanel,
  type CalendarLevel,
} from "@/components/path-calendar-panel";
import { WeekStepper } from "@/components/week-stepper";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import { initialPeriodMonths } from "@/components/path-schedule-fields";
import { PathStatusMenu } from "@/components/path-status-menu";
import { Button } from "@/components/ui/button";
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
  reorderNode,
  setNodeWeeks,
  setPathPhases,
} from "@/lib/actions/nodes";
import { useSortableList } from "@/lib/hooks/use-sortable-list";
import { deletePath, upsertPath } from "@/lib/actions/paths";
import { useJourneyEditDirty } from "@/lib/journey-path/edit-dirty-context";
import { formatDate, nodeKindLabel, phaseKeyLabel } from "@/lib/labels";
import {
  normalizePhaseKey,
  phaseOptions,
  phaseRangesOf,
  planPhaseAwareDrop,
  planPhaseAwareMove,
  planPhaseRanges,
  resolvePhaseCheckpointIds,
  type PhaseAwareMove,
  type PhaseRange,
} from "@/lib/nodes/phases";
import {
  maxWeeksForLevel,
  plannedWeeks,
  weekBudgetView,
} from "@/lib/nodes/week-budget";
import {
  approxWeeksForMonths,
  computeEndDate,
  normalizeToMonday,
  weekFridayForPath,
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

function levelWeeks(node: StudentNode): number {
  return plannedWeeks(node.duration_weeks);
}

function levelSpan(node: StudentNode): number {
  return levelWeeks(node) + Math.max(0, node.extended_weeks ?? 0);
}

/** Mirrors the server re-segmentation so numbers/weeks update instantly. */
function resequence(nodes: StudentNode[], startDate: string | null): StudentNode[] {
  let week = 1;
  return nodes.map((node) => {
    const span = levelSpan(node);
    const next = {
      ...node,
      week_number: week,
      due_date: startDate ? weekFridayForPath(startDate, week + span - 1) : node.due_date,
    };
    week += span;
    return next;
  });
}

function applyLocalMove(
  nodes: StudentNode[],
  id: string,
  move: PhaseAwareMove,
  startDate: string | null,
): StudentNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ordered = move.orderedIds.flatMap((nodeId) => {
    const base = byId.get(nodeId);
    if (!base) return [];
    return [nodeId === id && move.phaseChanged ? { ...base, phase_key: move.phaseKey } : base];
  });
  return resequence(ordered, startDate);
}

function weekRangeLabel(node: StudentNode): string | null {
  if (!node.week_number) return null;
  const last = node.week_number + levelSpan(node) - 1;
  return last > node.week_number
    ? `Sem. ${node.week_number}–${last}`
    : `Sem. ${node.week_number}`;
}

/** Edit mode keeps every level fully readable, including locked and completed. */
function stepClass() {
  return "student-path-step--active";
}

export function JourneyPathComposer({
  studentId,
  studentName,
  path,
  nodes: serverNodes,
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
  const { reportUnsaved, acknowledgeSaved } = useJourneyEditDirty();
  // Dropped automatically once the server sends a fresh `nodes` array.
  const [optimistic, setOptimistic] = useState<{
    base: StudentNode[];
    nodes: StudentNode[];
  } | null>(null);
  const nodes =
    optimistic && optimistic.base === serverNodes ? optimistic.nodes : serverNodes;
  const [reordering, startReorder] = useTransition();
  const activeId = nodes.find((n) => n.status === "active")?.id ?? null;
  const [expanded, setExpanded] = useState<string | null>(activeId);
  const [levelDirty, setLevelDirty] = useState(false);
  const levelSave = useRef<(() => Promise<boolean>) | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createWeeks, setCreateWeeks] = useState<number | undefined>();
  const phases = useMemo(() => phaseOptions(nodes), [nodes]);
  const phaseByKey = useMemo(() => new Map(phases.map((p) => [p.key, p])), [phases]);
  const checkpointIds = useMemo(() => resolvePhaseCheckpointIds(nodes), [nodes]);
  const phaseKeys = useMemo(() => nodes.map((n) => normalizePhaseKey(n.phase_key)), [nodes]);

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const canDragLevel = useCallback(
    (id: string) => id !== expanded && !checkpointIds.has(id),
    [checkpointIds, expanded],
  );
  const dropLevel = (id: string, toIndex: number) => {
    const move = planPhaseAwareDrop(nodes, id, toIndex);
    if (!move) return;
    setOptimistic({
      base: serverNodes,
      nodes: applyLocalMove(nodes, id, move, path.start_date),
    });
    startReorder(async () => {
      try {
        await reorderNode({ id, pathId: path.id, toIndex });
      } catch {
        setOptimistic(null);
        toast.error("Não foi possível mudar a ordem");
      }
    });
  };
  const { drag, listRef, itemRef, onPointerDown } = useSortableList({
    ids: nodeIds,
    canDrag: canDragLevel,
    onDrop: dropLevel,
    disabled: reordering || savingAll,
  });
  const dropPreview = useMemo(() => {
    if (!drag) return null;
    const move = planPhaseAwareDrop(nodes, drag.id, drag.toIndex);
    if (!move) return null;
    const next = applyLocalMove(nodes, drag.id, move, path.start_date);
    const index = next.findIndex((n) => n.id === drag.id);
    const moved = next[index];
    const parts = [`Nível ${index + 1}`];
    const weeks = moved ? weekRangeLabel(moved) : null;
    if (weeks) parts.push(weeks);
    if (move.phaseChanged) {
      parts.push(move.phaseKey ? `entra na ${phaseKeyLabel(move.phaseKey)}` : "sai da fase");
    }
    return parts.join(" · ");
  }, [drag, nodes, path.start_date]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
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

  const savedPeriod = initialPeriodMonths(
    path.duration_label,
    path.start_date,
    path.end_date,
  );
  const scheduleDirty =
    startDate !== (path.start_date ?? "") || periodMonths !== savedPeriod;
  const metaDirty =
    title.trim() !== path.title ||
    description.trim() !== (path.description ?? "").trim() ||
    goal.trim() !== (path.goal ?? "").trim() ||
    scheduleDirty;
  const hasUnsaved = metaDirty || levelDirty;

  const savedTotalWeeks =
    path.start_date && path.end_date
      ? weeksBetweenDates(path.start_date, path.end_date)
      : null;
  const budget = weekBudgetView(savedTotalWeeks, nodes);
  const calendarLevels = useMemo<CalendarLevel[]>(
    () =>
      nodes.map((n, i) => ({
        id: n.id,
        title: n.title,
        number: i + 1,
        weeks: levelWeeks(n),
        extendedWeeks: Math.max(0, n.extended_weeks ?? 0),
        status: n.status,
        phaseKey: phaseKeys[i],
        isPhaseCheckpoint: checkpointIds.has(n.id),
      })),
    [nodes, phaseKeys, checkpointIds],
  );
  const phaseRanges = useMemo(() => phaseRangesOf(nodes), [nodes]);
  const phaseTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (phaseTimer.current) window.clearTimeout(phaseTimer.current);
    },
    [],
  );

  function changePhases(next: PhaseRange[]) {
    setOptimistic({ base: serverNodes, nodes: planPhaseRanges(nodes, next) });
    if (phaseTimer.current) window.clearTimeout(phaseTimer.current);
    phaseTimer.current = window.setTimeout(() => {
      phaseTimer.current = null;
      startReorder(async () => {
        const result = await setPathPhases({ pathId: path.id, phases: next });
        if (!result.ok) {
          setOptimistic(null);
          toast.error(result.error);
        }
      });
    }, 400);
  }

  const weekTimers = useRef(new Map<string, number>());
  useEffect(() => {
    const timers = weekTimers.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  function changeLevelWeeks(id: string, weeks: number) {
    setOptimistic({
      base: serverNodes,
      nodes: resequence(
        nodes.map((n) => (n.id === id ? { ...n, duration_weeks: weeks } : n)),
        path.start_date,
      ),
    });
    const timers = weekTimers.current;
    const pending = timers.get(id);
    if (pending) window.clearTimeout(pending);
    timers.set(
      id,
      window.setTimeout(() => {
        timers.delete(id);
        startReorder(async () => {
          const result = await setNodeWeeks({ id, pathId: path.id, weeks });
          if (!result.ok) {
            setOptimistic(null);
            toast.error(result.error);
          }
        });
      }, 450),
    );
  }

  function focusLevel(id: string) {
    if (
      expanded !== id &&
      levelDirty &&
      !window.confirm("Este nível tem alterações por guardar. Descartá-las?")
    ) {
      return;
    }
    setExpanded(id);
    requestAnimationFrame(() =>
      document
        .getElementById(`level-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  async function saveMeta(): Promise<boolean> {
    if (!metaDirty) return true;
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast.error("O percurso precisa de um título");
      return false;
    }
    const fd = new FormData();
    fd.set("id", path.id);
    fd.set("student_id", studentId);
    fd.set("title", nextTitle);
    fd.set("description", description.trim());
    fd.set("goal", goal.trim());
    fd.set("status", path.status);
    if (startDate) fd.set("start_date", startDate);
    if (periodMonths > 0) fd.set("period_months", String(periodMonths));

    try {
      await upsertPath(fd);
      return true;
    } catch {
      toast.error("Não foi possível guardar o percurso");
      return false;
    }
  }

  async function saveAll(): Promise<boolean> {
    if (savingAll) return false;
    setSavingAll(true);
    try {
      const metaWasDirty = metaDirty;
      const metaOk = await saveMeta();
      if (!metaOk) return false;
      const levelOk =
        levelDirty && levelSave.current ? await levelSave.current() : true;
      if (!levelOk) return false;
      if (metaWasDirty) {
        toast.success("Alterações guardadas");
        router.refresh();
      }
      acknowledgeSaved();
      return true;
    } finally {
      setSavingAll(false);
    }
  }

  function discardAll() {
    setTitle(path.title);
    setDescription(path.description ?? "");
    setGoal(path.goal ?? "");
    setStartDate(path.start_date ?? "");
    setPeriodMonths(savedPeriod);
    setSnapHint(false);
    if (levelDirty) setExpanded(null);
  }

  const saveAllRef = useRef(saveAll);
  useEffect(() => {
    saveAllRef.current = saveAll;
  });

  useEffect(() => {
    reportUnsaved(hasUnsaved ? { save: () => saveAllRef.current() } : null);
  }, [hasUnsaved, reportUnsaved]);

  useEffect(() => () => reportUnsaved(null), [reportUnsaved]);

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
                disabled={savingAll}
                aria-label="Título do percurso"
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveAll();
                  }
                }}
                className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 text-xl font-bold tracking-tight shadow-none focus-visible:ring-0 sm:text-2xl dark:bg-transparent"
              />
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
            <Textarea
              value={description}
              disabled={savingAll}
              rows={2}
              placeholder="Descrição"
              aria-label="Descrição"
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Textarea
              value={goal}
              disabled={savingAll}
              rows={2}
              placeholder="Objetivo"
              aria-label="Objetivo"
              onChange={(event) => setGoal(event.target.value)}
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
              phases={phases}
              weeksMax={budget.free ?? undefined}
              defaultWeeks={createWeeks}
              open={createOpen}
              onOpenChange={(next) => {
                setCreateOpen(next);
                if (!next) setCreateWeeks(undefined);
              }}
            />
          </div>
        </div>
      </div>

      <PathCalendarPanel
        months={periodMonths}
        onMonthsChange={setPeriodMonths}
        startDate={startDate}
        onStartDateChange={(raw) => {
          if (!raw) {
            setSnapHint(false);
            setStartDate("");
            return;
          }
          const monday = normalizeToMonday(raw);
          setSnapHint(monday !== raw);
          setStartDate(monday);
        }}
        snapHint={snapHint}
        endDate={schedule?.endDate ?? null}
        totalWeeks={schedule?.weeks ?? approxWeeksForMonths(periodMonths)}
        approximate={!schedule}
        levels={calendarLevels}
        disabled={savingAll}
        scheduleDirty={scheduleDirty}
        onSelectLevel={focusLevel}
        onAddLevel={(weeks) => {
          setCreateWeeks(weeks);
          setCreateOpen(true);
        }}
        phaseRanges={phaseRanges}
        onPhaseRangesChange={changePhases}
      />

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
        <ol ref={listRef} className="student-path-journey relative list-none pl-0">
          {drag && dropPreview ? (
            <li
              aria-hidden
              className="pointer-events-none absolute right-0 left-[4.25rem] z-30 -translate-y-1/2 sm:left-[5.25rem]"
              style={{ top: Math.max(0, drag.indicatorTop - 16) }}
            >
              <span className="block h-0.5 rounded-full bg-[color-mix(in_oklch,var(--neuma-blue)_45%,white)] shadow-[0_0_12px_color-mix(in_oklch,var(--neuma-blue)_60%,transparent)]" />
              <span className="absolute -top-2.5 right-0 -translate-y-full rounded-md border border-white/10 bg-[var(--neuma-ink)] px-2 py-0.5 text-[11px] font-medium text-foreground shadow-lg">
                {dropPreview}
              </span>
            </li>
          ) : null}
          {nodes.map((node, i) => {
            const Icon = kindIcon(node.kind);
            const levelNum = i + 1;
            const isOpen = expanded === node.id;
            const key = phaseKeys[i];
            const isPhaseStart = Boolean(key) && (i === 0 || phaseKeys[i - 1] !== key);
            const isPhaseCheckpoint = checkpointIds.has(node.id);
            const phase = key ? phaseByKey.get(key) : undefined;
            const railInPhase = Boolean(phase?.checkpoint) && !isPhaseCheckpoint;
            const draggable = canDragLevel(node.id);
            const isDragging = drag?.id === node.id;
            const moveUp = planPhaseAwareMove(nodes, node.id, "up");
            const moveDown = planPhaseAwareMove(nodes, node.id, "down");
            const moveLabel = (
              move: ReturnType<typeof planPhaseAwareMove>,
              base: string,
            ) =>
              move?.phaseChanged
                ? move.phaseKey
                  ? `${base} — entra na Fase ${move.phaseKey}`
                  : `${base} — sai da fase`
                : base;

            return (
              <Fragment key={node.id}>
                {isPhaseStart && phase ? (
                  <li className="relative list-none pb-3 pt-1 first:pt-0">
                    {i > 0 ? (
                      <span
                        aria-hidden
                        className="student-path-rail absolute inset-y-0 left-[1.75rem] w-px -translate-x-1/2 bg-white/20 sm:left-[2rem]"
                      />
                    ) : null}
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-[4.25rem] sm:pl-[5.25rem]">
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
                id={`level-${node.id}`}
                ref={itemRef(node.id)}
                onPointerDown={onPointerDown(node.id)}
                style={isDragging ? { transform: `translateY(${drag?.dy ?? 0}px)` } : undefined}
                className={cn(
                  "relative flex min-w-0 gap-3 pb-8 [-webkit-touch-callout:none] sm:gap-5",
                  draggable && !drag && "cursor-grab",
                  drag && "select-none",
                  isDragging && "z-40 cursor-grabbing",
                  drag && !isDragging && "transition-opacity",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "student-path-rail absolute bottom-0 left-[1.75rem] w-px -translate-x-1/2 sm:left-[2rem]",
                    (i === nodes.length - 1 || isDragging) && "hidden",
                    // size-12 mobile / size-14 desktop; + anel no check-point
                    isPhaseCheckpoint
                      ? "top-[calc(0.125rem+3rem+0.25rem)] sm:top-[calc(0.125rem+3.5rem+0.25rem)]"
                      : "top-[calc(0.125rem+3rem)] sm:top-[calc(0.125rem+3.5rem)]",
                    railInPhase
                      ? "bg-[color-mix(in_oklch,color-mix(in_oklch,var(--neuma-blue)_25%,white)_55%,transparent)]"
                      : "bg-white/20",
                  )}
                />

                <div className="ml-1 flex w-12 shrink-0 flex-col items-center pt-0.5 sm:w-14">
                  <span className="relative z-10 inline-grid size-12 shrink-0 place-items-center rounded-full sm:size-14">
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-[var(--neuma-ink)]"
                    />
                    <span
                      className={cn(
                        "student-path-marker relative grid size-full place-items-center rounded-full text-sm font-semibold tabular-nums sm:text-base",
                        node.status === "active"
                          ? "neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_45%,transparent)]"
                          : "border-2 border-white/20 bg-white/[0.03] text-foreground",
                      )}
                    >
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

                <div
                  className={cn(
                    "student-path-step relative min-w-0 flex-1 overflow-hidden transition-[box-shadow,transform]",
                    stepClass(),
                    isDragging &&
                      "scale-[1.015] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)] ring-1 ring-[color-mix(in_oklch,var(--neuma-blue)_45%,white)]",
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
                          {isPhaseCheckpoint
                            ? `Check-point · Fecha a ${phaseKeyLabel(key)}`
                            : node.kind === "milestone"
                              ? `${nodeKindLabel.milestone} solto`
                              : nodeKindLabel[node.kind]}
                          {weekRangeLabel(node) ? ` · ${weekRangeLabel(node)}` : ""}
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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2">
                        <WeekStepper
                          size="sm"
                          label={`Semanas do nível ${levelNum}`}
                          value={levelWeeks(node)}
                          max={maxWeeksForLevel(budget, levelWeeks(node))}
                          disabled={savingAll || Boolean(drag)}
                          maxReachedHint="Sem semanas livres — tira a outro nível ou aumenta a duração"
                          onChange={(weeks) => changeLevelWeeks(node.id, weeks)}
                        />
                        {node.extended_weeks ? (
                          <span className="rounded-full bg-[color-mix(in_oklch,var(--neuma-orange)_18%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[color-mix(in_oklch,var(--neuma-orange)_80%,white)]">
                            +{node.extended_weeks} sem. prolongada{node.extended_weeks === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {node.due_date ? (
                          <span className="text-xs text-muted-foreground">
                            até {formatDate(node.due_date)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {draggable ? (
                      <GripVertical
                        aria-hidden
                        className="mt-1.5 size-4 shrink-0 text-muted-foreground/50"
                      />
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={isOpen ? "default" : "outline"}
                      className="shrink-0 gap-1.5"
                      aria-label={isOpen ? "Fechar edição" : "Editar nível"}
                      onClick={() => {
                        if (
                          levelDirty &&
                          !window.confirm(
                            "Este nível tem alterações por guardar. Descartá-las?",
                          )
                        ) {
                          return;
                        }
                        setExpanded((prev) =>
                          prev === node.id ? null : node.id,
                        );
                      }}
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
                            disabled={!moveUp}
                            aria-label={moveLabel(moveUp, "Subir")}
                            title={moveLabel(moveUp, "Subir")}
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
                            disabled={!moveDown}
                            aria-label={moveLabel(moveDown, "Descer")}
                            title={moveLabel(moveDown, "Descer")}
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </form>
                        {isPhaseCheckpoint ? (
                          <span className="px-1 text-xs text-muted-foreground">
                            Fica sempre no fim da {phaseKeyLabel(key)}
                          </span>
                        ) : null}
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
                        phases={phases}
                        onDirtyChange={setLevelDirty}
                        saveHandleRef={levelSave}
                        hideWeeks
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

      {hasUnsaved ? (
        <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-30 flex justify-center">
          <div className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-[color-mix(in_oklch,var(--neuma-ink)_88%,transparent)] p-2 pl-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md">
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              Alterações por guardar
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={savingAll}
              onClick={discardAll}
            >
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingAll}
              onClick={() => void saveAll()}
            >
              {savingAll ? "A guardar…" : "Guardar alterações"}
            </Button>
          </div>
        </div>
      ) : null}
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
