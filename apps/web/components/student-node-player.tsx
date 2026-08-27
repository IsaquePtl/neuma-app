import Link from "next/link";
import {
  Video,
  MessageSquare,
  ExternalLink,
  FileText,
} from "lucide-react";

import type {
  StudentNode,
  StudentUpcomingBooking,
} from "@/lib/students/queries";
import { Button } from "@/components/ui/button";
import { VideoEmbed, toEmbedUrl } from "@/components/video-embed";
import { CheckpointQuiz } from "@/components/checkpoint-quiz";
import { SessionBookingSection } from "@/components/session-booking-section";
import { SupportMediaToggle } from "@/components/support-media-toggle";
import { formatDate, nodeKindLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Anexo de apoio (link externo) — usado quando não é vídeo. */
function SupportAttachmentButton({
  url,
  label = "Abrir anexo de apoio",
}: {
  url: string;
  label?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm transition-colors hover:bg-white/[0.07]"
    >
      <span className="inline-flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
          <FileText className="size-3.5 text-[var(--neuma-coral)]" />
        </span>
        <span className="truncate font-medium">{label}</span>
      </span>
      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

function NodeLevelHeader({
  node,
  levelNumber,
}: {
  node: StudentNode;
  levelNumber: number;
}) {
  return (
    <header className="shrink-0">
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            "student-path-marker relative grid size-14 shrink-0 place-items-center rounded-full",
            "neuma-gradient text-base font-semibold tabular-nums text-white",
            "shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]",
          )}
          aria-hidden
        >
          {levelNumber}
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium uppercase leading-none tracking-[0.2em] text-muted-foreground">
            {nodeKindLabel[node.kind]}
            {node.due_date ? (
              <>
                <span aria-hidden className="mx-2 text-white/25">
                  ·
                </span>
                Até {formatDate(node.due_date)}
              </>
            ) : null}
          </p>
          <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {node.title}
          </h1>
        </div>
      </div>
    </header>
  );
}

function CheckInActions({
  node,
  practiceStyle = false,
}: {
  node: StudentNode;
  practiceStyle?: boolean;
}) {
  if (node.status === "completed") return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        render={<Link href={`/checkins/new?node=${node.id}`} />}
        nativeButton={false}
        className="gap-2"
      >
        <Video className="size-4" />
        {practiceStyle ? "Fazer check-in" : "Confirmar que concluíste"}
      </Button>
      {practiceStyle ? (
        <Button
          render={<Link href="/session" />}
          nativeButton={false}
          variant="secondary"
          className="gap-2"
        >
          <MessageSquare className="size-4" /> Falar no Mentor
        </Button>
      ) : null}
    </div>
  );
}

function SessionLayout({
  node,
  levelNumber,
  mentorName,
  calUser,
  upcomingBooking,
  canBookSessions,
}: {
  node: StudentNode;
  levelNumber: number;
  mentorName?: string | null;
  calUser: string;
  upcomingBooking: StudentUpcomingBooking | null;
  canBookSessions: boolean;
}) {
  return (
    <div className="space-y-5">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.content_body ? (
        <div className="whitespace-pre-wrap text-sm text-muted-foreground">
          {node.content_body}
        </div>
      ) : null}

      {node.resource_url ? (
        <SupportMediaToggle
          url={node.resource_url}
          title={node.title}
          label="Abrir anexo de apoio"
        />
      ) : null}

      <SessionBookingSection
        initialBooking={upcomingBooking}
        mentorName={mentorName}
        calUser={calUser}
        canBookSessions={canBookSessions}
      />
    </div>
  );
}

function RecordingLayout({
  node,
  levelNumber,
}: {
  node: StudentNode;
  levelNumber: number;
}) {
  return (
    <div className="space-y-6">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.resource_url ? (
        <VideoEmbed
          url={node.resource_url}
          title={node.title}
          className="aspect-video w-full overflow-hidden rounded-xl border border-white/10"
          fallbackLabel="Abrir aula"
        />
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
          Ainda sem vídeo neste nível.
        </p>
      )}

      {node.content_body ? (
        <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          {node.content_body}
        </div>
      ) : null}

      <CheckInActions node={node} />
    </div>
  );
}

function PracticeLayout({
  node,
  levelNumber,
}: {
  node: StudentNode;
  levelNumber: number;
}) {
  const hasVideo = Boolean(node.resource_url && toEmbedUrl(node.resource_url));

  return (
    <div className="space-y-6">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.content_body ? (
        <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          {node.content_body}
        </div>
      ) : null}

      {node.resource_url ? (
        hasVideo ? (
          <VideoEmbed
            url={node.resource_url}
            title={node.title}
            fallbackLabel="Abrir recurso"
          />
        ) : (
          <SupportAttachmentButton
            url={node.resource_url}
            label="Abrir ficheiro / link"
          />
        )
      ) : null}

      <CheckInActions node={node} practiceStyle />
    </div>
  );
}

function CheckpointLayout({
  node,
  levelNumber,
}: {
  node: StudentNode;
  levelNumber: number;
}) {
  return (
    <div className="space-y-6">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.content_body ? (
        <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          {node.content_body}
        </div>
      ) : null}

      <CheckpointQuiz nodeId={node.id} />

      {node.resource_url ? (
        <SupportMediaToggle
          url={node.resource_url}
          title={node.title}
          label="Abrir anexo de apoio"
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {node.status !== "completed" ? (
          <Button
            render={<Link href={`/checkins/new?node=${node.id}`} />}
            nativeButton={false}
            variant="secondary"
            className="gap-2"
          >
            <Video className="size-4" /> Fazer check-in
          </Button>
        ) : null}
        <Button
          render={<Link href="/session" />}
          nativeButton={false}
          variant="secondary"
          className="gap-2"
        >
          <MessageSquare className="size-4" /> Falar no Mentor
        </Button>
      </div>
    </div>
  );
}

export function StudentNodePlayer({
  node,
  levelNumber,
  mentorName,
  calUsername,
  upcomingBooking = null,
  canBookSessions = true,
}: {
  node: StudentNode;
  levelNumber: number;
  mentorName?: string | null;
  calUsername?: string | null;
  upcomingBooking?: StudentUpcomingBooking | null;
  canBookSessions?: boolean;
}) {
  const calUser =
    calUsername ||
    process.env.NEXT_PUBLIC_CALCOM_USERNAME ||
    "isaque-portilho-nutfa9";

  if (node.kind === "call") {
    return (
      <SessionLayout
        node={node}
        levelNumber={levelNumber}
        mentorName={mentorName}
        calUser={calUser}
        upcomingBooking={upcomingBooking}
        canBookSessions={canBookSessions}
      />
    );
  }

  if (node.kind === "lesson" || node.kind === "resource") {
    return (
      <RecordingLayout node={node} levelNumber={levelNumber} />
    );
  }

  if (node.kind === "milestone") {
    return (
      <CheckpointLayout node={node} levelNumber={levelNumber} />
    );
  }

  return (
    <PracticeLayout node={node} levelNumber={levelNumber} />
  );
}
