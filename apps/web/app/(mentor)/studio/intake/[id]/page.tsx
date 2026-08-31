import Link from "next/link";
import { notFound } from "next/navigation";

import {
  markTallySubmissionPending,
  markTallySubmissionProcessed,
} from "@/lib/actions/tally";
import { createClient } from "@/lib/supabase/server";
import {
  extractTallyContactInfo,
  resolveTallyAnswers,
  TallyAnswerList,
} from "@/components/tally-answers";
import { OnboardingIntakeActions } from "@/components/onboarding-intake-actions";
import { TallySubmissionRowActions } from "@/components/tally-submission-row-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

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
  const contact = extractTallyContactInfo(answers);
  const isOnboarding = submission.submission_kind === "onboarding";
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

          {!isOnboarding ? (
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
                    Reabrir
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
                emphasizeLink={!submission.student_id}
              />
            </div>
          ) : (
            <TallySubmissionRowActions
              submissionId={submission.id}
              students={students ?? []}
              linkedStudentId={submission.student_id}
              showView={false}
              submissionKind={submission.submission_kind}
            />
          )}
        </div>
      </header>

      {isOnboarding ? (
        <Card className="space-y-4 p-5 sm:p-6">
          <OnboardingIntakeActions
            submissionId={submission.id}
            students={students ?? []}
            linkedStudentId={submission.student_id}
            status={submission.status}
          />
        </Card>
      ) : null}

      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold">Contacto</h2>
        <div className="space-y-1.5 text-base">
          <p>
            <span className="text-muted-foreground">Nome:</span>{" "}
            {submission.respondent_name ?? "—"}
          </p>
          {contact.age ? (
            <p>
              <span className="text-muted-foreground">Idade:</span> {contact.age}{" "}
              anos
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {submission.respondent_email ?? "—"}
          </p>
        </div>

        {contact.instagramUrl || contact.whatsappUrl ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {contact.instagramUrl ? (
              <Button
                render={
                  <a
                    href={contact.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
                size="lg"
                variant="secondary"
                className={cn(
                  "h-11 w-full gap-1.5 px-2 text-sm font-semibold sm:h-14 sm:gap-2 sm:px-4 sm:text-base",
                )}
              >
                <InstagramMark className="size-4 sm:size-5" />
                Instagram
              </Button>
            ) : null}
            {contact.whatsappUrl ? (
              <Button
                render={
                  <a
                    href={contact.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
                size="lg"
                variant="secondary"
                className="h-11 w-full gap-1.5 px-2 text-sm font-semibold sm:h-14 sm:gap-2 sm:px-4 sm:text-base"
              >
                <MessageCircle className="size-4 sm:size-5" />
                WhatsApp
              </Button>
            ) : null}
          </div>
        ) : null}

        {submission.video_url ? (
          <a
            href={submission.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--neuma-coral)] hover:underline"
          >
            Abrir ficheiro
          </a>
        ) : null}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Respostas</h2>
        <TallyAnswerList answers={answers} />
      </Card>
    </div>
  );
}

function InstagramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.75"
        className="text-muted-foreground"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        stroke="currentColor"
        strokeWidth="1.75"
        className="text-muted-foreground"
      />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" className="text-muted-foreground" />
    </svg>
  );
}
