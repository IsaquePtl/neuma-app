import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export { FeedbackNextLevelPreview } from "@/components/feedback-next-level-preview";
export { FeedbackContinueAction } from "@/components/feedback-continue-action";

type FeedbackSubCardProps = {
  label: string;
  children: ReactNode;
  fillHeight?: boolean;
};

function FeedbackSubCard({
  label,
  children,
  fillHeight = false,
}: FeedbackSubCardProps) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl bg-white/[0.04] p-4 backdrop-blur-sm sm:p-5",
        fillHeight &&
          "flex min-h-[120px] flex-col desktop:h-full desktop:min-h-0 desktop:flex-1",
      )}
    >
      <p className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div
        className={cn(
          "mt-3 min-w-0 break-words text-sm leading-relaxed text-foreground/95",
          fillHeight && "min-h-0 flex-1 overflow-y-auto",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function MentorFeedbackCardHeader({ subtitle }: { subtitle: string }) {
  return (
    <p className="text-xs text-muted-foreground">{subtitle}</p>
  );
}

export function FeedbackNotesCard({ notes }: { notes: string }) {
  return (
    <FeedbackSubCard label="Feedback" fillHeight>
      <p className="whitespace-pre-wrap">{notes}</p>
    </FeedbackSubCard>
  );
}

export function FeedbackContentCard({
  label,
  children,
  fillHeight = true,
}: {
  label: string;
  children: ReactNode;
  fillHeight?: boolean;
}) {
  return (
    <FeedbackSubCard label={label} fillHeight={fillHeight}>
      {children}
    </FeedbackSubCard>
  );
}

export function FeedbackNextStepsCard({ nextSteps }: { nextSteps: string }) {
  return (
    <FeedbackSubCard label="Próximos passos" fillHeight>
      <p className="whitespace-pre-wrap">{nextSteps}</p>
    </FeedbackSubCard>
  );
}

