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

  // Mobile: center in menubar-aware viewport (pt-8 = slight lower bias);
  // my-auto collapses when overflowing so scroll still reaches the top.
  // Desktop: top-aligned flow.
  return (
    <div
      className={
        "neuma-mobile-viewport flex w-full min-w-0 flex-col overflow-y-auto overscroll-contain pb-5 " +
        "desktop:h-auto desktop:min-h-0 desktop:overflow-visible desktop:pb-4"
      }
    >
      <div className="my-auto w-full min-w-0 max-w-full space-y-5 pt-8 pb-2 desktop:my-0 desktop:space-y-6 desktop:py-0">
        <StudentNodePlayer
          node={node}
          levelNumber={nodeIndex + 1}
          mentorName={mentor?.full_name}
          calUsername={mentor?.cal_username}
          upcomingBooking={node.kind === "call" ? upcomingBooking : null}
          canBookSessions={canBookSessions}
          canSubmitCheckIn={allowance.allowed}
          checkInBlockedMessage={
            allowance.allowed ? null : checkInBlockedMessage(allowance)
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
    </div>
  );
}
