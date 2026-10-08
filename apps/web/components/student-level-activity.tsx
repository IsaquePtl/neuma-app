"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  MessageSquare,
  MessageSquareText,
  Phone,
  Video,
} from "lucide-react";

import {
  FeedbackContentCard,
  FeedbackNextStepsCard,
  FeedbackNotesCard,
} from "@/components/student-feedback-sections";
import { FeedbackContinueAction } from "@/components/feedback-continue-action";
import { StudentFeedbackCardBody } from "@/components/student-feedback-card-body";
import { CheckInStatusBadge, FeedbackDecisionBlock } from "@/components/status-badges";
import { TallyAnswerList } from "@/components/tally-answers";
import { markStudentFeedbackViewedAction } from "@/lib/actions/student-feedback-views";
import type {
  StudentFeedbackViewRef,
  StudentNodeActivity,
  StudentNodeCheckIn,
  StudentNodeLevelFeedback,
} from "@/lib/feedbacks/student-shared";
import {
  hasVisibleCheckInFeedback,
  resolveNextLevel,
  type NextLevelNode,
} from "@/lib/feedbacks/student-shared";
import { requestStudentBadgesRefresh } from "@/lib/student-badges-client";
import { checkInKindLabel, formatDateTime } from "@/lib/labels";
import type { CheckInKind } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

function checkInPreview(checkIn: StudentNodeCheckIn) {
  const notes = checkIn.notes
    ?.replace(/^Como correu \/ dificuldades:\n/, "")
    .trim();
  if (notes) return notes;
  if (checkIn.tallyAnswers.length > 0) return "Respostas ao formulário";
  if (checkIn.submissionVideoUrl) return "Check-in com vídeo";
  return "Check-in enviado";
}

function KindIcon({ kind }: { kind: CheckInKind }) {
  const Icon = kind === "call" ? Phone : kind === "text" ? FileText : Video;
  return <Icon className="size-3" aria-hidden />;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

function FeedbackMark({
  mentorName,
  unviewed = false,
}: {
  mentorName: string;
  unviewed?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
      <span className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-[var(--neuma-coral)]/35 via-[var(--neuma-lavender)]/20 to-[var(--neuma-blue)]/30 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-[var(--neuma-coral)]/40">
        <MessageSquareText className="size-3.5" aria-hidden />
        <span>Feedback do {mentorName}</span>
      </span>
      {unviewed ? <NewPill /> : null}
    </span>
  );
}

function NewPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--neuma-coral)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
      <span className="size-1.5 rounded-full bg-white" aria-hidden />
      Novo
    </span>
  );
}

function ApprovedPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
      <CheckCircle2 className="size-3.5" aria-hidden />
      Aprovado
    </span>
  );
}

function CheckInSubmission({ checkIn }: { checkIn: StudentNodeCheckIn }) {
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
          <FeedbackContentCard label="O que escreveste">
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

function CheckInFeedback({
  checkIn,
  mentorName,
  pathNodes,
  currentNodeId,
}: {
  checkIn: StudentNodeCheckIn;
  mentorName: string;
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
      <div className="flex min-w-0 flex-col gap-3">
        <FeedbackMark mentorName={mentorName} />
        {feedback.notes ? <FeedbackNotesCard notes={feedback.notes} /> : null}
      </div>
    </StudentFeedbackCardBody>
  );
}

function AwaitingFeedback({ mentorName }: { mentorName: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-4">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06]">
        <Clock className="size-5 text-muted-foreground" aria-hidden />
        <span className="absolute right-1.5 top-1.5 size-2 animate-pulse rounded-full bg-[var(--neuma-orange)]" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">À espera do feedback do {mentorName}</p>
        <p className="text-sm text-muted-foreground">
          Assim que ele responder, o feedback aparece aqui e recebes um aviso.
        </p>
      </div>
    </div>
  );
}

function RoundCard({
  id,
  eyebrow,
  title,
  meta,
  preview,
  feedbackLine,
  cornerNotice = false,
  badge,
  highlight,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  eyebrow: ReactNode;
  title: string;
  meta: string;
  preview?: string | null;
  feedbackLine: ReactNode;
  /** Unread feedback: a dot in the card corner, instead of a feedback label. */
  cornerNotice?: boolean;
  badge?: ReactNode;
  highlight: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = `round-${id}`;

  return (
    <article
      className={cn(
        "student-path-step relative min-w-0 !p-0",
        highlight || expanded
          ? "student-path-step--active"
          : "student-path-step--done",
        expanded && "ring-1 ring-white/12",
      )}
    >
      {cornerNotice ? (
        <span
          className="pointer-events-none absolute top-3.5 right-3.5 z-10 size-2.5 rounded-full bg-[var(--neuma-coral)] shadow-[0_0_0_4px_color-mix(in_oklch,var(--neuma-coral)_32%,transparent)]"
          aria-hidden
        />
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className={cn(
          "group flex w-full min-w-0 items-start justify-between gap-2 p-4 text-left sm:gap-3 sm:p-5",
          cornerNotice && "pr-8 sm:pr-9",
          "rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--neuma-coral)]/50",
        )}
      >
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
            {eyebrow}
          </span>
          <span className="block break-words font-heading text-lg font-bold tracking-tight sm:text-xl">
            {title}
          </span>
          <span className="block text-sm text-muted-foreground">{meta}</span>
          {!expanded && preview ? (
            <span className="line-clamp-2 block text-sm leading-relaxed text-muted-foreground/90">
              {preview}
            </span>
          ) : null}
          {feedbackLine ? <span className="block">{feedbackLine}</span> : null}
          {cornerNotice ? <span className="sr-only">Novo feedback</span> : null}
        </span>
        <span className="flex shrink-0 flex-row items-center gap-2 self-start">
          {badge}
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>
      {expanded ? (
        <div
          id={bodyId}
          className="min-w-0 space-y-5 border-t border-white/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5"
        >
          {children}
        </div>
      ) : null}
    </article>
  );
}

type RoundItem =
  | { type: "check_in"; key: string; checkIn: StudentNodeCheckIn; round: number }
  | { type: "level"; key: string; feedback: StudentNodeLevelFeedback };

function itemHasUnviewed(item: RoundItem) {
  if (item.type === "level") return !item.feedback.viewed;
  return hasVisibleCheckInFeedback(item.checkIn.feedback) && !item.checkIn.viewed;
}

function itemViewRef(item: RoundItem): StudentFeedbackViewRef {
  return item.type === "level"
    ? { kind: "level", referenceId: item.feedback.id }
    : { kind: "check_in", referenceId: item.checkIn.id };
}

function buildItems(activity: StudentNodeActivity): RoundItem[] {
  const total = activity.checkIns.length;
  const items: (RoundItem & { at: string })[] = [
    ...activity.checkIns.map((checkIn, index) => ({
      type: "check_in" as const,
      key: `c:${checkIn.id}`,
      checkIn,
      round: total - index,
      at: checkIn.created_at,
    })),
    ...activity.levelFeedbacks.map((feedback) => ({
      type: "level" as const,
      key: `l:${feedback.id}`,
      feedback,
      at: feedback.created_at,
    })),
  ];
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items;
}

function initialOpenKey(
  items: RoundItem[],
  focusCheckInId: string | null,
  focusLevelFeedbackId: string | null,
) {
  if (focusCheckInId) return `c:${focusCheckInId}`;
  if (focusLevelFeedbackId) return `l:${focusLevelFeedbackId}`;
  return (items.find(itemHasUnviewed) ?? items[0])?.key ?? null;
}

export function StudentLevelCheckIns({
  activity,
  mentorName,
  pathNodes,
  currentNodeId,
  focusCheckInId = null,
  focusLevelFeedbackId = null,
}: {
  activity: StudentNodeActivity;
  mentorName: string;
  pathNodes?: NextLevelNode[];
  currentNodeId?: string;
  focusCheckInId?: string | null;
  focusLevelFeedbackId?: string | null;
}) {
  const items = useMemo(() => buildItems(activity), [activity]);
  const totalRounds = activity.checkIns.length;
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const key = initialOpenKey(items, focusCheckInId, focusLevelFeedbackId);
    return new Set(key ? [key] : []);
  });
  const markedRef = useRef<Set<string>>(new Set());
  const focusRef = useRef<HTMLDivElement>(null);
  const focusKey =
    focusCheckInId || focusLevelFeedbackId
      ? initialOpenKey(items, focusCheckInId, focusLevelFeedbackId)
      : null;

  useEffect(() => {
    if (!focusKey) return;
    const frame = requestAnimationFrame(() => {
      focusRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusKey]);

  // Opening a round counts as reading its feedback (clears the badges).
  useEffect(() => {
    const refs = items
      .filter(
        (item) =>
          openKeys.has(item.key) &&
          itemHasUnviewed(item) &&
          !markedRef.current.has(item.key),
      )
      .map((item) => {
        markedRef.current.add(item.key);
        return itemViewRef(item);
      });
    if (refs.length === 0) return;
    void markStudentFeedbackViewedAction(refs)
      .then(() => requestStudentBadgesRefresh())
      .catch(() => {});
  }, [items, openKeys]);

  if (items.length === 0) return null;

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="min-w-0 space-y-3">
      {items.map((item, index) => {
        const expanded = openKeys.has(item.key);
        const unviewed = itemHasUnviewed(item);
        const wrapperProps =
          item.key === focusKey ? { ref: focusRef } : {};

        if (item.type === "level") {
          const { feedback } = item;
          return (
            <div key={item.key} {...wrapperProps} className="min-w-0 scroll-mt-24">
              <RoundCard
                id={item.key}
                eyebrow={
                  <>
                    <MessageSquare className="size-3" aria-hidden />
                    Feedback do nível
                  </>
                }
                title={`Feedback do ${mentorName}`}
                meta={formatDateTime(feedback.created_at)}
                preview={feedback.notes}
                feedbackLine={unviewed ? <NewPill /> : null}
                highlight={unviewed || index === 0}
                expanded={expanded}
                onToggle={() => toggle(item.key)}
              >
                <StudentFeedbackCardBody videoUrl={feedback.video_url}>
                  {feedback.notes || feedback.file_url ? (
                    <>
                      {feedback.notes ? (
                        <FeedbackNotesCard notes={feedback.notes} />
                      ) : null}
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
                <div className="min-w-0 border-t border-white/10 pt-4">
                  <FeedbackContinueAction
                    href={currentNodeId ? `/path/${currentNodeId}` : "/path"}
                    nodeId={currentNodeId}
                    feedbackRefs={[{ kind: "level", referenceId: feedback.id }]}
                  />
                </div>
              </RoundCard>
            </div>
          );
        }

        const { checkIn, round } = item;
        const hasFeedback = hasVisibleCheckInFeedback(checkIn.feedback);

        return (
          <div key={item.key} {...wrapperProps} className="min-w-0 scroll-mt-24">
            <RoundCard
              id={item.key}
              eyebrow={
                <>
                  <KindIcon kind={checkIn.kind} />
                  {checkInKindLabel[checkIn.kind]}
                  {totalRounds > 1 ? ` · Ronda ${round} de ${totalRounds}` : null}
                </>
              }
              title={totalRounds > 1 ? `Check-in ${round}` : "Check-in"}
              meta={formatDateTime(checkIn.created_at)}
              preview={checkInPreview(checkIn)}
              cornerNotice={hasFeedback && unviewed}
              feedbackLine={
                hasFeedback ? null : (
                  <span className="text-sm text-muted-foreground/80">
                    A aguardar feedback
                  </span>
                )
              }
              badge={
                checkIn.status === "approved" ? (
                  <ApprovedPill />
                ) : (
                  <CheckInStatusBadge status={checkIn.status} />
                )
              }
              highlight={unviewed || index === 0}
              expanded={expanded}
              onToggle={() => toggle(item.key)}
            >
              <section className="min-w-0 space-y-3">
                <SectionLabel>O teu check-in</SectionLabel>
                <CheckInSubmission checkIn={checkIn} />
              </section>
              <section className="min-w-0 space-y-3 border-t border-white/10 pt-5">
                {hasFeedback ? (
                  <CheckInFeedback
                    checkIn={checkIn}
                    mentorName={mentorName}
                    pathNodes={pathNodes}
                    currentNodeId={currentNodeId}
                  />
                ) : (
                  <AwaitingFeedback mentorName={mentorName} />
                )}
              </section>
            </RoundCard>
          </div>
        );
      })}
    </div>
  );
}
