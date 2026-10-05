"use client";

import { Fragment, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Lock,
  Phone,
  Video,
  Dumbbell,
  Flag,
  CalendarClock,
} from "lucide-react";

import type { StudentNode } from "@/lib/students/queries";
import { formatDate, nodeKindLabel, phaseKeyLabel } from "@/lib/labels";
import { normalizePhaseKey, resolvePhaseCheckpointIds } from "@/lib/nodes/phases";
import { cn } from "@/lib/utils";
import type { NodeKind } from "@/lib/types/database.types";
import {
  ActiveLevelFeedbackCta,
  ActiveLevelFeedbackHint,
} from "@/components/active-level-feedback-cta";

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

function nearestScrollRoot(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export type PathMapReview = {
  checkpointId: string;
  pendingIds: string[];
  done: number;
  total: number;
};

export function StudentPathMap({
  nodes,
  unviewedByNodeId = new Map<string, number>(),
  review = null,
}: {
  nodes: StudentNode[];
  unviewedByNodeId?: Map<string, number>;
  /** Failed phase checkpoint: levels still to revisit before the retry. */
  review?: PathMapReview | null;
}) {
  const activeIndex = nodes.findIndex((n) => n.status === "active");
  const activeRef = useRef<HTMLLIElement | null>(null);

  const checkpointIds = resolvePhaseCheckpointIds(nodes);
  const keys = nodes.map((n) => normalizePhaseKey(n.phase_key));
  const gatedKeys = new Set(
    nodes.filter((n) => checkpointIds.has(n.id)).map((n) => normalizePhaseKey(n.phase_key)),
  );
  const phaseProgress = new Map<string, { done: number; total: number }>();
  nodes.forEach((n, i) => {
    const key = keys[i];
    if (!key) return;
    const entry = phaseProgress.get(key) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (n.status === "completed") entry.done += 1;
    phaseProgress.set(key, entry);
  });
  const pendingReview = new Set(review?.pendingIds ?? []);

  useEffect(() => {
    // Só a partir do nível 5 (índice 4): topo → centrar o actual.
    if (activeIndex < 4) return;
    const el = activeRef.current;
    if (!el) return;

    const scrollRoot = nearestScrollRoot(el);
    if (scrollRoot) scrollRoot.scrollTop = 0;
    else window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const timeout = window.setTimeout(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [activeIndex]);

  return (
    <ol className="student-path-journey relative w-full list-none pl-0">
      {nodes.map((node, i) => {
        const isActive =
          node.status === "active" ||
          (activeIndex < 0 && i === 0 && node.status !== "locked");
        // Passado = antes do activo (ou completed). Futuro = depois do activo.
        const isPast =
          node.status === "completed" ||
          (activeIndex >= 0 && i < activeIndex);
        const isFuture =
          !isActive &&
          !isPast &&
          (activeIndex < 0 ? node.status === "locked" : i > activeIndex);
        const openable = isActive || isPast;
        const unviewedCount = unviewedByNodeId.get(node.id) ?? 0;
        const isLast = i === nodes.length - 1;
        const Icon = kindIcon(node.kind);
        const accent = kindAccent(node.kind);
        const levelNum = i + 1;
        const key = keys[i];
        const isPhaseStart = Boolean(key) && (i === 0 || keys[i - 1] !== key);
        const isPhaseCheckpoint = checkpointIds.has(node.id);
        const inGatedPhase = Boolean(key && gatedKeys.has(key));
        // Destaque só dentro da fase, até ao check-point — não por baixo dele.
        const railInPhase = inGatedPhase && !isPhaseCheckpoint;
        const needsReview = pendingReview.has(node.id);
        const reviewOnThis = review?.checkpointId === node.id ? review : null;
        const progress = key ? phaseProgress.get(key) : undefined;

        const markerSize = isActive ? "size-14" : isPast ? "size-11" : "size-10";
        const marker = (
          <span
            className={cn(
              "relative z-10 inline-grid shrink-0 place-items-center rounded-full",
              markerSize,
            )}
          >
            {/* Disco opaco: esconde a linha por trás do círculo */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-[var(--neuma-ink)]"
            />
            <span
              className={cn(
                "student-path-marker relative grid size-full place-items-center rounded-full transition-transform",
                isActive &&
                  "neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]",
                isPast &&
                  !isActive &&
                  "neuma-gradient text-white/90 opacity-45",
                isFuture &&
                  "border-2 border-white/10 bg-white/[0.03] text-muted-foreground/50",
              )}
            >
              {isFuture ? (
                <Lock className="size-3.5 opacity-70" />
              ) : (
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    isActive ? "text-base" : "text-sm",
                  )}
                >
                  {levelNum}
                </span>
              )}
            </span>
          </span>
        );

        const body = (
          <div
            className={cn(
              "student-path-step relative min-w-0 flex-1",
              isActive && "student-path-step--active",
              isPast && !isActive && "student-path-step--done",
              isFuture && "student-path-step--locked",
            )}
          >
            {!isFuture &&
            (accent === "practice" || accent === "milestone") ? (
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 w-[3px]",
                  accent === "practice"
                    ? "bg-[color-mix(in_srgb,var(--neuma-lime)_42%,var(--neuma-cream))]"
                    : "bg-[color-mix(in_srgb,var(--neuma-coral)_40%,var(--neuma-cream))]",
                )}
              />
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em]",
                      isFuture || !accent
                        ? isActive
                          ? "text-[#ffffe9]"
                          : "text-muted-foreground"
                        : accent === "practice"
                          ? "text-[color-mix(in_srgb,var(--neuma-lime)_38%,var(--neuma-cream))]"
                          : "text-[color-mix(in_srgb,var(--neuma-coral)_36%,var(--neuma-cream))]",
                    )}
                  >
                    <Icon className="size-3" />
                    {isPhaseCheckpoint
                      ? `Check-point · Fecha a ${phaseKeyLabel(key)}`
                      : nodeKindLabel[node.kind]}
                    {node.week_number ? ` · Sem. ${node.week_number}` : null}
                  </span>
                  {needsReview ? (
                    <span className="rounded-full bg-[var(--neuma-orange)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--neuma-orange)]">
                      Rever
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "leading-snug",
                    isActive
                      ? "font-heading text-lg font-bold tracking-tight sm:text-xl"
                      : "font-heading font-medium",
                    isFuture && "text-muted-foreground",
                  )}
                >
                  {node.title}
                </p>
                {node.due_date && !isFuture ? (
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3" />
                    Até {formatDate(node.due_date)}
                  </p>
                ) : null}
                {isActive && node.description ? (
                  <p className="line-clamp-2 pt-0.5 text-sm text-muted-foreground">
                    {node.description}
                  </p>
                ) : null}
              </div>
              {isActive ? (
                <ActiveLevelFeedbackCta
                  hasUnviewedFeedback={unviewedCount > 0}
                  unviewedCount={unviewedCount}
                />
              ) : null}
            </div>
            {reviewOnThis ? (
              <p className="mt-2 text-xs text-[var(--neuma-orange)]">
                {reviewOnThis.done < reviewOnThis.total
                  ? `Revê os níveis da fase para repetir o quiz · ${reviewOnThis.done} de ${reviewOnThis.total}`
                  : "Revisão feita — já podes repetir o quiz"}
              </p>
            ) : null}
            {isActive ? (
              <ActiveLevelFeedbackHint hasUnviewedFeedback={unviewedCount > 0} />
            ) : null}
            {isPast && !isActive ? (
              <p className="mt-2 text-xs text-muted-foreground/80">
                {node.status === "completed" ? "Concluído" : "Já disponível"}
              </p>
            ) : null}
            {isFuture ? (
              <p className="mt-2 text-xs text-muted-foreground">Bloqueado</p>
            ) : null}
          </div>
        );

        return (
          <Fragment key={node.id}>
            {isPhaseStart ? (
              <li className="relative list-none pb-3 pt-1 first:pt-0">
                {/* Sem linha acima do nível 1; só continua entre fases a meio do percurso */}
                {i > 0 ? (
                  <span
                    aria-hidden
                    className="student-path-rail absolute inset-y-0 left-[2rem] w-px -translate-x-1/2 bg-white/20"
                  />
                ) : null}
                <div className="flex items-baseline justify-between gap-3 pl-[4.75rem] sm:pl-[5.25rem]">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {phaseKeyLabel(key)}
                  </p>
                  {progress ? (
                    <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                      {progress.done}/{progress.total}
                    </p>
                  ) : null}
                </div>
              </li>
            ) : null}
            <li
              ref={isActive ? activeRef : undefined}
              data-student-path-active={isActive ? "" : undefined}
              className={cn(
                "relative flex gap-4 sm:gap-5",
                isActive ? "pb-10" : "pb-8",
                isLast && "pb-2",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  // Continua entre níveis, mas pára no círculo (não atravessa o marcador)
                  "student-path-rail absolute bottom-0 left-[2rem] w-px -translate-x-1/2",
                  isLast && "hidden",
                  railInPhase
                    ? "bg-[color-mix(in_oklch,color-mix(in_oklch,var(--neuma-blue)_25%,white)_55%,transparent)]"
                    : "bg-white/20",
                )}
                style={{
                  // pt-0.5 + altura do marcador (+ anel do check-point)
                  top: `calc(0.125rem + ${
                    isActive ? "3.5rem" : isPast ? "2.75rem" : "2.5rem"
                  }${isPhaseCheckpoint ? " + 0.25rem" : ""})`,
                }}
              />

              <div className="ml-1 flex w-14 shrink-0 flex-col items-center pt-0.5">
                {isPhaseCheckpoint ? (
                  <span className="relative inline-flex rounded-full">
                    {marker}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-1 rounded-full border-2 border-[color-mix(in_oklch,color-mix(in_oklch,var(--neuma-blue)_30%,white)_70%,transparent)]"
                    />
                  </span>
                ) : (
                  marker
                )}
              </div>

              {openable ? (
                <Link
                  href={`/path/${node.id}`}
                  prefetch={true}
                  className="min-w-0 flex-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50"
                >
                  {body}
                </Link>
              ) : (
                <div className="min-w-0 flex-1 cursor-not-allowed opacity-90">
                  {body}
                </div>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
