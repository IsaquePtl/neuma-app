import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

import { markTallySubmissionProcessed } from "@/lib/actions/tally";
import { createClient } from "@/lib/supabase/server";
import {
  resolveTallyAnswers,
  TallyAnswerList,
} from "@/components/tally-answers";
import { TallySubmissionRowActions } from "@/components/tally-submission-row-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/labels";

export default async function JourneysOnboardingsPage() {
  const supabase = await createClient();

  const [{ data: submissions }, { data: students }] = await Promise.all([
    supabase
      .from("tally_submissions")
      .select(
        "id, submission_kind, status, respondent_name, respondent_email, notes, video_url, source_form_name, created_at, answers, payload, check_in_id, student_id, node_id, student:profiles!tally_submissions_student_id_fkey(full_name, email)",
      )
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student")
      .order("full_name", { ascending: true }),
  ]);

  const studentOptions = students ?? [];
  const onboardingPending =
    submissions?.filter(
      (s) => s.submission_kind === "onboarding" && s.status === "pending",
    ) ?? [];
  const onboardingDone =
    submissions?.filter(
      (s) =>
        s.submission_kind === "onboarding" &&
        (s.status === "processed" || s.status === "linked"),
    ) ?? [];
  const checkinUnresolved =
    submissions?.filter(
      (s) => s.submission_kind === "checkin" && s.check_in_id === null,
    ) ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Por tratar{" "}
          <span className="text-muted-foreground">
            ({onboardingPending.length})
          </span>
        </h2>
        {onboardingPending.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Sem novos onboardings por tratar.
          </Card>
        ) : (
          <div className="grid gap-3">
            {onboardingPending.map((submission) => {
              const answers = resolveTallyAnswers(
                submission.answers,
                submission.payload,
              );
              return (
                <Card key={submission.id} className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {submission.respondent_name ??
                          submission.respondent_email ??
                          "Nova resposta"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {submission.source_form_name ?? "Onboarding"} ·{" "}
                        {formatDateTime(submission.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <form action={markTallySubmissionProcessed}>
                        <input type="hidden" name="id" value={submission.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Tratado
                        </Button>
                      </form>
                      <TallySubmissionRowActions
                        submissionId={submission.id}
                        students={studentOptions}
                        linkedStudentId={submission.student_id}
                        submissionKind={submission.submission_kind}
                      />
                    </div>
                  </div>
                  <TallyAnswerList answers={answers.slice(0, 8)} />
                  {answers.length > 8 ? (
                    <Link
                      href={`/studio/intake/${submission.id}`}
                      className="inline-flex items-center gap-1 text-sm text-[var(--neuma-coral)] hover:underline"
                    >
                      Ver todas <ArrowRight className="size-4" />
                    </Link>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {checkinUnresolved.length > 0 ? (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-amber-200/90">
            <TriangleAlert className="size-4 text-amber-400" />
            Check-ins por ligar ({checkinUnresolved.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            Chegaram sem aluno/bloco. Associa a um aluno com bloco ativo.
          </p>
          <div className="grid gap-3">
            {checkinUnresolved.map((submission) => {
              const answers = resolveTallyAnswers(
                submission.answers,
                submission.payload,
              );
              return (
                <Card key={submission.id} className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {submission.respondent_name ??
                          submission.respondent_email ??
                          "Check-in externo"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(submission.created_at)}
                      </p>
                    </div>
                    <TallySubmissionRowActions
                      submissionId={submission.id}
                      students={studentOptions}
                      linkedStudentId={submission.student_id}
                      submissionKind={submission.submission_kind}
                    />
                  </div>
                  <TallyAnswerList answers={answers.slice(0, 6)} compact />
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {onboardingDone.length > 0 ? (
        <details className="group space-y-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Já tratados ({onboardingDone.length})
          </summary>
          <div className="grid gap-2">
            {onboardingDone.map((submission) => {
              const student = Array.isArray(submission.student)
                ? submission.student[0]
                : submission.student;
              return (
                <Card
                  key={submission.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {submission.respondent_name ??
                        submission.respondent_email ??
                        "Resposta"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatDateTime(submission.created_at)}
                      {student?.full_name || student?.email
                        ? ` · ${student.full_name || student.email}`
                        : ""}
                    </p>
                  </div>
                  <TallySubmissionRowActions
                    submissionId={submission.id}
                    students={studentOptions}
                    linkedStudentId={submission.student_id}
                    submissionKind={submission.submission_kind}
                  />
                </Card>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}
