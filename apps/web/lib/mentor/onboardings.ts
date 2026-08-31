import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getTallyConfig, isOnboardingTallySubmission } from "@/lib/tally";
import { resolveRelation } from "@/lib/mentor/checkins";

export type MentorOnboardingInboxItem = {
  id: string;
  submission_kind: string;
  status: string;
  respondent_name: string | null;
  respondent_email: string | null;
  source_form_name: string | null;
  source_form_id: string;
  created_at: string;
  student_id: string | null;
  check_in_id: string | null;
  student: { full_name: string | null; email: string | null } | null;
};

export type MentorStudentOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export function needsOnboardingAction(
  submission: Pick<MentorOnboardingInboxItem, "student_id" | "status">,
) {
  if (!submission.student_id) return true;
  return submission.status === "pending" || submission.status === "linked";
}

export function onboardingDisplayName(submission: {
  respondent_name: string | null;
  respondent_email: string | null;
}) {
  return (
    submission.respondent_name?.trim() ||
    submission.respondent_email?.trim() ||
    "Sem nome"
  );
}

export function onboardingStatusHint(submission: MentorOnboardingInboxItem) {
  if (!submission.student_id) {
    return {
      label: "Sem aluno vinculado",
      className: "text-amber-200/90",
    };
  }
  if (submission.status === "linked" || submission.status === "pending") {
    return {
      label: "Já vinculado — falta confirmar",
      className: "text-emerald-200/80",
    };
  }
  const student = submission.student;
  if (student?.full_name || student?.email) {
    return {
      label: `Vinculado a ${student.full_name ?? student.email}`,
      className: "text-muted-foreground",
    };
  }
  return null;
}

export async function loadOnboardingInbox(): Promise<{
  inbox: MentorOnboardingInboxItem[];
  students: MentorStudentOption[];
}> {
  const supabase = await createClient();
  const { onboardingFormId } = getTallyConfig();

  const [{ data: intakeRows }, { data: students }] = await Promise.all([
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
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student")
      .order("full_name", { ascending: true }),
  ]);

  const onboardings =
    intakeRows
      ?.filter((row) =>
        isOnboardingTallySubmission(
          row as Pick<
            MentorOnboardingInboxItem,
            "submission_kind" | "source_form_id" | "source_form_name"
          >,
          onboardingFormId,
        ),
      )
      .map((row) => ({
        id: row.id,
        submission_kind: row.submission_kind,
        status: row.status,
        respondent_name: row.respondent_name,
        respondent_email: row.respondent_email,
        source_form_name: row.source_form_name,
        source_form_id: row.source_form_id,
        created_at: row.created_at,
        student_id: row.student_id,
        check_in_id: row.check_in_id,
        student: resolveRelation(
          row.student as
            | { full_name: string | null; email: string | null }
            | { full_name: string | null; email: string | null }[]
            | null
            | undefined,
        ),
      })) ?? [];

  return {
    inbox: onboardings.filter(needsOnboardingAction),
    students: students ?? [],
  };
}
