import { MessageSquareText, Play } from "lucide-react";

import { cn } from "@/lib/utils";

export function ActiveLevelFeedbackCta({
  hasUnviewedFeedback,
  unviewedCount = 0,
}: {
  hasUnviewedFeedback: boolean;
  unviewedCount?: number;
}) {
  if (!hasUnviewedFeedback) {
    return (
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/10 text-xs font-medium text-white sm:size-auto sm:px-3 sm:py-1.5">
        <Play className="size-3.5 fill-current" />
        <span className="hidden sm:inline">Entrar</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "mt-0.5 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        "bg-gradient-to-br from-[var(--neuma-coral)]/35 via-[var(--neuma-lavender)]/20 to-[var(--neuma-blue)]/30 text-white",
        "ring-1 ring-[var(--neuma-coral)]/40",
      )}
    >
      <MessageSquareText className="size-3.5" />
      <span>
        {unviewedCount > 1
          ? `${unviewedCount} feedbacks`
          : "Ver feedback"}
      </span>
    </span>
  );
}

export function ActiveLevelFeedbackHint({
  hasUnviewedFeedback,
}: {
  hasUnviewedFeedback: boolean;
}) {
  if (!hasUnviewedFeedback) {
    return (
      <p className="mt-3 text-xs font-medium tracking-wide text-[#ffffe9]/80">
        Nível actual — toca para abrir
      </p>
    );
  }

  return (
    <p className="mt-3 text-xs font-medium tracking-wide text-[var(--neuma-coral)]">
      Tens feedback novo do mentor
    </p>
  );
}
