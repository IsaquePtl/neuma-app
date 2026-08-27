import Link from "next/link";
import { ChevronRight, Link2, TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TallySubmissionRowActions } from "@/components/tally-submission-row-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

function displayName(submission: {
  respondent_name: string | null;
  respondent_email: string | null;
}) {
  return (
    submission.respondent_name?.trim() ||
    submission.respondent_email?.trim() ||
    "Sem nome"
  );
}

export default async function JourneysOnboardingsPage() {
  const supabase = await createClient();

  const [{ data: submissions }, { data: students }] = await Promise.all([
    supabase
      .from("tally_submissions")
      .select(
        "id, submission_kind, status, respondent_name, respondent_email, source_form_name, created_at, student_id, check_in_id, student:profiles!tally_submissions_student_id_fkey(full_name, email)",
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
  const onboardings =
    submissions?.filter((s) => s.submission_kind === "onboarding") ?? [];

  const inbox = onboardings.filter(
    (s) => s.status === "pending" || s.status === "linked",
  );
  const unlinked = onboardings.filter((s) => !s.student_id);
  const done = onboardings.filter((s) => s.status === "processed");
  const checkinUnresolved =
    submissions?.filter(
      (s) => s.submission_kind === "checkin" && s.check_in_id === null,
    ) ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Por tratar{" "}
          <span className="text-muted-foreground">({inbox.length})</span>
        </h2>
        {inbox.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Sem novos onboardings por tratar.
          </Card>
        ) : (
          <div className="grid gap-3">
            {inbox.map((submission) => {
              const unlinkedItem = !submission.student_id;
              return (
                <Link
                  key={submission.id}
                  href={`/studio/intake/${submission.id}`}
                  className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40"
                >
                  <Card
                    className={cn(
                      "flex items-center justify-between gap-3 p-5 transition-colors hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">
                        {displayName(submission)}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {submission.respondent_email ?? "Sem email"} ·{" "}
                        {submission.source_form_name ?? "Onboarding"} ·{" "}
                        {formatDateTime(submission.created_at)}
                      </p>
                      {unlinkedItem ? (
                        <p className="text-xs text-amber-200/90">
                          Sem aluno vinculado
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-200/80">
                          Já vinculado — falta confirmar
                        </p>
                      )}
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {unlinked.length > 0 &&
      unlinked.some((s) => s.status !== "pending" && s.status !== "linked") ? (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-amber-200/90">
            <Link2 className="size-4 text-amber-400" />
            Outros sem aluno
          </h3>
          <div className="grid gap-3">
            {unlinked
              .filter((s) => s.status !== "pending" && s.status !== "linked")
              .map((submission) => (
                <Link
                  key={submission.id}
                  href={`/studio/intake/${submission.id}`}
                  className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40"
                >
                  <Card className="flex items-center justify-between gap-3 p-5 transition-colors hover:bg-white/[0.04]">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">
                        {displayName(submission)}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {submission.respondent_email ?? "Sem email"} ·{" "}
                        {formatDateTime(submission.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </Card>
                </Link>
              ))}
          </div>
        </section>
      ) : null}

      {checkinUnresolved.length > 0 ? (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-amber-200/90">
            <TriangleAlert className="size-4 text-amber-400" />
            Check-ins por ligar ({checkinUnresolved.length})
          </h3>
          <div className="grid gap-3">
            {checkinUnresolved.map((submission) => (
              <Card
                key={submission.id}
                className="flex items-center justify-between gap-3 p-5"
              >
                <Link
                  href={`/studio/intake/${submission.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate font-medium">
                    {displayName(submission)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {submission.respondent_email ?? "Sem email"} ·{" "}
                    {formatDateTime(submission.created_at)}
                  </p>
                </Link>
                <TallySubmissionRowActions
                  submissionId={submission.id}
                  students={studentOptions}
                  linkedStudentId={submission.student_id}
                  submissionKind={submission.submission_kind}
                  emphasizeLink
                  showView={false}
                />
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {done.length > 0 ? (
        <details className="group space-y-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Já confirmados ({done.length})
          </summary>
          <div className="grid gap-2">
            {done.map((submission) => {
              const student = Array.isArray(submission.student)
                ? submission.student[0]
                : submission.student;
              return (
                <Card
                  key={submission.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <Link
                    href={`/studio/intake/${submission.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate font-medium">
                      {displayName(submission)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {submission.respondent_email ?? "Sem email"}
                      {student?.full_name || student?.email
                        ? ` · ${student.full_name || student.email}`
                        : ""}
                    </p>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
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
