"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import {
  MentorFeedbackPortraitActions,
  MentorFeedbackFields,
  MentorFeedbackPanel,
  MentorFeedbackProvider,
  MentorFeedbackStacked,
  type MentorFeedbackPanelProps,
} from "@/components/mentor-feedback-panel";
import { CheckInStatusBadge } from "@/components/status-badges";
import { TallyAnswerList } from "@/components/tally-answers";
import type { JourneyCheckIn } from "@/components/journey-path-composer";
import type { CheckInDetail } from "@/lib/journey-path/load-level-review";
import {
  mentorLevelReviewHref,
  type MentorLevelTab,
} from "@/lib/journey-path/level-review-url";
import { studentProfileHref } from "@/lib/journey-path/routes";
import {
  checkInKindLabel,
  formatDateTime,
} from "@/lib/labels";
import type { StudentNode } from "@/lib/students/queries";
import { StudentNodePlayer } from "@/components/student-node-player";
import { Card } from "@/components/ui/card";
import { VideoEmbed, toEmbedUrl } from "@/components/video-embed";
import { cn } from "@/lib/utils";

function parseStructuredNotes(notes: string | null) {
  if (!notes) {
    return { difficulty: null as string | null, confidence: null as string | null };
  }

  const difficultyMatch = notes.match(
    /Como correu \/ dificuldades:\n([\s\S]*?)(?:\n\nComo me sinto neste nível:|$)/,
  );
  const confidenceMatch = notes.match(
    /Como me sinto neste nível:\n([\s\S]*)$/,
  );

  if (difficultyMatch || confidenceMatch) {
    return {
      difficulty: difficultyMatch?.[1]?.trim() || null,
      confidence: confidenceMatch?.[1]?.trim() || null,
    };
  }

  return { difficulty: notes, confidence: null };
}

function SubmissionVideo({
  url,
  title,
  onPortraitChange,
  className,
}: {
  url: string;
  title: string;
  onPortraitChange?: (isPortrait: boolean) => void;
  className?: string;
}) {
  const [isPortrait, setIsPortrait] = useState(false);
  const onPortraitChangeRef = useRef(onPortraitChange);

  useEffect(() => {
    onPortraitChangeRef.current = onPortraitChange;
  }, [onPortraitChange]);

  useEffect(() => {
    setIsPortrait(false);
  }, [url]);

  const handleLoadedMetadata = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = event.currentTarget;
      const portrait = video.videoHeight > video.videoWidth;
      setIsPortrait(portrait);
      onPortraitChangeRef.current?.(portrait);
    },
    [],
  );

  if (toEmbedUrl(url)) {
    return (
      <VideoEmbed
        url={url}
        title={title}
        fallbackLabel="Abrir ficheiro do aluno"
      />
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40",
        isPortrait ? "aspect-[9/16]" : "aspect-video",
        className,
      )}
    >
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        className="absolute inset-0 size-full"
      >
        <track kind="captions" />
      </video>
    </div>
  );
}

const LEVEL_TABS: { id: MentorLevelTab; label: string }[] = [
  { id: "feedback", label: "Feedback" },
  { id: "nivel", label: "Nível" },
];

function MentorLevelTabs({
  pathId,
  nodeId,
  activeTab,
  checkin,
}: {
  pathId: string;
  nodeId: string;
  activeTab: MentorLevelTab;
  checkin?: string | null;
}) {
  return (
    <nav className="flex w-full flex-nowrap gap-0 border-b border-white/10 pb-px">
      {LEVEL_TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={mentorLevelReviewHref(pathId, nodeId, {
              checkin: checkin ?? undefined,
              tab: tab.id,
            })}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-t-lg px-3 py-3 text-sm transition-colors sm:py-3.5",
              "desktop:min-w-0 desktop:flex-none desktop:shrink-0 desktop:justify-start desktop:px-3 desktop:py-2",
              active
                ? "border-b-2 border-[var(--neuma-coral)] font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SubmissionHeader({ checkInDetail }: { checkInDetail: CheckInDetail }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        "desktop:col-span-2",
      )}
    >
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Submissão do aluno
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {checkInKindLabel[checkInDetail.kind]} ·{" "}
          {formatDateTime(checkInDetail.created_at)}
        </p>
      </div>
      <CheckInStatusBadge status={checkInDetail.status} />
    </div>
  );
}

function SubmissionDetails({
  checkInDetail,
  className,
}: {
  checkInDetail: CheckInDetail;
  className?: string;
}) {
  const structured = parseStructuredNotes(checkInDetail.notes ?? null);

  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      {checkInDetail.tallyAnswers.length > 0 ? (
        <TallyAnswerList answers={checkInDetail.tallyAnswers} />
      ) : (
        <>
          {structured.difficulty ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Como correu / dificuldades
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {structured.difficulty}
              </p>
            </div>
          ) : null}
          {structured.confidence ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Como se sente neste nível
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {structured.confidence}
              </p>
            </div>
          ) : null}
          {!structured.difficulty && !structured.confidence ? (
            <p className="text-sm text-muted-foreground">Sem respostas.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

function SubmissionSectionWithFeedback({
  pathId,
  nodeId,
  studentName,
  nodeCheckIns,
  checkInDetail,
  selectedCheckInId,
  feedbackPanelProps,
}: {
  pathId: string;
  nodeId: string;
  studentName: string;
  nodeCheckIns: JourneyCheckIn[];
  checkInDetail: CheckInDetail;
  selectedCheckInId: string | null;
  feedbackPanelProps: MentorFeedbackPanelProps;
}) {
  const [isPortraitVideo, setIsPortraitVideo] = useState(false);
  const handlePortraitChange = useCallback((isPortrait: boolean) => {
    setIsPortraitVideo((prev) => (prev === isPortrait ? prev : isPortrait));
  }, []);

  const videoUrl =
    checkInDetail.video_url ?? checkInDetail.tallyVideoUrl ?? null;
  const portraitDesktop = Boolean(videoUrl && isPortraitVideo);

  useEffect(() => {
    setIsPortraitVideo(false);
  }, [videoUrl]);

  return (
    <MentorFeedbackProvider {...feedbackPanelProps}>
      <section className="space-y-4">
        {nodeCheckIns.length > 1 ? (
          <ul className="flex flex-wrap gap-2">
            {nodeCheckIns.map((c) => (
              <li key={c.id}>
                <Link
                  href={mentorLevelReviewHref(pathId, nodeId, {
                    checkin: c.id,
                  })}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                    selectedCheckInId === c.id
                      ? "border-white/20 bg-white/10"
                      : "border-white/10 bg-black/20 hover:bg-white/5",
                  )}
                >
                  <span>
                    {checkInKindLabel[c.kind]} · {formatDateTime(c.created_at)}
                  </span>
                  <CheckInStatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Mobile: separate submission card + feedback card */}
        <div className="space-y-4 desktop:hidden">
          <Card className="space-y-5 p-6">
            <SubmissionHeader checkInDetail={checkInDetail} />
            <div className="space-y-5">
              {videoUrl ? (
                <SubmissionVideo
                  url={videoUrl}
                  title={`Check-in · ${studentName}`}
                />
              ) : null}
              <SubmissionDetails checkInDetail={checkInDetail} />
            </div>
          </Card>
          <MentorFeedbackStacked />
        </div>

        {/* Desktop: single card — layout classes swap without remounting the video */}
        <div
          className={cn(
            "hidden desktop:block",
            portraitDesktop ? "space-y-4" : "space-y-6",
          )}
        >
          <div
            className={cn(
              "glass overflow-hidden rounded-2xl p-6",
              portraitDesktop &&
                "grid grid-cols-[280px_minmax(0,1fr)] items-start gap-x-5 gap-y-3",
            )}
          >
            <SubmissionHeader checkInDetail={checkInDetail} />
            {videoUrl ? (
              <SubmissionVideo
                url={videoUrl}
                title={`Check-in · ${studentName}`}
                onPortraitChange={handlePortraitChange}
                className={portraitDesktop ? "row-span-2" : undefined}
              />
            ) : null}
            <SubmissionDetails
              checkInDetail={checkInDetail}
              className={
                portraitDesktop ? "col-start-2 row-start-2" : undefined
              }
            />
            {portraitDesktop ? (
              <div className="col-start-2 row-start-3 border-t border-white/10 pt-3">
                <MentorFeedbackFields />
              </div>
            ) : (
              <div className="border-t border-white/10 pt-6">
                <MentorFeedbackStacked embedded />
              </div>
            )}
          </div>
          {portraitDesktop ? (
            <MentorFeedbackPortraitActions className="w-full" />
          ) : null}
        </div>
      </section>
    </MentorFeedbackProvider>
  );
}

function SubmissionSection({
  pathId,
  nodeId,
  studentName,
  nodeCheckIns,
  checkInDetail,
  selectedCheckInId,
  feedbackPanelProps,
}: {
  pathId: string;
  nodeId: string;
  studentName: string;
  nodeCheckIns: JourneyCheckIn[];
  checkInDetail: CheckInDetail | null;
  selectedCheckInId: string | null;
  feedbackPanelProps?: MentorFeedbackPanelProps;
}) {
  if (nodeCheckIns.length === 0) {
    return (
      <Card className="space-y-2 border-dashed p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Submissão do aluno
        </h2>
        <p className="text-sm text-muted-foreground">
          Ainda sem check-ins neste nível. Podes dar feedback e decidir o
          próximo passo na secção abaixo.
        </p>
      </Card>
    );
  }

  if (checkInDetail && feedbackPanelProps) {
    return (
      <SubmissionSectionWithFeedback
        pathId={pathId}
        nodeId={nodeId}
        studentName={studentName}
        nodeCheckIns={nodeCheckIns}
        checkInDetail={checkInDetail}
        selectedCheckInId={selectedCheckInId}
        feedbackPanelProps={feedbackPanelProps}
      />
    );
  }

  if (!checkInDetail) {
    return null;
  }

  return (
    <section className="space-y-4">
      {nodeCheckIns.length > 1 ? (
        <ul className="flex flex-wrap gap-2">
          {nodeCheckIns.map((c) => (
            <li key={c.id}>
              <Link
                href={mentorLevelReviewHref(pathId, nodeId, {
                  checkin: c.id,
                })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                  selectedCheckInId === c.id
                    ? "border-white/20 bg-white/10"
                    : "border-white/10 bg-black/20 hover:bg-white/5",
                )}
              >
                <span>
                  {checkInKindLabel[c.kind]} · {formatDateTime(c.created_at)}
                </span>
                <CheckInStatusBadge status={c.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <Card className="space-y-5 p-6">
        <SubmissionHeader checkInDetail={checkInDetail} />
        <div className="space-y-5">
          {checkInDetail.video_url ?? checkInDetail.tallyVideoUrl ? (
            <SubmissionVideo
              url={
                checkInDetail.video_url ?? checkInDetail.tallyVideoUrl ?? ""
              }
              title={`Check-in · ${studentName}`}
            />
          ) : null}
          <SubmissionDetails checkInDetail={checkInDetail} />
        </div>
      </Card>
    </section>
  );
}

export function MentorLevelReviewView({
  pathId,
  pathTitle,
  studentName,
  studentId,
  node,
  levelNumber,
  nodeCheckIns,
  checkInDetail,
  selectedCheckInId,
  activeTab,
}: {
  pathId: string;
  pathTitle: string;
  studentName: string;
  studentId: string | null;
  node: StudentNode;
  levelNumber: number;
  nodeCheckIns: JourneyCheckIn[];
  checkInDetail: CheckInDetail | null;
  selectedCheckInId: string | null;
  activeTab: MentorLevelTab;
}) {
  const returnTo = mentorLevelReviewHref(pathId, node.id, {
    checkin: selectedCheckInId ?? undefined,
    tab: activeTab,
  });

  const feedbackPanelProps: MentorFeedbackPanelProps = {
    checkInId: selectedCheckInId,
    pathId,
    nodeId: node.id,
    node,
    studentName,
    existing: checkInDetail?.feedback,
    draft: checkInDetail?.draft,
    returnTo,
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/studio/journeys/${pathId}`}
            className="hover:text-foreground"
          >
            {pathTitle}
          </Link>
          {studentId ? (
            <>
              {" · "}
              <Link
                href={studentProfileHref(studentId, returnTo)}
                className="hover:text-foreground"
              >
                {studentName}
              </Link>
            </>
          ) : (
            <> · {studentName}</>
          )}
        </p>
      </header>

      <MentorLevelTabs
        pathId={pathId}
        nodeId={node.id}
        activeTab={activeTab}
        checkin={selectedCheckInId}
      />

      {activeTab === "nivel" ? (
        <div className="w-full space-y-5 py-2 desktop:space-y-6 desktop:py-0">
          <div className="flex justify-end">
            <Link
              href={`/studio/journeys/${pathId}/edit`}
              aria-label="Editar percurso"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm transition-colors hover:bg-white/10"
            >
              <Pencil className="size-3.5" />
              Editar
            </Link>
          </div>
          <StudentNodePlayer
            node={node}
            levelNumber={levelNumber}
            preview
          />
        </div>
      ) : (
        <>
          <SubmissionSection
            pathId={pathId}
            nodeId={node.id}
            studentName={studentName}
            nodeCheckIns={nodeCheckIns}
            checkInDetail={checkInDetail}
            selectedCheckInId={selectedCheckInId}
            feedbackPanelProps={checkInDetail ? feedbackPanelProps : undefined}
          />

          {!checkInDetail ? (
            <MentorFeedbackPanel {...feedbackPanelProps} />
          ) : null}
        </>
      )}
    </div>
  );
}
