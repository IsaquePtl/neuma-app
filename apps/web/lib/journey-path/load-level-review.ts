import { createClient } from "@/lib/supabase/server";
import { mentorLevelReviewHref } from "@/lib/journey-path/level-review-url";
import { loadJourneyPathPageData } from "@/lib/journey-path/load-journey-path";
import type { StudentNode } from "@/lib/students/queries";
import type {
  JourneyCheckIn,
  JourneyLevelFeedback,
} from "@/components/journey-path-composer";

export type CheckInDetail = {
  id: string;
  status: JourneyCheckIn["status"];
  kind: JourneyCheckIn["kind"];
  video_url: string | null;
  notes: string | null;
  ai_summary: string | null;
  created_at: string;
  feedback: {
    video_url: string | null;
    notes: string | null;
    next_steps: string | null;
    approved: boolean;
  } | null;
  draft: {
    id: string;
    body_notes: string | null;
    body_next_steps: string | null;
  } | null;
  tallyAnswers: import("@/components/tally-answers").TallyAnswerView[];
  tallyVideoUrl: string | null;
};

export type MentorLevelReviewData = {
  pathId: string;
  pathTitle: string;
  studentName: string;
  studentId: string | null;
  node: StudentNode;
  levelNumber: number;
  nodeCheckIns: JourneyCheckIn[];
  nodeFeedbacks: JourneyLevelFeedback[];
  checkInDetail: CheckInDetail | null;
  selectedCheckInId: string | null;
};

export async function resolveCheckInLevelUrl(
  checkInId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("check_ins")
    .select("id, node_id, node:nodes(path_id)")
    .eq("id", checkInId)
    .maybeSingle();

  if (!data?.node_id) return null;
  const node = Array.isArray(data.node) ? data.node[0] : data.node;
  if (!node?.path_id) return null;

  return mentorLevelReviewHref(node.path_id, data.node_id, {
    checkin: checkInId,
  });
}

async function loadCheckInDetail(
  checkInId: string,
): Promise<CheckInDetail | null> {
  const supabase = await createClient();
  const { data: checkIn } = await supabase
    .from("check_ins")
    .select("id, status, kind, video_url, notes, ai_summary, created_at")
    .eq("id", checkInId)
    .maybeSingle();

  if (!checkIn) return null;

  const [{ data: feedback }, { data: draft }, { data: tally }] =
    await Promise.all([
      supabase
        .from("feedbacks")
        .select("notes, next_steps, video_url, approved")
        .eq("check_in_id", checkInId)
        .maybeSingle(),
      supabase
        .from("feedback_drafts")
        .select("id, body_notes, body_next_steps, status")
        .eq("check_in_id", checkInId)
        .eq("status", "pending_review")
        .maybeSingle(),
      supabase
        .from("tally_submissions")
        .select("answers, payload, video_url")
        .eq("check_in_id", checkInId)
        .maybeSingle(),
    ]);

  const { resolveTallyAnswers } = await import("@/components/tally-answers");

  return {
    id: checkIn.id,
    status: checkIn.status,
    kind: checkIn.kind,
    video_url: checkIn.video_url,
    notes: checkIn.notes,
    ai_summary: checkIn.ai_summary,
    created_at: checkIn.created_at,
    feedback: feedback ?? null,
    draft: draft
      ? {
          id: draft.id,
          body_notes: draft.body_notes,
          body_next_steps: draft.body_next_steps,
        }
      : null,
    tallyAnswers: tally
      ? resolveTallyAnswers(tally.answers, tally.payload)
      : [],
    tallyVideoUrl: tally?.video_url ?? null,
  };
}

export async function loadMentorLevelReviewData(
  pathId: string,
  nodeId: string,
  options?: { checkin?: string },
): Promise<MentorLevelReviewData | null> {
  const journey = await loadJourneyPathPageData(pathId);
  if (!journey) return null;

  const nodeIndex = journey.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex < 0) return null;

  const node = journey.nodes[nodeIndex]!;
  const nodeCheckIns = journey.checkIns.filter((c) => c.node_id === nodeId);
  const nodeFeedbacks = journey.levelFeedbacks.filter(
    (f) => f.node_id === nodeId,
  );

  let selectedCheckInId = options?.checkin ?? null;
  if (
    selectedCheckInId &&
    !nodeCheckIns.some((c) => c.id === selectedCheckInId)
  ) {
    selectedCheckInId = null;
  }
  if (!selectedCheckInId) {
    const pending = nodeCheckIns.find((c) => c.status === "pending");
    selectedCheckInId = pending?.id ?? nodeCheckIns[0]?.id ?? null;
  }

  const checkInDetail = selectedCheckInId
    ? await loadCheckInDetail(selectedCheckInId)
    : null;

  return {
    pathId,
    pathTitle: journey.path.title,
    studentName: journey.displayName,
    studentId: journey.student?.id ?? null,
    node,
    levelNumber: nodeIndex + 1,
    nodeCheckIns,
    nodeFeedbacks,
    checkInDetail,
    selectedCheckInId,
  };
}
