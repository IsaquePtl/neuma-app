"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function FeedbackNextLevelPreview({
  nextLevel,
  nodeId,
  feedbackRefs = [],
}: {
  nextLevel: NextLevelPreview;
  nodeId?: string;
  feedbackRefs?: StudentFeedbackViewRef[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    try {
      if (feedbackRefs.length > 0) {
        await markStudentFeedbackViewedAction(feedbackRefs);
      } else if (nodeId) {
        await markNodeFeedbackViewedAction(nodeId);
      }
    } catch {
      setIsPending(false);
      return;
    }

    router.push(nextLevel.href);
    router.refresh();
    setIsPending(false);
  };

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Próximo nível
      </p>
      <Link
        href={nextLevel.href}
        onClick={handleClick}
        aria-busy={isPending}
        className="student-path-step student-path-step--active relative block min-w-0 overflow-hidden rounded-2xl !p-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50 sm:!p-5"
      >
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
        <p className="mt-3 text-xs font-medium tracking-wide text-[#ffffe9]/80">
          Próximo nível — toca para abrir
        </p>
      </Link>
    </div>
  );
}
