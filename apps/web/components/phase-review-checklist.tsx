import Link from "next/link";
import { Check, ChevronRight, RotateCcw } from "lucide-react";

import type { PhaseReview } from "@/lib/nodes/phase-review";
import { cn } from "@/lib/utils";

/** Checkpoint page after a failed attempt: levels of the phase to revisit. */
export function PhaseReviewChecklist({ review }: { review: PhaseReview }) {
  const done = review.items.length - review.pendingCount;
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--neuma-orange)]/25 bg-[color-mix(in_oklch,var(--neuma-orange)_7%,transparent)] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--neuma-orange)]/15 text-[var(--neuma-orange)]">
          <RotateCcw className="size-4" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold">Rever a {review.phaseLabel}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {review.pendingCount > 0
              ? `Abre os níveis da fase para desbloquear o quiz de novo · ${done} de ${review.items.length}`
              : "Revisão feita — já podes repetir o quiz."}
          </p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {review.items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/path/${item.id}`}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                item.visited
                  ? "border-white/8 bg-white/[0.03] text-muted-foreground"
                  : "border-white/12 bg-white/[0.06] hover:bg-white/[0.09]",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums",
                  item.visited
                    ? "bg-[var(--neuma-lime)]/15 text-[var(--neuma-lime)]"
                    : "bg-white/10 text-foreground/80",
                )}
              >
                {item.visited ? <Check className="size-3.5" /> : item.levelNumber}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Phase level opened during a review: shows progress and the way back. */
export function PhaseReviewBanner({
  review,
  currentNodeId,
}: {
  review: PhaseReview;
  currentNodeId: string;
}) {
  const visited = review.items.filter(
    (i) => i.visited || i.id === currentNodeId,
  ).length;
  const remaining = review.items.length - visited;
  const nextPending = review.items.find(
    (i) => !i.visited && i.id !== currentNodeId,
  );
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--neuma-orange)]/25 bg-[color-mix(in_oklch,var(--neuma-orange)_7%,transparent)] px-4 py-3">
      <RotateCcw className="size-4 shrink-0 text-[var(--neuma-orange)]" />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          A rever a {review.phaseLabel}
        </span>{" "}
        · {visited} de {review.items.length}
        {remaining > 0 ? "" : " — pronto para o quiz"}
      </p>
      <Link
        href={`/path/${remaining > 0 && nextPending ? nextPending.id : review.checkpointId}`}
        className="shrink-0 text-xs font-medium text-[var(--neuma-orange)] hover:underline"
      >
        {remaining > 0 ? "Seguinte" : "Voltar ao check-point"}
      </Link>
    </div>
  );
}
