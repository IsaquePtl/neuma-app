"use client";

import { useEffect, useRef, useState } from "react";
import {
  FeedbackContentCard,
  FeedbackNextStepsCard,
  FeedbackNotesCard,
  MentorFeedbackCardHeader,
} from "@/components/student-feedback-sections";
import { FeedbackContinueAction } from "@/components/feedback-continue-action";
import { StudentActivityToggleCard } from "@/components/student-activity-toggle-card";
import { StudentFeedbackCardBody } from "@/components/student-feedback-card-body";
import { CheckInStatusBadge, FeedbackDecisionBlock } from "@/components/status-badges";
import { TallyAnswerList } from "@/components/tally-answers";
import type {
  StudentNodeActivity,
  StudentNodeCheckIn,
  StudentNodeLevelFeedback,
} from "@/lib/feedbacks/student-shared";
import {
  hasVisibleCheckInFeedback,
  resolveNextLevel,
  type NextLevelNode,
} from "@/lib/feedbacks/student-shared";
import { checkInKindLabel, formatDateTime } from "@/lib/labels";

function CheckInExpandedContent({ checkIn }: { checkIn: StudentNodeCheckIn }) {
  const hasTextContent =
    checkIn.tallyAnswers.length > 0 || checkIn.notes || !checkIn.submissionVideoUrl;

  return (
    <StudentFeedbackCardBody
      videoUrl={checkIn.submissionVideoUrl}
      videoTitle={`Check-in · ${checkInKindLabel[checkIn.kind]}`}
    >
      {hasTextContent ? (
        checkIn.tallyAnswers.length > 0 ? (
          <FeedbackContentCard label="Respostas">
            <TallyAnswerList answers={checkIn.tallyAnswers} compact />
          </FeedbackContentCard>
        ) : checkIn.notes ? (
          <FeedbackContentCard label="Check-in">
            <p className="whitespace-pre-wrap">{checkIn.notes}</p>
          </FeedbackContentCard>
        ) : (
          <FeedbackContentCard label="Check-in">
            <p className="text-muted-foreground">Sem conteúdo guardado.</p>
          </FeedbackContentCard>
        )
      ) : null}
    </StudentFeedbackCardBody>
  );
}

function LevelFeedbackExpandedContent({
  feedback,
  nodeId,
}: {
  feedback: StudentNodeLevelFeedback;
  nodeId?: string;
}) {
  const hasContent = Boolean(feedback.notes || feedback.file_url);
  const continueHref = nodeId ? `/path/${nodeId}` : "/path";

  return (
    <>
      <MentorFeedbackCardHeader
        subtitle={`Feedback do nível · ${formatDateTime(feedback.created_at)}`}
      />
      <StudentFeedbackCardBody videoUrl={feedback.video_url}>
        {hasContent ? (
          <>
            {feedback.notes ? <FeedbackNotesCard notes={feedback.notes} /> : null}
            {feedback.file_url ? (
              <a
                href={feedback.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm text-muted-foreground hover:text-foreground"
              >
                Abrir ficheiro
              </a>
            ) : null}
          </>
        ) : null}
      </StudentFeedbackCardBody>
      <div className="mt-4 min-w-0 border-t border-white/10 pt-4">
        <FeedbackContinueAction
          href={continueHref}
          nodeId={nodeId}
          feedbackRefs={[{ kind: "level", referenceId: feedback.id }]}
        />
      </div>
    </>
  );
}

function CheckInFeedbackExpandedContent({
  checkIn,
  pathNodes,
  currentNodeId,
}: {
  checkIn: StudentNodeCheckIn;
  pathNodes?: NextLevelNode[];
  currentNodeId?: string;
}) {
  const feedback = checkIn.feedback;
  if (!feedback) return null;

  const nextLevel =
    checkIn.status === "approved" && pathNodes && currentNodeId
      ? resolveNextLevel(pathNodes, currentNodeId)
      : null;

  return (
    <>
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
            nodeId={currentNodeId}
            feedbackRefs={[{ kind: "check_in", referenceId: checkIn.id }]}
          />
        }
      >
        {feedback.notes ? <FeedbackNotesCard notes={feedback.notes} /> : null}
      </StudentFeedbackCardBody>
    </>
  );
}

type ActivityFocus = "checkin" | "feedback" | null;

function CheckInActivityPair({
  checkIn,
  pathNodes,
  currentNodeId,
  focusCheckInId,
  initialFocus,
}: {
  checkIn: StudentNodeCheckIn;
  pathNodes?: NextLevelNode[];
  currentNodeId?: string;
  focusCheckInId?: string | null;
  initialFocus?: ActivityFocus;
}) {
  const hasFeedback = hasVisibleCheckInFeedback(checkIn.feedback);
  const hasUnviewedFeedback = hasFeedback && !checkIn.viewed;
  const isFocusedCheckIn = focusCheckInId === checkIn.id;
  const focusCheckIn = isFocusedCheckIn && initialFocus === "checkin";
  const focusFeedback = isFocusedCheckIn && initialFocus === "feedback";
  const [checkInOpen, setCheckInOpen] = useState(focusCheckIn);
  const [feedbackOpen, setFeedbackOpen] = useState(
    focusCheckIn ? false : focusFeedback || hasUnviewedFeedback,
  );
  const checkInRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusCheckIn && !focusFeedback) return;

    const frame = requestAnimationFrame(() => {
      const target = focusFeedback ? feedbackRef.current : checkInRef.current;
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    return () => cancelAnimationFrame(frame);
  }, [focusCheckIn, focusFeedback]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div ref={checkInRef} className="min-w-0">
        <StudentActivityToggleCard
          title="Check-in"
          subtitle={`${checkInKindLabel[checkIn.kind]} · ${formatDateTime(checkIn.created_at)}`}
          badge={<CheckInStatusBadge status={checkIn.status} />}
          expanded={checkInOpen}
          onToggle={() => setCheckInOpen((open) => !open)}
        >
          <CheckInExpandedContent checkIn={checkIn} />
        </StudentActivityToggleCard>
      </div>

      <div ref={feedbackRef} className="min-w-0">
        <StudentActivityToggleCard
          title="Feedback"
          subtitle={
            hasFeedback
              ? formatDateTime(checkIn.created_at)
              : "A aguardar feedback do mentor"
          }
          expanded={feedbackOpen}
          onToggle={() => hasFeedback && setFeedbackOpen((open) => !open)}
          disabled={!hasFeedback}
        >
          {hasFeedback ? (
            <CheckInFeedbackExpandedContent
              checkIn={checkIn}
              pathNodes={pathNodes}
              currentNodeId={currentNodeId}
            />
          ) : null}
        </StudentActivityToggleCard>
      </div>
    </div>
  );
}

function LevelFeedbackToggle({
  feedback,
  currentNodeId,
  focusLevelFeedbackId,
  initialFocus,
}: {
  feedback: StudentNodeLevelFeedback;
  currentNodeId?: string;
  focusLevelFeedbackId?: string | null;
  initialFocus?: ActivityFocus;
}) {
  const isFocused =
    focusLevelFeedbackId === feedback.id && initialFocus === "feedback";
  const [expanded, setExpanded] = useState(isFocused || !feedback.viewed);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFocused) return;

    const frame = requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    return () => cancelAnimationFrame(frame);
  }, [isFocused]);

  return (
    <div ref={feedbackRef} className="min-w-0">
      <StudentActivityToggleCard
        title="Feedback"
        subtitle={`Feedback do nível · ${formatDateTime(feedback.created_at)}`}
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
      >
        <LevelFeedbackExpandedContent
          feedback={feedback}
          nodeId={currentNodeId}
        />
      </StudentActivityToggleCard>
    </div>
  );
}

export function StudentLevelActivity({
  activity,
  pathNodes,
  currentNodeId,
  focusCheckInId = null,
  focusLevelFeedbackId = null,
  initialFocus = null,
}: {
  activity: StudentNodeActivity;
  pathNodes?: NextLevelNode[];
  currentNodeId?: string;
  focusCheckInId?: string | null;
  focusLevelFeedbackId?: string | null;
  initialFocus?: ActivityFocus;
}) {
  const hasCheckIns = activity.checkIns.length > 0;
  const hasLevelFeedback = activity.levelFeedbacks.length > 0;

  if (!hasCheckIns && !hasLevelFeedback) return null;

  return (
    <section className="min-w-0 w-full max-w-full space-y-4 border-t border-white/10 pt-5">
      {hasCheckIns ? (
        <div className="min-w-0 space-y-3">
          {activity.checkIns.map((checkIn) => (
            <CheckInActivityPair
              key={checkIn.id}
              checkIn={checkIn}
              pathNodes={pathNodes}
              currentNodeId={currentNodeId}
              focusCheckInId={focusCheckInId}
              initialFocus={initialFocus}
            />
          ))}
        </div>
      ) : null}

      {hasLevelFeedback ? (
        <div className="min-w-0 space-y-3">
          {activity.levelFeedbacks.map((feedback) => (
            <LevelFeedbackToggle
              key={feedback.id}
              feedback={feedback}
              currentNodeId={currentNodeId}
              focusLevelFeedbackId={focusLevelFeedbackId}
              initialFocus={initialFocus}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
