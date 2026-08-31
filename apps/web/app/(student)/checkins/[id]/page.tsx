import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  resolveTallyAnswers,
  TallyAnswerList,
} from "@/components/tally-answers";
import {
  FeedbackNextStepsCard,
  FeedbackNotesCard,
  MentorFeedbackCardHeader,
} from "@/components/student-feedback-sections";
import { StudentFeedbackCardBody } from "@/components/student-feedback-card-body";
import { StudentSubmissionCardBody } from "@/components/student-submission-card-body";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeedbackDecisionBlock } from "@/components/status-badges";
import { checkInKindLabel, checkInLevelTitle, formatDateTime } from "@/lib/labels";
import { resolveNextLevel } from "@/lib/feedbacks/student-shared";
import { loadMyPathWithNodes } from "@/lib/students/queries";
import { cn } from "@/lib/utils";

export default async function CheckInDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: checkIn } = await supabase
    .from("check_ins")
    .select(
      "id, status, kind, video_url, notes, created_at, node_id, level_label, student_id, node:nodes(title, description), feedback:feedbacks(notes, next_steps, video_url, approved, created_at)",
    )
    .eq("id", id)
    .single();

  if (!checkIn || checkIn.student_id !== user!.id) notFound();

  const { data: tally } = await supabase
    .from("tally_submissions")
    .select("answers, payload, video_url")
    .eq("check_in_id", id)
    .maybeSingle();

  const node = Array.isArray(checkIn.node) ? checkIn.node[0] : checkIn.node;
  const feedback = Array.isArray(checkIn.feedback)
    ? checkIn.feedback[0]
    : checkIn.feedback;
  const answers = tally
    ? resolveTallyAnswers(tally.answers, tally.payload)
    : [];
  const videoUrl = checkIn.video_url || tally?.video_url || null;
  const { nodes } = await loadMyPathWithNodes(user!.id);

  const nextLevel =
    checkIn.status === "approved" && checkIn.node_id
      ? resolveNextLevel(nodes, checkIn.node_id)
      : null;

  return (
    <div
      className={cn(
        "neuma-mobile-viewport flex w-full min-w-0 flex-col gap-6 overflow-y-auto overscroll-contain pb-6",
        "desktop:h-auto desktop:min-h-0 desktop:overflow-visible desktop:pb-4",
      )}
    >
      <header className="min-w-0 shrink-0 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Check-in
        </p>
        <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
          {checkInLevelTitle(node?.title, checkIn.level_label)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {checkInKindLabel[checkIn.kind]} ·{" "}
          {formatDateTime(checkIn.created_at)}
        </p>
      </header>

      <Card className="min-w-0 space-y-4 !p-4 sm:!p-5">
        <h2 className="text-sm font-medium">A tua submissão</h2>
        <StudentSubmissionCardBody videoUrl={videoUrl}>
          {answers.length > 0 || checkIn.notes || !videoUrl ? (
            answers.length > 0 ? (
              <TallyAnswerList answers={answers} compact />
            ) : checkIn.notes ? (
              <p className="break-words whitespace-pre-wrap text-sm">{checkIn.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem respostas guardadas.
              </p>
            )
          ) : null}
        </StudentSubmissionCardBody>
      </Card>

      {feedback ? (
        <Card className="neuma-accent-top min-w-0 space-y-4 !p-4 sm:!p-5">
          <MentorFeedbackCardHeader
            subtitle={`Feedback do check-in · ${formatDateTime(checkIn.created_at)}`}
          />
          <StudentFeedbackCardBody
            videoUrl={feedback.video_url}
            nextSteps={
              feedback.next_steps ? (
                <FeedbackNextStepsCard nextSteps={feedback.next_steps} />
              ) : null
            }
            footer={
              <FeedbackDecisionBlock
                status={checkIn.status}
                nextLevel={nextLevel}
                nodeId={checkIn.node_id ?? undefined}
                feedbackRefs={[{ kind: "check_in", referenceId: id }]}
              />
            }
          >
            {feedback.notes ? <FeedbackNotesCard notes={feedback.notes} /> : null}
          </StudentFeedbackCardBody>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          A aguardar feedback do mentor.
        </p>
      )}

      {checkIn.status === "needs_revision" && checkIn.node_id ? (
        <Button
          render={<Link href={`/checkins/new?node=${checkIn.node_id}`} />}
          nativeButton={false}
          variant="secondary"
          className="w-full shrink-0 gap-2 sm:w-auto"
        >
          <RefreshCw className="size-4 shrink-0" /> Reenviar check-in
        </Button>
      ) : null}
    </div>
  );
}
