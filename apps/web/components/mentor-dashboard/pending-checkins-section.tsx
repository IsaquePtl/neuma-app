import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  mentorCheckInHref,
  mentorCheckInLevelMeta,
  mentorCheckInLevelNumber,
  mentorCheckInLevelTitle,
  type MentorPendingCheckIn,
} from "@/lib/mentor/checkins";
import { formatWaiting, ORPHAN_CHECKIN_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

type PendingCheckinsSectionProps = {
  checkIns: MentorPendingCheckIn[];
  limit?: number;
  viewAllHref?: string;
};

export function PendingCheckinsSection({
  checkIns,
  limit,
  viewAllHref = "/studio/journeys/checkins",
}: PendingCheckinsSectionProps) {
  const visible = limit ? checkIns.slice(0, limit) : checkIns;
  const hiddenCount = limit ? Math.max(0, checkIns.length - limit) : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Por rever{" "}
          <span className="text-muted-foreground">({checkIns.length})</span>
        </h2>
        {viewAllHref && checkIns.length > 0 ? (
          <Link
            href={viewAllHref}
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            Ver todos
          </Link>
        ) : null}
      </div>
      {visible.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Tudo em dia. Sem check-ins por rever.
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((checkIn) => {
            const student = checkIn.student;
            const node = checkIn.node;
            const number = mentorCheckInLevelNumber(node);
            const title = mentorCheckInLevelTitle(node);
            const isOrphan = title === ORPHAN_CHECKIN_LABEL;

            return (
              <Link
                key={checkIn.id}
                href={mentorCheckInHref(checkIn)}
                aria-label={`Rever check-in de ${student?.full_name ?? student?.email ?? "aluno"} — ${title}`}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 transition-colors",
                  "hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {number != null && !isOrphan ? (
                  <span
                    className={cn(
                      "student-path-marker relative grid size-11 shrink-0 place-items-center rounded-full",
                      "neuma-gradient text-sm font-semibold tabular-nums text-white",
                      "shadow-[0_0_20px_-4px_color-mix(in_oklch,var(--neuma-coral)_50%,transparent)]",
                    )}
                    aria-hidden
                  >
                    {number}
                  </span>
                ) : (
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-full border border-dashed border-[var(--neuma-coral)]/40 bg-[var(--neuma-coral)]/10 text-xs font-semibold text-[var(--neuma-coral)]"
                    aria-hidden
                  >
                    ?
                  </span>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate font-semibold">
                      {student?.full_name ?? student?.email ?? "Aluno"}
                    </p>
                    <span className="hidden shrink-0 rounded-full border border-[var(--neuma-coral)]/25 bg-[var(--neuma-coral)]/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-[var(--neuma-coral)] desktop:inline-flex">
                      há {formatWaiting(checkIn.created_at)}
                    </span>
                  </div>
                  <p className="truncate font-heading text-sm font-medium leading-snug">
                    {title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {mentorCheckInLevelMeta(node, checkIn.kind)}
                  </p>
                  <p className="text-xs tabular-nums text-[var(--neuma-coral)]/90 desktop:hidden">
                    há {formatWaiting(checkIn.created_at)}
                  </p>
                </div>

                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </Link>
            );
          })}
          {hiddenCount > 0 ? (
            <p className="pt-1 text-center text-xs text-muted-foreground">
              +{hiddenCount} mais em{" "}
              <Link
                href={viewAllHref}
                className="font-medium text-foreground/80 hover:text-foreground"
              >
                check-ins
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
