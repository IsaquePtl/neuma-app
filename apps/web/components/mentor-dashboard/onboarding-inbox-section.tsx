import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { TallySubmissionRowActions } from "@/components/tally-submission-row-actions";
import { Card } from "@/components/ui/card";
import {
  onboardingDisplayName,
  onboardingStatusHint,
  type MentorOnboardingInboxItem,
  type MentorStudentOption,
} from "@/lib/mentor/onboardings";
import { formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

const intakeRowCardClass =
  "flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3";
const intakeRowTitleClass = "font-medium break-words sm:truncate";
const intakeRowSubtitleClass =
  "text-sm text-muted-foreground break-words leading-snug line-clamp-3 sm:line-clamp-none sm:truncate";
const intakeRowActionsClass =
  "flex shrink-0 items-center justify-end gap-1 sm:justify-start";

type OnboardingInboxSectionProps = {
  inbox: MentorOnboardingInboxItem[];
  students: MentorStudentOption[];
  limit?: number;
  viewAllHref?: string;
};

export function OnboardingInboxSection({
  inbox,
  students,
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
                  intakeRowCardClass,
                  "p-5",
                  unlinkedItem && "border-amber-400/20 bg-amber-400/[0.03]",
                )}
              >
                <Link
                  href={`/studio/intake/${submission.id}`}
                  className="min-w-0 flex-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40"
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
                </Link>
                <div className={intakeRowActionsClass}>
                  {unlinkedItem ? (
                    <TallySubmissionRowActions
                      submissionId={submission.id}
                      students={students}
                      linkedStudentId={submission.student_id}
                      submissionKind="onboarding"
                      emphasizeLink
                      showView={false}
                    />
                  ) : (
                    <ChevronRight className="hidden size-5 text-muted-foreground sm:block" />
                  )}
                </div>
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
