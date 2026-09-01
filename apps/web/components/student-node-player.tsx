import Link from "next/link";
import { Video, FileText } from "lucide-react";

import type {
  StudentNode,
  StudentUpcomingBooking,
} from "@/lib/students/queries";
import { Button } from "@/components/ui/button";
import { MediaVideoPlayer } from "@/components/media-video-player";
import { isPlayableVideoUrl } from "@/components/video-embed";
import { CheckpointQuiz } from "@/components/checkpoint-quiz";
import { SessionBookingSection } from "@/components/session-booking-section";
import { SupportMediaToggle } from "@/components/support-media-toggle";
import { formatDate, nodeKindLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Full-width lesson video — matches sibling content column (e.g. text card). */
function LessonVideoPlayer({
  url,
  title,
  fallbackLabel = "Abrir aula",
}: {
  url: string;
  title?: string;
  fallbackLabel?: string;
}) {
  return (
    <MediaVideoPlayer
      url={url}
      title={title}
      size="full"
      fallbackLabel={fallbackLabel}
    />
  );
}

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
      className="inline-flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm transition-colors hover:bg-white/[0.07]"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
        <FileText className="size-3.5 text-[var(--neuma-coral)]" />
      </span>
      <span className="min-w-0 truncate font-medium">{label}</span>
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
    <header className="min-w-0 shrink-0">
      <div className="flex min-w-0 items-center gap-3.5">
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
          <h1 className="break-words font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
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
  canSubmitCheckIn = true,
  blockedMessage = null,
  preview = false,
}: {
  node: StudentNode;
  practiceStyle?: boolean;
  canSubmitCheckIn?: boolean;
  blockedMessage?: string | null;
  preview?: boolean;
}) {
  if (preview) return null;

  if (node.status === "completed") {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {canSubmitCheckIn ? (
        <Button
          render={<Link href={`/checkins/new?node=${node.id}`} />}
          nativeButton={false}
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          <Video className="size-4" />
          {practiceStyle ? "Fazer check-in" : "Confirmar que concluíste"}
        </Button>
      ) : (
        <Button
          disabled
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          <Video className="size-4" />
          {practiceStyle ? "Fazer check-in" : "Confirmar que concluíste"}
        </Button>
      )}
      {!canSubmitCheckIn && blockedMessage ? (
        <p className="break-words text-xs leading-snug text-muted-foreground">
          {blockedMessage}
        </p>
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
  preview = false,
}: {
  node: StudentNode;
  levelNumber: number;
  mentorName?: string | null;
  calUser: string;
  upcomingBooking: StudentUpcomingBooking | null;
  canBookSessions: boolean;
  preview?: boolean;
}) {
  return (
    <div className="min-w-0 w-full max-w-full space-y-5">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.content_body ? (
        <div className="min-w-0 break-words whitespace-pre-wrap text-sm text-muted-foreground">
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
        canBookSessions={preview ? false : canBookSessions}
      />
    </div>
  );
}

function RecordingLayout({
  node,
  levelNumber,
  canSubmitCheckIn = true,
  blockedMessage = null,
  preview = false,
}: {
  node: StudentNode;
  levelNumber: number;
  canSubmitCheckIn?: boolean;
  blockedMessage?: string | null;
  preview?: boolean;
}) {
  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.resource_url ? (
        <LessonVideoPlayer
          url={node.resource_url}
          title={node.title}
          fallbackLabel="Abrir aula"
        />
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
          Ainda sem vídeo neste nível.
        </p>
      )}

      {node.content_body ? (
        <div className="min-w-0 break-words whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          {node.content_body}
        </div>
      ) : null}

      <CheckInActions
        node={node}
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={blockedMessage}
        preview={preview}
      />
    </div>
  );
}

function PracticeLayout({
  node,
  levelNumber,
  canSubmitCheckIn = true,
  blockedMessage = null,
  preview = false,
}: {
  node: StudentNode;
  levelNumber: number;
  canSubmitCheckIn?: boolean;
  blockedMessage?: string | null;
  preview?: boolean;
}) {
  const hasVideo = isPlayableVideoUrl(node.resource_url);

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.content_body ? (
        <div className="min-w-0 break-words whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          {node.content_body}
        </div>
      ) : null}

      {node.resource_url ? (
        hasVideo ? (
          <LessonVideoPlayer
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

      <CheckInActions
        node={node}
        practiceStyle
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={blockedMessage}
        preview={preview}
      />
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
    <div className="min-w-0 w-full max-w-full space-y-6">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.content_body ? (
        <div className="min-w-0 break-words whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
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
  canSubmitCheckIn = true,
  checkInBlockedMessage = null,
  preview = false,
}: {
  node: StudentNode;
  levelNumber: number;
  mentorName?: string | null;
  calUsername?: string | null;
  upcomingBooking?: StudentUpcomingBooking | null;
  canBookSessions?: boolean;
  canSubmitCheckIn?: boolean;
  checkInBlockedMessage?: string | null;
  preview?: boolean;
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
        preview={preview}
      />
    );
  }

  if (node.kind === "lesson" || node.kind === "resource") {
    return (
      <RecordingLayout
        node={node}
        levelNumber={levelNumber}
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={checkInBlockedMessage}
        preview={preview}
      />
    );
  }

  if (node.kind === "milestone") {
    return (
      <CheckpointLayout node={node} levelNumber={levelNumber} />
    );
  }

  return (
    <PracticeLayout
      node={node}
      levelNumber={levelNumber}
      canSubmitCheckIn={canSubmitCheckIn}
      blockedMessage={checkInBlockedMessage}
      preview={preview}
    />
  );
}
