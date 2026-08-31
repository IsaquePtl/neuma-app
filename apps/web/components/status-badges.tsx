import { CheckCircle2, Clock, RotateCcw } from "lucide-react";

import { FeedbackContinueAction } from "@/components/feedback-continue-action";
import { FeedbackNextLevelPreview } from "@/components/feedback-next-level-preview";
import type {
  NextLevelPreview,
  StudentFeedbackViewRef,
} from "@/lib/feedbacks/student-shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  checkInStatusLabel,
  nodeKindLabel,
  nodeStatusLabel,
  pathStatusLabel,
} from "@/lib/labels";
import type {
  CheckInStatus,
  NodeKind,
  NodeStatus,
  PathStatus,
} from "@/lib/types/database.types";

export function NodeStatusBadge({ status }: { status: NodeStatus }) {
  const styles: Record<NodeStatus, string> = {
    locked: "border-border text-muted-foreground",
    active: "border-transparent bg-primary/15 text-primary",
    completed: "border-transparent bg-emerald-500/15 text-emerald-400",
  };
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      {nodeStatusLabel[status]}
    </Badge>
  );
}

export function NodeKindBadge({ kind }: { kind: NodeKind }) {
  return (
    <Badge variant="outline" className="border-border text-muted-foreground">
      {nodeKindLabel[kind]}
    </Badge>
  );
}

export function PathStatusBadge({ status }: { status: PathStatus }) {
  const styles: Record<PathStatus, string> = {
    draft: "border-border text-muted-foreground",
    active: "border-transparent bg-emerald-500/15 text-emerald-400",
    completed: "border-transparent bg-emerald-500/15 text-emerald-400",
    paused: "border-transparent bg-amber-500/15 text-amber-400",
  };
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      {pathStatusLabel[status]}
    </Badge>
  );
}

const checkInStatusStyles: Record<CheckInStatus, string> = {
  pending: "border-transparent bg-[var(--neuma-orange)] text-white",
  approved: "border-transparent bg-emerald-500/15 text-emerald-400",
  needs_revision: "border-transparent bg-primary/15 text-primary",
};

export function CheckInStatusBadge({ status }: { status: CheckInStatus }) {
  if (status === "approved") return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        checkInStatusStyles[status],
        status === "pending" &&
          "h-7 px-3.5 py-1 text-sm font-semibold tracking-wide",
      )}
    >
      {checkInStatusLabel[status]}
    </Badge>
  );
}

const feedbackDecisionConfig: Record<
  CheckInStatus,
  {
    icon: typeof CheckCircle2;
    iconSurface: string;
    iconColor: string;
    strip: string;
    detail: string;
  }
> = {
  approved: {
    icon: CheckCircle2,
    iconSurface: "bg-[#cece13]/20",
    iconColor: "text-[#cece13]",
    strip: "border-l-[#cece13] bg-[#cece13]/12",
    detail: "O teu check-in foi validado.",
  },
  needs_revision: {
    icon: RotateCcw,
    iconSurface: "bg-[#f27c25]/20",
    iconColor: "text-[#f27c25]",
    strip: "border-l-[#f27c25] bg-[#f27c25]/12",
    detail: "Revê o feedback e envia novamente quando estiveres pronto.",
  },
  pending: {
    icon: Clock,
    iconSurface: "bg-white/[0.08]",
    iconColor: "text-muted-foreground",
    strip: "border-l-white/25 bg-white/[0.05]",
    detail: "O mentor ainda está a rever a tua submissão.",
  },
};

/** Richer decision block for student feedback cards (full width below video row). */
export function FeedbackDecisionBlock({
  status,
  nextLevel,
  nodeId,
  feedbackRefs,
}: {
  status: CheckInStatus;
  nextLevel?: NextLevelPreview | null;
  nodeId?: string;
  feedbackRefs?: StudentFeedbackViewRef[];
}) {
  const { icon: Icon, iconSurface, iconColor, strip } =
    feedbackDecisionConfig[status];
  const showNextLevel = status === "approved" && Boolean(nextLevel);
  const continueHref = nodeId ? `/path/${nodeId}` : "/path";
  const showContinue =
    !showNextLevel && Boolean(nodeId || feedbackRefs?.length);
  const detail =
    status === "pending" && showContinue
      ? "O mentor prolongou o prazo deste nível."
      : feedbackDecisionConfig[status].detail;

  return (
    <div className="min-w-0 rounded-xl bg-white/[0.04] p-3 backdrop-blur-sm sm:p-4">
      <div
        className={cn(
          "rounded-lg border-l-[3px] px-3 py-3 sm:px-5 sm:py-5",
          strip,
        )}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Decisão
        </p>
        <div className="mt-2.5 flex items-start gap-3 sm:items-center sm:gap-3.5">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl sm:size-12",
              iconSurface,
            )}
          >
            <Icon className={cn("size-5 sm:size-6", iconColor)} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p
              className={cn(
                "break-words font-heading text-xl font-bold leading-tight tracking-tight sm:text-2xl sm:leading-none sm:text-[1.75rem]",
                iconColor,
              )}
            >
              {checkInStatusLabel[status]}
            </p>
            <p className="break-words text-sm leading-snug text-muted-foreground">
              {detail}
            </p>
          </div>
        </div>
      </div>
      {showNextLevel ? (
        <div className="mt-4 min-w-0 border-t border-white/10 pt-4 sm:mt-5 sm:pt-5">
          <FeedbackNextLevelPreview
            nextLevel={nextLevel!}
            nodeId={nodeId}
            feedbackRefs={feedbackRefs}
          />
        </div>
      ) : showContinue ? (
        <div className="mt-4 min-w-0 border-t border-white/10 pt-4 sm:mt-5 sm:pt-5">
          <FeedbackContinueAction
            href={continueHref}
            nodeId={nodeId}
            feedbackRefs={feedbackRefs}
          />
        </div>
      ) : null}
    </div>
  );
}
