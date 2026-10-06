import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  checkInBlockedMessage,
  getCheckInAllowance,
} from "@/lib/checkins/allowance";
import { loadStudentNodeActivity } from "@/lib/feedbacks/student";
import {
  loadMyPathWithNodes,
  loadMentorCalUsername,
  loadMyUpcomingBooking,
} from "@/lib/students/queries";
import { StudentNodePlayer } from "@/components/student-node-player";
import { StudentLevelActivity } from "@/components/student-level-activity";
import { PhaseReviewBanner } from "@/components/phase-review-checklist";
import { RecordNodeVisit } from "@/components/record-node-visit";
import {
  loadActivePhaseReview,
  loadPhaseReview,
} from "@/lib/nodes/phase-review";

export default async function StudentNodePage({
  params,
  searchParams,
}: {
  params: Promise<{ nodeId: string }>;
  searchParams: Promise<{ focus?: string; checkIn?: string; feedback?: string }>;
}) {
  const { nodeId } = await params;
  const {
    focus,
    checkIn: focusCheckInId,
    feedback: focusLevelFeedbackId,
  } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { path, nodes },
    mentor,
    upcomingBooking,
    { data: me },
    allowance,
    activity,
  ] = await Promise.all([
    loadMyPathWithNodes(user!.id),
    loadMentorCalUsername(),
    loadMyUpcomingBooking(user!.id),
    supabase
      .from("profiles")
      .select("can_book_sessions")
      .eq("id", user!.id)
      .maybeSingle(),
    getCheckInAllowance(supabase, nodeId, user!.id),
    loadStudentNodeActivity(supabase, user!.id, nodeId),
  ]);

  const canBookSessions = me?.can_book_sessions !== false;

  if (!path) redirect("/path");

  if (path.status === "paused") redirect("/path");

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) notFound();

  const activeIndex = nodes.findIndex((n) => n.status === "active");
  const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
  const isPast =
    node.status === "completed" ||
    (activeIndex >= 0 && nodeIndex >= 0 && nodeIndex < activeIndex);
  const isActive = node.status === "active";

  // Só futuros (depois do activo) ficam inacessíveis
  if (!isActive && !isPast) {
    redirect("/path");
  }

  const [phaseCheckpoint, activeReview] = await Promise.all([
    node.is_phase_checkpoint
      ? loadPhaseReview(supabase, user!.id, nodes, nodeId)
      : Promise.resolve(null),
    loadActivePhaseReview(supabase, user!.id, nodes),
  ]);
  const reviewingThisLevel =
    activeReview?.items.some((i) => i.id === nodeId) ? activeReview : null;

  return (
    <div
      className={
        "neuma-mobile-viewport neuma-mobile-scroll-fade relative flex w-full min-w-0 flex-col [justify-content:safe_center] overflow-y-auto pb-0 " +
        "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4"
      }
    >
      <div className="w-full min-w-0 max-w-full shrink-0 space-y-5 desktop:space-y-6">
        {reviewingThisLevel ? (
          <>
            <RecordNodeVisit nodeId={nodeId} />
            <PhaseReviewBanner review={reviewingThisLevel} currentNodeId={nodeId} />
          </>
        ) : null}
        <StudentNodePlayer
          phaseCheckpoint={phaseCheckpoint}
          node={node}
          levelNumber={nodeIndex + 1}
          mentorName={mentor?.full_name}
          calUsername={mentor?.cal_username}
          upcomingBooking={node.kind === "call" ? upcomingBooking : null}
          canBookSessions={canBookSessions}
          canSubmitCheckIn={allowance.allowed}
          checkInBlockedMessage={
            !allowance.allowed ? checkInBlockedMessage(allowance) : null
          }
        />
        <StudentLevelActivity
          activity={activity}
          pathNodes={nodes}
          currentNodeId={nodeId}
          focusCheckInId={focusCheckInId ?? null}
          focusLevelFeedbackId={focusLevelFeedbackId ?? null}
          initialFocus={
            focus === "checkin"
              ? "checkin"
              : focus === "feedback"
                ? "feedback"
                : null
          }
        />
      </div>
      <div
        aria-hidden
        className="h-[calc(5.5rem+env(safe-area-inset-bottom,0px))] shrink-0 desktop:hidden"
      />
    </div>
  );
}
