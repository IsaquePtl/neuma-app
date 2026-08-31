import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";

import { OnboardingInboxSection } from "@/components/mentor-dashboard/onboarding-inbox-section";
import { TallySubmissionRowActions } from "@/components/tally-submission-row-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getTallyConfig, isOnboardingTallySubmission } from "@/lib/tally";
import {
  loadOnboardingInbox,
  needsOnboardingAction,
  onboardingDisplayName,
  type MentorOnboardingInboxItem,
} from "@/lib/mentor/onboardings";
import { resolveRelation } from "@/lib/mentor/checkins";
import { formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

const intakeRowCardClass =
  "flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3";
const intakeRowTitleClass = "font-medium break-words sm:truncate";
const intakeRowSubtitleClass =
  "text-sm text-muted-foreground break-words leading-snug line-clamp-3 sm:line-clamp-none sm:truncate";
const intakeRowActionsClass =
  "flex shrink-0 items-center justify-end gap-1 sm:justify-start";

export default async function JourneysOnboardingsPage() {
  const supabase = await createClient();
  const { onboardingFormId } = getTallyConfig();

  const [
    { inbox, students },
    { data: intakeRows },
    { data: checkinUnresolved },
  ] = await Promise.all([
    loadOnboardingInbox(),
    supabase
      .from("tally_submissions")
      .select(
        "id, submission_kind, status, respondent_name, respondent_email, source_form_name, source_form_id, created_at, student_id, check_in_id, student:profiles!tally_submissions_student_id_fkey(full_name, email)",
      )
      .neq("status", "archived")
      .or(
        `submission_kind.in.(onboarding,unknown,checkin),source_form_id.eq.${onboardingFormId}`,
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("tally_submissions")
      .select(
        "id, submission_kind, status, respondent_name, respondent_email, created_at, student_id, check_in_id, source_form_id, source_form_name",
      )
      .eq("submission_kind", "checkin")
      .is("check_in_id", null)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const onboardings =
    intakeRows?.filter((row) =>
      isOnboardingTallySubmission(
        row as Pick<
          MentorOnboardingInboxItem,
          "submission_kind" | "source_form_id" | "source_form_name"
        >,
        onboardingFormId,
      ),
    ) ?? [];

  const linkedHistory = onboardings.filter(
    (s) => s.student_id && !needsOnboardingAction(s),
  );
  const orphanCheckins =
    checkinUnresolved?.filter(
      (row) =>
        !isOnboardingTallySubmission(
          row as Pick<
            MentorOnboardingInboxItem,
            "submission_kind" | "source_form_id" | "source_form_name"
          >,
          onboardingFormId,
        ),
    ) ?? [];

  return (
    <div className="space-y-8">
      <OnboardingInboxSection inbox={inbox} students={students} />

      {orphanCheckins.length > 0 ? (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-amber-200/90">
            <TriangleAlert className="size-4 text-amber-400" />
            Check-ins por ligar ({orphanCheckins.length})
          </h3>
          <div className="grid gap-3">
            {orphanCheckins.map((submission) => (
              <Card
                key={submission.id}
                className={cn(intakeRowCardClass, "p-5")}
              >
                <Link
                  href={`/studio/intake/${submission.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className={intakeRowTitleClass}>
                    {onboardingDisplayName(submission)}
                  </p>
                  <p className={intakeRowSubtitleClass}>
                    {submission.respondent_email ?? "Sem email"} ·{" "}
                    {formatDateTime(submission.created_at)}
                  </p>
                </Link>
                <div className={intakeRowActionsClass}>
                  <TallySubmissionRowActions
                    submissionId={submission.id}
                    students={students}
                    linkedStudentId={submission.student_id}
                    submissionKind={submission.submission_kind}
                    emphasizeLink
                    showView={false}
                  />
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {linkedHistory.length > 0 ? (
        <details className="group space-y-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Já confirmados ({linkedHistory.length})
          </summary>
          <div className="grid gap-2">
            {linkedHistory.map((submission) => {
              const student = resolveRelation(
                (submission as MentorOnboardingInboxItem).student,
              );
              return (
                <Card
                  key={submission.id}
                  className={cn(intakeRowCardClass, "px-4 py-3")}
                >
                  <Link
                    href={`/studio/intake/${submission.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className={intakeRowTitleClass}>
                      {onboardingDisplayName(submission)}
                    </p>
                    <p className={intakeRowSubtitleClass}>
                      {submission.respondent_email ?? "Sem email"}
                      {student?.full_name || student?.email
                        ? ` · ${student.full_name || student.email}`
                        : ""}
                      {" · "}
                      {formatDateTime(submission.created_at)}
                    </p>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden sm:inline-flex"
                    render={<Link href={`/studio/intake/${submission.id}`} />}
                    nativeButton={false}
                  >
                    Ver
                  </Button>
                </Card>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}
