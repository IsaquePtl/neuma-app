import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { IntentLink } from "@/components/intent-link";
import { Card } from "@/components/ui/card";
import {
  onboardingDisplayName,
  onboardingStatusHint,
  type MentorOnboardingInboxItem,
} from "@/lib/mentor/onboardings";
import { formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

const intakeRowTitleClass = "font-medium break-words sm:truncate";
const intakeRowSubtitleClass =
  "text-sm text-muted-foreground break-words leading-snug line-clamp-3 sm:line-clamp-none sm:truncate";

type OnboardingInboxSectionProps = {
  inbox: MentorOnboardingInboxItem[];
  limit?: number;
  viewAllHref?: string;
};

export function OnboardingInboxSection({
  inbox,
  limit,
  viewAllHref = "/studio/journeys/onboardings",
}: OnboardingInboxSectionProps) {
  const visible = limit ? inbox.slice(0, limit) : inbox;
  const hiddenCount = limit ? Math.max(0, inbox.length - limit) : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Por tratar{" "}
          <span className="text-muted-foreground">({inbox.length})</span>
        </h2>
        {viewAllHref && inbox.length > 0 ? (
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
          Sem novos onboardings por tratar.
        </Card>
      ) : (
        <div className="grid gap-3">
          {visible.map((submission) => {
            const hint = onboardingStatusHint(submission);
            const unlinkedItem = !submission.student_id;

            return (
              <Card
                key={submission.id}
                className={cn(
                  "!gap-0 !p-0",
                  unlinkedItem && "border-amber-400/20 bg-amber-400/[0.03]",
                )}
              >
                <IntentLink
                  href={`/studio/intake/${submission.id}`}
                  className="relative block min-w-0 rounded-2xl p-5 pr-10 pb-8 outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--neuma-coral)]/40"
                >
                  <div className="space-y-1">
                    <p className={intakeRowTitleClass}>
                      {onboardingDisplayName(submission)}
                    </p>
                    <p className={intakeRowSubtitleClass}>
                      {submission.respondent_email ?? "Sem email"} ·{" "}
                      {submission.source_form_name ?? "Onboarding"} ·{" "}
                      {formatDateTime(submission.created_at)}
                    </p>
                    {hint ? (
                      <p className={cn("text-xs", hint.className)}>
                        {hint.label}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight
                    aria-hidden
                    className="absolute right-5 bottom-5 size-4 text-muted-foreground"
                  />
                </IntentLink>
              </Card>
            );
          })}
          {hiddenCount > 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              +{hiddenCount} mais em{" "}
              <Link
                href={viewAllHref}
                className="font-medium text-foreground/80 hover:text-foreground"
              >
                onboardings
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
