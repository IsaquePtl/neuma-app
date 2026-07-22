import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Video, ExternalLink } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CheckInStatusBadge } from "@/components/status-badges";
import { MentorFeedbackPanel } from "@/components/mentor-feedback-panel";
import { checkInKindLabel, formatDateTime } from "@/lib/labels";

export default async function CheckinDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: checkIn } = await supabase
    .from("check_ins")
    .select(
      "id, status, kind, video_url, notes, ai_summary, created_at, student:profiles!check_ins_student_id_fkey(full_name, email), node:nodes(title, description)",
    )
    .eq("id", id)
    .single();

  if (!checkIn) notFound();

  const { data: feedback } = await supabase
    .from("feedbacks")
    .select("*")
    .eq("check_in_id", id)
    .maybeSingle();

  const { data: draft } = await supabase
    .from("feedback_drafts")
    .select("id, body_notes, body_next_steps, status")
    .eq("check_in_id", id)
    .eq("status", "pending_review")
    .maybeSingle();

  const student = Array.isArray(checkIn.student)
    ? checkIn.student[0]
    : checkIn.student;
  const node = Array.isArray(checkIn.node) ? checkIn.node[0] : checkIn.node;
  const studentName = student?.full_name ?? student?.email ?? "o aluno";

  return (
    <div className="space-y-8">
      <Link
        href="/studio/checkins"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Check-ins
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{studentName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {node?.title ?? "Bloco"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {checkInKindLabel[checkIn.kind]} - {formatDateTime(checkIn.created_at)}
          </p>
        </div>
        <CheckInStatusBadge status={checkIn.status} />
      </header>

      <Card className="space-y-4 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Submissao do aluno
        </h2>
        {checkIn.video_url ? (
          <a
            href={checkIn.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-secondary"
          >
            <Video className="size-4" /> Abrir video
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">Sem video.</p>
        )}
        {checkIn.notes ? (
          <p className="whitespace-pre-wrap text-sm">{checkIn.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem notas.</p>
        )}
        {checkIn.ai_summary ? (
          <div className="rounded-lg bg-secondary/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resumo para ti
            </p>
            <p className="mt-1 text-sm">{checkIn.ai_summary}</p>
          </div>
        ) : null}
      </Card>

      <MentorFeedbackPanel
        checkInId={checkIn.id}
        studentName={studentName}
        existing={feedback}
        draft={draft}
      />
    </div>
  );
}
