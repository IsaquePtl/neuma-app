import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import {
  markTallySubmissionPending,
  markTallySubmissionProcessed,
} from "@/lib/actions/tally";
import { createClient } from "@/lib/supabase/server";
import {
  resolveTallyAnswers,
  TallyAnswerList,
} from "@/components/tally-answers";
import { TallySubmissionRowActions } from "@/components/tally-submission-row-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/labels";

export default async function TallySubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: submission }, { data: students }] = await Promise.all([
    supabase.from("tally_submissions").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student")
      .order("full_name", { ascending: true }),
  ]);

  if (!submission) notFound();

  const answers = resolveTallyAnswers(submission.answers, submission.payload);
  const title =
    submission.respondent_name ??
    submission.respondent_email ??
    "Submissão";

  return (
    <div className="space-y-6">
      <header className="neuma-accent-top space-y-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {submission.submission_kind} · {submission.status}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {submission.source_form_name ?? "Formulário"} ·{" "}
              {formatDateTime(submission.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {submission.status === "pending" ? (
              <form action={markTallySubmissionProcessed}>
                <input type="hidden" name="id" value={submission.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Marcar como tratado
                </Button>
              </form>
            ) : submission.status !== "archived" ? (
              <form action={markTallySubmissionPending}>
                <input type="hidden" name="id" value={submission.id} />
                <Button type="submit" variant="outline" size="sm">
                  Reabrir na inbox
                </Button>
              </form>
            ) : null}
            {submission.student_id ? (
              <Button
                render={
                  <Link href={`/studio/students/${submission.student_id}`} />
                }
                nativeButton={false}
                variant="secondary"
                size="sm"
              >
                Abrir ficha
              </Button>
            ) : null}
            {submission.check_in_id ? (
              <Button
                render={
                  <Link href={`/studio/checkins/${submission.check_in_id}`} />
                }
                nativeButton={false}
                size="sm"
              >
                Avaliar
              </Button>
            ) : null}
            <TallySubmissionRowActions
              submissionId={submission.id}
              students={students ?? []}
              linkedStudentId={submission.student_id}
              showView={false}
              submissionKind={submission.submission_kind}
            />
          </div>
        </div>
      </header>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Contacto</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Nome
            </dt>
            <dd className="text-sm">{submission.respondent_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Email
            </dt>
            <dd className="text-sm">{submission.respondent_email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Form ID
            </dt>
            <dd className="text-sm">{submission.source_form_id}</dd>
          </div>
          {submission.video_url ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Ficheiro principal
              </dt>
              <dd>
                <a
                  href={submission.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--neuma-coral)] hover:underline"
                >
                  Abrir ficheiro <ExternalLink className="size-3.5" />
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Respostas</h2>
        <TallyAnswerList answers={answers} />
      </Card>
    </div>
  );
}
