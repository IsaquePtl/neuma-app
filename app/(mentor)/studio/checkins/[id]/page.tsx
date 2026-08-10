import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  resolveTallyAnswers,
  TallyAnswerList,
} from "@/components/tally-answers";
import { VideoEmbed } from "@/components/video-embed";
import { Card } from "@/components/ui/card";
import { CheckInStatusBadge } from "@/components/status-badges";
import { MentorFeedbackPanel } from "@/components/mentor-feedback-panel";
import { checkInKindLabel, formatDateTime } from "@/lib/labels";

export default async function CheckinDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; student?: string; path?: string }>;
}) {
  const { id } = await params;
  const { from, student: studentParam, path: pathParam } = await searchParams;
  const supabase = await createClient();

  const { data: checkIn } = await supabase
    .from("check_ins")
    .select(
      "id, status, kind, video_url, notes, ai_summary, created_at, student_id, student:profiles!check_ins_student_id_fkey(full_name, email), node:nodes(title, description)",
    )
    .eq("id", id)
    .single();

  if (!checkIn) notFound();

  const [{ data: feedback }, { data: draft }, { data: tally }] =
    await Promise.all([
      supabase.from("feedbacks").select("*").eq("check_in_id", id).maybeSingle(),
      supabase
        .from("feedback_drafts")
        .select("id, body_notes, body_next_steps, status")
        .eq("check_in_id", id)
        .eq("status", "pending_review")
        .maybeSingle(),
      supabase
        .from("tally_submissions")
        .select("answers, payload, video_url")
        .eq("check_in_id", id)
        .maybeSingle(),
    ]);

  const student = Array.isArray(checkIn.student)
    ? checkIn.student[0]
    : checkIn.student;
  const node = Array.isArray(checkIn.node) ? checkIn.node[0] : checkIn.node;
  const studentName = student?.full_name ?? student?.email ?? "o aluno";
  const studentId = studentParam || checkIn.student_id;
  const fromStudent = from === "student" && studentId;
  const fromDashboard = from === "dashboard";
  const fromJourney = from === "journey" && pathParam;
  const backHref = fromStudent
    ? `/studio/students/${studentId}`
    : fromJourney
      ? `/studio/journeys/${pathParam}`
      : fromDashboard
        ? "/studio"
        : "/studio/journeys/checkins";
  const backLabel = fromStudent
    ? "Ficha do aluno"
    : fromJourney
      ? "Percurso"
      : fromDashboard
        ? "Menu e Dashboard"
        : "Check-ins";
  const returnTo = fromStudent
    ? `/studio/students/${studentId}`
    : fromJourney
      ? `/studio/journeys/${pathParam}`
      : "";
  const answers = tally
    ? resolveTallyAnswers(tally.answers, tally.payload)
    : [];
  const videoUrl = checkIn.video_url || tally?.video_url || null;

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {studentId ? (
              <Link
                href={`/studio/students/${studentId}`}
                className="hover:text-foreground"
              >
                {studentName}
              </Link>
            ) : (
              studentName
            )}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {node?.title ?? "Bloco"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {checkInKindLabel[checkIn.kind]} ·{" "}
            {formatDateTime(checkIn.created_at)}
          </p>
        </div>
        <CheckInStatusBadge status={checkIn.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)] lg:items-start">
        <div className="space-y-4">
          {checkIn.ai_summary ? (
            <Card className="neuma-accent-top space-y-2 p-5">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--neuma-coral)]">
                <Sparkles className="size-4" /> Resumo da IA
              </p>
              <p className="whitespace-pre-wrap text-sm">{checkIn.ai_summary}</p>
            </Card>
          ) : (
            <Card className="space-y-2 border-dashed p-5">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-4" /> Resumo da IA
              </p>
              <p className="text-sm text-muted-foreground">
                Resumo ainda não disponível. Pode aparecer após a geração
                automática — atualiza a página se precisares.
              </p>
            </Card>
          )}

          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Submissão do aluno
            </h2>
            {videoUrl ? (
              <VideoEmbed
                url={videoUrl}
                title={`Check-in · ${studentName}`}
                fallbackLabel="Abrir ficheiro do aluno"
              />
            ) : null}
            {answers.length > 0 ? (
              <TallyAnswerList answers={answers} />
            ) : checkIn.notes ? (
              <p className="whitespace-pre-wrap text-sm">{checkIn.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sem respostas.</p>
            )}
            {node?.description ? (
              <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <p className="text-xs text-muted-foreground">Bloco</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {node.description}
                </p>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="lg:sticky lg:top-8">
          <MentorFeedbackPanel
            checkInId={checkIn.id}
            studentName={studentName}
            existing={feedback}
            draft={draft}
            returnTo={returnTo || undefined}
          />
        </div>
      </div>
    </div>
  );
}
