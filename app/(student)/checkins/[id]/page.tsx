import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Video, ExternalLink, MessageSquare, RefreshCw } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckInStatusBadge } from "@/components/status-badges";
import { checkInKindLabel, formatDateTime } from "@/lib/labels";

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
      "id, status, kind, video_url, notes, created_at, node_id, student_id, node:nodes(title, description), feedback:feedbacks(notes, next_steps, video_url, approved, created_at)",
    )
    .eq("id", id)
    .single();

  if (!checkIn || checkIn.student_id !== user!.id) notFound();

  const node = Array.isArray(checkIn.node) ? checkIn.node[0] : checkIn.node;
  const feedback = Array.isArray(checkIn.feedback)
    ? checkIn.feedback[0]
    : checkIn.feedback;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/checkins"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Check-ins
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Check-in</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {node?.title ?? "Bloco"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {checkInKindLabel[checkIn.kind]} · {formatDateTime(checkIn.created_at)}
          </p>
        </div>
        <CheckInStatusBadge status={checkIn.status} />
      </header>

      <Card className="space-y-4 p-6">
        {checkIn.video_url ? (
          <a
            href={checkIn.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm hover:underline"
          >
            <Video className="size-4" /> Ver o meu video
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
        {checkIn.notes ? (
          <p className="whitespace-pre-wrap text-sm">{checkIn.notes}</p>
        ) : null}
      </Card>

      {feedback ? (
        <Card className="neuma-accent-top space-y-3 p-6">
          <p className="flex items-center gap-2 font-medium">
            <MessageSquare className="size-4 text-[var(--neuma-coral)]" />
            Feedback do mentor
          </p>
          {feedback.notes ? (
            <p className="whitespace-pre-wrap text-sm">{feedback.notes}</p>
          ) : null}
          {feedback.next_steps ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Proximos passos
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {feedback.next_steps}
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {checkIn.status === "needs_revision" && checkIn.node_id ? (
        <Button
          render={<Link href={`/checkins/new?node=${checkIn.node_id}`} />}
          nativeButton={false}
          className="gap-2"
        >
          <RefreshCw className="size-4" /> Reenviar check-in
        </Button>
      ) : null}
    </div>
  );
}
