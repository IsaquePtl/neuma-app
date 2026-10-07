import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCheckInAllowance } from "@/lib/checkins/allowance";
import {
  loadStudentNodeActivity,
  summarizeLevelCheckIns,
  type LevelCheckInState,
} from "@/lib/feedbacks/student";
import { firstNameFromFullName } from "@/lib/profile/greeting";
import { nodeRequiresCheckIn } from "@/lib/nodes/pass-rule";
import { loadMentorCalUsername, loadMyPathWithNodes } from "@/lib/students/queries";
import {
  CheckInActions,
  NodeLevelHeader,
} from "@/components/student-node-player";
import { StudentLevelCheckIns } from "@/components/student-level-activity";

function stateHint(state: LevelCheckInState, mentorName: string) {
  switch (state) {
    case "todo":
      return `Quando terminares o nível, envia o teu check-in. O feedback do ${mentorName} aparece aqui, junto ao check-in.`;
    case "revision":
      return `O ${mentorName} pediu uma revisão. Revê o feedback abaixo e envia um novo check-in quando estiveres pronto.`;
    case "extended":
      return `O ${mentorName} prolongou o prazo deste nível. Podes enviar um novo check-in.`;
    default:
      return null;
  }
}

export default async function LevelCheckInsPage({
  params,
  searchParams,
}: {
  params: Promise<{ nodeId: string }>;
  searchParams: Promise<{ checkIn?: string; feedback?: string }>;
}) {
  const { nodeId } = await params;
  const { checkIn: focusCheckInId, feedback: focusLevelFeedbackId } =
    await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ path, nodes }, mentor, allowance, activity] = await Promise.all([
    loadMyPathWithNodes(user.id),
    loadMentorCalUsername(),
    getCheckInAllowance(supabase, nodeId, user.id),
    loadStudentNodeActivity(supabase, user.id, nodeId),
  ]);

  if (!path || path.status === "paused") redirect("/path");

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) notFound();

  const activeIndex = nodes.findIndex((n) => n.status === "active");
  const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
  const isPast =
    node.status === "completed" ||
    (activeIndex >= 0 && nodeIndex >= 0 && nodeIndex < activeIndex);
  if (node.status !== "active" && !isPast) redirect("/path");

  const completed = node.status === "completed";
  const summary = summarizeLevelCheckIns(activity, {
    requiresCheckIn: nodeRequiresCheckIn(node.pass_rule),
    completed,
    canSubmit: allowance.allowed,
  });
  if (!summary) redirect(`/path/${nodeId}`);

  const mentorName = firstNameFromFullName(mentor?.full_name) ?? "mentor";
  const hint = stateHint(summary.state, mentorName);
  const hasItems =
    activity.checkIns.length > 0 || activity.levelFeedbacks.length > 0;

  return (
    <div
      className={
        "neuma-mobile-viewport neuma-mobile-scroll-fade relative flex w-full min-w-0 flex-col [justify-content:safe_center] overflow-y-auto pb-0 " +
        "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4"
      }
    >
      <div className="w-full min-w-0 max-w-full shrink-0 space-y-6">
        <NodeLevelHeader
          node={node}
          levelNumber={nodeIndex + 1}
          section="Check-in"
        />

        <section className="min-w-0 space-y-4">
          {summary.actionNeeded ? (
            <div className="min-w-0 space-y-3 rounded-2xl border border-[var(--neuma-coral)]/30 bg-[var(--neuma-coral)]/[0.07] p-4 sm:p-5">
              {hint ? (
                <p className="text-sm leading-relaxed text-foreground/90">{hint}</p>
              ) : null}
              <CheckInActions node={node} canSubmitCheckIn />
            </div>
          ) : null}

          {hasItems ? (
            <StudentLevelCheckIns
              activity={activity}
              mentorName={mentorName}
              pathNodes={nodes}
              currentNodeId={nodeId}
              focusCheckInId={focusCheckInId ?? null}
              focusLevelFeedbackId={focusLevelFeedbackId ?? null}
            />
          ) : !summary.actionNeeded ? (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">
              Ainda sem check-ins neste nível.
            </p>
          ) : null}
        </section>
      </div>
      <div
        aria-hidden
        className="h-[calc(5.5rem+env(safe-area-inset-bottom,0px))] shrink-0 desktop:hidden"
      />
    </div>
  );
}
