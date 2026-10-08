import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Video, FileText, Phone } from "lucide-react";

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
import { PhaseReviewChecklist } from "@/components/phase-review-checklist";
import type { PhaseReview } from "@/lib/nodes/phase-review";
import { markNodeSeen } from "@/lib/actions/journey-level";
import { formatDate, nodeKindLabel, phaseKeyLabel } from "@/lib/labels";
import {
  nodeAllowsMarkSeen,
  nodeRequiresCheckIn,
  nodeUsesQuizGate,
} from "@/lib/nodes/pass-rule";
import { cn } from "@/lib/utils";

/** Full-width lesson video — matches sibling content column (e.g. text card). */
function LessonVideoPlayer({
  url,
  title,
  poster,
  fallbackLabel = "Abrir aula",
}: {
  url: string;
  title?: string;
  poster?: string | null;
  fallbackLabel?: string;
}) {
  return (
    <MediaVideoPlayer
      url={url}
      title={title}
      poster={poster}
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

function LevelIntro({ text }: { text: string }) {
  const compact = text.trim();
  if (!compact) return null;
  const prose =
    "break-words whitespace-pre-wrap text-[13px] leading-snug text-white/55";
  if (compact.length <= 180) {
    return <p className={cn("mt-1.5 pr-6 sm:pr-10", prose)}>{compact}</p>;
  }
  return (
    <details className="group mt-1.5 pr-6 sm:pr-10">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className={cn(prose, "line-clamp-2 group-open:line-clamp-none")}>
          {compact}
        </span>
        <span className="mt-1 block text-xs text-white/40 group-open:hidden">
          Ver mais
        </span>
        <span className="mt-1 hidden text-xs text-white/40 group-open:block">
          Ver menos
        </span>
      </summary>
    </details>
  );
}

export function NodeLevelHeader({
  node,
  levelNumber,
  section,
}: {
  node: StudentNode;
  levelNumber: number;
  /** Extra eyebrow segment after the level type (e.g. "Check-in"). */
  section?: string;
}) {
  return (
    <header className="min-w-0 shrink-0">
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          className={cn(
            "student-path-marker relative mt-0.5 grid size-14 shrink-0 place-items-center rounded-full",
            "neuma-gradient text-base font-semibold tabular-nums text-white",
            "shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]",
          )}
          aria-hidden
        >
          {levelNumber}
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium uppercase leading-none tracking-[0.2em] text-muted-foreground">
            {node.phase_key ? (
              <>
                {phaseKeyLabel(node.phase_key)}
                <span aria-hidden className="mx-2 text-white/25">
                  ·
                </span>
              </>
            ) : null}
            {nodeKindLabel[node.kind]}
            {section ? (
              <>
                <span aria-hidden className="mx-2 text-white/25">
                  ·
                </span>
                {section}
              </>
            ) : null}
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
          {node.content_body ? <LevelIntro text={node.content_body} /> : null}
        </div>
      </div>
    </header>
  );
}

export function CheckInActions({
  node,
  canSubmitCheckIn = true,
  blockedMessage = null,
  preview = false,
  checkInSlot,
}: {
  node: StudentNode;
  canSubmitCheckIn?: boolean;
  blockedMessage?: string | null;
  preview?: boolean;
  checkInSlot?: ReactNode;
}) {
  if (preview || node.kind === "call") return null;

  const markSeen = nodeAllowsMarkSeen(node.pass_rule) ? (
    node.status === "completed" ? (
      <Button
        type="button"
        disabled
        className="h-14 w-full gap-2 text-base font-semibold"
      >
        <Check />
        Já visto
      </Button>
    ) : (
      <form action={markNodeSeen} className="flex min-w-0 flex-col gap-2">
        <input type="hidden" name="node_id" value={node.id} />
        <Button type="submit" className="h-14 w-full gap-2 text-base font-semibold">
          Marcar como visto
        </Button>
      </form>
    )
  ) : null;

  if (checkInSlot !== undefined) {
    return (
      <>
        {markSeen}
        {nodeRequiresCheckIn(node.pass_rule) ? checkInSlot : null}
      </>
    );
  }

  if (node.status === "completed") {
    return markSeen;
  }

  if (markSeen) return markSeen;

  if (!nodeRequiresCheckIn(node.pass_rule)) {
    return null;
  }

  const kind = node.check_in_kind;
  const href = `/checkins/new?node=${node.id}`;
  const label =
    kind === "call"
      ? "Registar a chamada"
      : kind === "text"
        ? "Fazer check-in em texto"
        : "Fazer check-in em vídeo";
  const Icon = kind === "call" ? Phone : kind === "text" ? FileText : Video;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {canSubmitCheckIn ? (
        <Button
          render={<Link href={href} />}
          nativeButton={false}
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          <Icon className="size-4" />
          {label}
        </Button>
      ) : (
        <Button
          disabled
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          <Icon className="size-4" />
          {label}
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

function GateControls({
  node,
  canSubmitCheckIn = true,
  blockedMessage = null,
  preview = false,
  pathId,
  phaseCheckpoint = null,
  checkInSlot,
}: {
  node: StudentNode;
  canSubmitCheckIn?: boolean;
  blockedMessage?: string | null;
  preview?: boolean;
  pathId?: string;
  phaseCheckpoint?: PhaseReview | null;
  checkInSlot?: ReactNode;
}) {
  const quizGate = node.kind !== "call" && nodeUsesQuizGate(node.pass_rule);
  const phase =
    phaseCheckpoint && quizGate && phaseCheckpoint.items.length > 0
      ? {
          label: phaseCheckpoint.phaseLabel,
          reviewCount: phaseCheckpoint.items.length,
          pendingReview: phaseCheckpoint.reviewRequired
            ? phaseCheckpoint.pendingCount
            : 0,
        }
      : null;

  return (
    <>
      {quizGate ? (
        <CheckpointQuiz
          nodeId={node.id}
          quizGate={quizGate}
          passScore={node.pass_score}
          preview={preview}
          pathId={pathId}
          phase={node.status === "completed" ? null : phase}
        />
      ) : null}
      <CheckInActions
        node={node}
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={blockedMessage}
        preview={preview}
        checkInSlot={checkInSlot}
      />
    </>
  );
}

function SessionLayout({
  node,
  levelNumber,
  mentorName,
  calUser,
  upcomingBooking,
  canBookSessions,
  canSubmitCheckIn = true,
  blockedMessage = null,
  preview = false,
  pathId,
  checkInSlot,
}: {
  node: StudentNode;
  levelNumber: number;
  mentorName?: string | null;
  calUser: string;
  upcomingBooking: StudentUpcomingBooking | null;
  canBookSessions: boolean;
  canSubmitCheckIn?: boolean;
  blockedMessage?: string | null;
  preview?: boolean;
  pathId?: string;
  checkInSlot?: ReactNode;
}) {
  return (
    <div className="min-w-0 w-full max-w-full space-y-5">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.resource_url ? (
        <SupportMediaToggle
          url={node.resource_url}
          title={node.title}
          poster={node.poster_url}
          label="Abrir anexo de apoio"
        />
      ) : null}

      <SessionBookingSection
        initialBooking={upcomingBooking}
        mentorName={mentorName}
        calUser={calUser}
        canBookSessions={preview ? false : canBookSessions}
      />

      <GateControls
        node={node}
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={blockedMessage}
        preview={preview}
        pathId={pathId}
        checkInSlot={checkInSlot}
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
  pathId,
  phaseCheckpoint = null,
  checkInSlot,
}: {
  node: StudentNode;
  levelNumber: number;
  canSubmitCheckIn?: boolean;
  blockedMessage?: string | null;
  preview?: boolean;
  pathId?: string;
  phaseCheckpoint?: PhaseReview | null;
  checkInSlot?: ReactNode;
}) {
  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.resource_url ? (
        <LessonVideoPlayer
          url={node.resource_url}
          title={node.title}
          poster={node.poster_url}
          fallbackLabel="Abrir aula"
        />
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
          Ainda sem vídeo neste nível.
        </p>
      )}

      {phaseCheckpoint?.reviewRequired && !preview ? (
        <PhaseReviewChecklist review={phaseCheckpoint} />
      ) : null}

      <GateControls
        node={node}
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={blockedMessage}
        preview={preview}
        pathId={pathId}
        phaseCheckpoint={phaseCheckpoint}
        checkInSlot={checkInSlot}
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
  pathId,
  phaseCheckpoint = null,
  checkInSlot,
}: {
  node: StudentNode;
  levelNumber: number;
  canSubmitCheckIn?: boolean;
  blockedMessage?: string | null;
  preview?: boolean;
  pathId?: string;
  phaseCheckpoint?: PhaseReview | null;
  checkInSlot?: ReactNode;
}) {
  const hasVideo = isPlayableVideoUrl(node.resource_url);

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {node.resource_url ? (
        hasVideo ? (
          <LessonVideoPlayer
            url={node.resource_url}
            title={node.title}
            poster={node.poster_url}
            fallbackLabel="Abrir recurso"
          />
        ) : (
          <SupportAttachmentButton
            url={node.resource_url}
            label="Abrir ficheiro / link"
          />
        )
      ) : null}

      {phaseCheckpoint?.reviewRequired && !preview ? (
        <PhaseReviewChecklist review={phaseCheckpoint} />
      ) : null}

      <GateControls
        node={node}
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={blockedMessage}
        preview={preview}
        pathId={pathId}
        phaseCheckpoint={phaseCheckpoint}
        checkInSlot={checkInSlot}
      />
    </div>
  );
}

function CheckpointLayout({
  node,
  levelNumber,
  canSubmitCheckIn = true,
  blockedMessage = null,
  preview = false,
  pathId,
  phaseCheckpoint = null,
  checkInSlot,
}: {
  node: StudentNode;
  levelNumber: number;
  canSubmitCheckIn?: boolean;
  blockedMessage?: string | null;
  preview?: boolean;
  pathId?: string;
  phaseCheckpoint?: PhaseReview | null;
  checkInSlot?: ReactNode;
}) {
  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <NodeLevelHeader node={node} levelNumber={levelNumber} />

      {phaseCheckpoint?.reviewRequired && !preview ? (
        <PhaseReviewChecklist review={phaseCheckpoint} />
      ) : null}

      <GateControls
        node={node}
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={blockedMessage}
        preview={preview}
        pathId={pathId}
        phaseCheckpoint={phaseCheckpoint}
        checkInSlot={checkInSlot}
      />

      {node.resource_url ? (
        <SupportMediaToggle
          url={node.resource_url}
          title={node.title}
          poster={node.poster_url}
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
  pathId,
  phaseCheckpoint = null,
  checkInSlot,
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
  pathId?: string;
  /** Present when this level is the checkpoint that closes its phase. */
  phaseCheckpoint?: PhaseReview | null;
  /** Replaces the inline check-in button (e.g. the Check-in + Feedback CTA). */
  checkInSlot?: ReactNode;
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
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={checkInBlockedMessage}
        preview={preview}
        pathId={pathId}
        checkInSlot={checkInSlot}
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
        pathId={pathId}
        phaseCheckpoint={phaseCheckpoint}
        checkInSlot={checkInSlot}
      />
    );
  }

  if (node.kind === "milestone") {
    return (
      <CheckpointLayout
        node={node}
        levelNumber={levelNumber}
        canSubmitCheckIn={canSubmitCheckIn}
        blockedMessage={checkInBlockedMessage}
        preview={preview}
        pathId={pathId}
        phaseCheckpoint={phaseCheckpoint}
        checkInSlot={checkInSlot}
      />
    );
  }

  return (
    <PracticeLayout
      node={node}
      levelNumber={levelNumber}
      canSubmitCheckIn={canSubmitCheckIn}
      blockedMessage={checkInBlockedMessage}
      preview={preview}
      pathId={pathId}
      phaseCheckpoint={phaseCheckpoint}
      checkInSlot={checkInSlot}
    />
  );
}
