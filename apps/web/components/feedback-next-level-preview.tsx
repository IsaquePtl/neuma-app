"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dumbbell,
  Flag,
  Phone,
  Play,
  Video,
} from "lucide-react";

import {
  markNodeFeedbackViewedAction,
  markStudentFeedbackViewedAction,
} from "@/lib/actions/student-feedback-views";
import type {
  NextLevelPreview,
  StudentFeedbackViewRef,
} from "@/lib/feedbacks/student-shared";
import { nodeKindLabel } from "@/lib/labels";
import { levelAvailableLabel } from "@/lib/nodes/level-open";
import { requestStudentBadgesRefresh } from "@/lib/student-badges-client";
import type { NodeKind } from "@/lib/types/database.types";

function nextLevelKindIcon(kind: NodeKind) {
  switch (kind) {
    case "call":
      return <Phone className="size-3" aria-hidden />;
    case "lesson":
    case "resource":
      return <Video className="size-3" aria-hidden />;
    case "milestone":
      return <Flag className="size-3" aria-hidden />;
    default:
      return <Dumbbell className="size-3" aria-hidden />;
  }
}

function markFeedbackViewedInBackground(
  nodeId: string | undefined,
  feedbackRefs: StudentFeedbackViewRef[],
) {
  const task =
    feedbackRefs.length > 0
      ? markStudentFeedbackViewedAction(feedbackRefs)
      : nodeId
        ? markNodeFeedbackViewedAction(nodeId)
        : Promise.resolve();

  void task
    .then(() => {
      requestStudentBadgesRefresh();
    })
    .catch(() => {
      // Navigation should not wait on badge bookkeeping.
    });
}

export function FeedbackNextLevelPreview({
  nextLevel,
  nodeId,
  feedbackRefs = [],
}: {
  nextLevel: NextLevelPreview;
  nodeId?: string;
  feedbackRefs?: StudentFeedbackViewRef[];
}) {
  const [isPending, setIsPending] = useState(false);
  const waiting = Boolean(nextLevel.opensOn);

  const handleNavigate = () => {
    if (isPending) return;
    setIsPending(true);
    markFeedbackViewedInBackground(nodeId, feedbackRefs);
  };

  const marker = (
    <span
      className="student-path-marker relative z-10 grid size-11 shrink-0 place-items-center rounded-full border-2 border-[color-mix(in_oklch,var(--neuma-coral)_55%,white)] bg-white/[0.06] text-[#ffffe9] shadow-[0_0_24px_-8px_color-mix(in_oklch,var(--neuma-coral)_45%,transparent)] sm:size-12"
      aria-hidden
    >
      <span className="text-sm font-semibold tabular-nums sm:text-base">
        {nextLevel.levelNumber}
      </span>
    </span>
  );

  const heading = (
    <div className="min-w-0 flex-1 space-y-1">
      <span className="inline-flex max-w-full flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#ffffe9]">
        {nextLevelKindIcon(nextLevel.kind)}
        {nodeKindLabel[nextLevel.kind]}
        {nextLevel.week_number ? ` · Sem. ${nextLevel.week_number}` : null}
      </span>
      <p className="break-words font-heading text-lg font-bold leading-snug tracking-tight">
        {nextLevel.title}
      </p>
      {nextLevel.description && !waiting ? (
        <p className="line-clamp-2 pt-0.5 text-sm text-muted-foreground">
          {nextLevel.description}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Próximo nível
      </p>
      {waiting ? (
        <Link
          href="/path"
          prefetch
          onClick={handleNavigate}
          className="block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50"
        >
          <div className="student-path-step student-path-step--upcoming relative flex min-w-0 w-full items-start gap-3 overflow-hidden rounded-2xl !p-4 sm:gap-4 sm:!p-5">
            {marker}
            <div className="min-w-0 flex-1 space-y-3">
              {heading}
              <p className="text-xs font-medium tracking-wide text-[var(--neuma-coral)]">
                {levelAvailableLabel(nextLevel.opensOn!)}
              </p>
            </div>
          </div>
        </Link>
      ) : (
      <Link
        href={nextLevel.href}
        prefetch={true}
        onClick={handleNavigate}
        aria-busy={isPending}
        className="student-path-step student-path-step--active relative flex min-w-0 w-full items-start gap-3 overflow-hidden rounded-2xl !p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50 aria-busy:opacity-70 sm:gap-4 sm:!p-5"
      >
        <span
          className="student-path-marker relative z-10 grid size-11 shrink-0 place-items-center rounded-full neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)] sm:size-12"
          aria-hidden
        >
          <span className="text-sm font-semibold tabular-nums sm:text-base">
            {nextLevel.levelNumber}
          </span>
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <span className="inline-flex max-w-full flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#ffffe9]">
                {nextLevelKindIcon(nextLevel.kind)}
                {nodeKindLabel[nextLevel.kind]}
                {nextLevel.week_number
                  ? ` · Sem. ${nextLevel.week_number}`
                  : null}
              </span>
              <p className="break-words font-heading text-lg font-bold leading-snug tracking-tight">
                {nextLevel.title}
              </p>
              {nextLevel.description ? (
                <p className="line-clamp-2 pt-0.5 text-sm text-muted-foreground">
                  {nextLevel.description}
                </p>
              ) : null}
            </div>
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/10 text-xs font-medium text-white sm:size-auto sm:px-3 sm:py-1.5">
              <Play className="size-3.5 fill-current" aria-hidden />
              <span className="hidden sm:inline">Entrar</span>
            </span>
          </div>
          <p className="text-xs font-medium tracking-wide text-[#ffffe9]/80">
            Próximo nível — toca para abrir
          </p>
        </div>
      </Link>
      )}
    </div>
  );
}
