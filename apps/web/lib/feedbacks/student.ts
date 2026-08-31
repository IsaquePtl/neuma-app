import "server-only";

import {
  resolveTallyAnswers,
} from "@/components/tally-answers";
import type { createClient } from "@/lib/supabase/server";
import type { StudentNode } from "@/lib/students/queries";
import {
  getStudentAccessibleNodeIds,
  hasVisibleCheckInFeedback,
  hasVisibleLevelFeedback,
  type StudentFeedbackListItem,
  type StudentFeedbackViewRef,
  type StudentNodeActivity,
  type StudentUnviewedFeedbackItem,
} from "@/lib/feedbacks/student-shared";

export type {
  StudentFeedbackListItem,
  StudentFeedbackViewRef,
  StudentNodeActivity,
  StudentNodeCheckIn,
  StudentNodeLevelFeedback,
  StudentUnviewedFeedbackItem,
} from "@/lib/feedbacks/student-shared";

export {
  feedbackHrefForItem,
  getStudentAccessibleNodeIds,
  hasVisibleCheckInFeedback,
  hasVisibleLevelFeedback,
} from "@/lib/feedbacks/student-shared";

type Supabase = Awaited<ReturnType<typeof createClient>>;


function isStudentFeedbackViewsUnavailable(error: {
  code?: string;
  message?: string;
}): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    message.includes("student_feedback_views") ||
    message.includes("schema cache") ||
    message.includes("Could not find the table")
  );
}

function viewKey(kind: StudentFeedbackViewRef["kind"], referenceId: string) {
  return `${kind}:${referenceId}`;
}

async function loadViewedFeedbackKeys(
  supabase: Supabase,
  studentId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("student_feedback_views")
    .select("feedback_kind, reference_id")
    .eq("student_id", studentId);

  if (error) {
    // Table may not exist yet in local dev without migration applied.
    return new Set();
  }

  return new Set(
    (data ?? []).map((row) => viewKey(row.feedback_kind, row.reference_id)),
  );
}

async function loadFeedbackItemsForNodes(
  supabase: Supabase,
  studentId: string,
  nodeIds: string[],
  nodesById: Map<string, StudentNode>,
): Promise<StudentUnviewedFeedbackItem[]> {
  if (nodeIds.length === 0) return [];

  const [{ data: checkIns }, { data: levelFeedbacks }] = await Promise.all([
    supabase
      .from("check_ins")
      .select(
        "id, node_id, created_at, feedback:feedbacks(notes, next_steps, video_url)",
      )
      .eq("student_id", studentId)
      .in("node_id", nodeIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("level_feedbacks")
      .select("id, node_id, notes, video_url, file_url, created_at")
      .in("node_id", nodeIds)
      .order("created_at", { ascending: false }),
  ]);

  const items: StudentUnviewedFeedbackItem[] = [];

  for (const checkIn of checkIns ?? []) {
    if (!checkIn.node_id) continue;
    const feedback = Array.isArray(checkIn.feedback)
      ? checkIn.feedback[0]
      : checkIn.feedback;
    if (!hasVisibleCheckInFeedback(feedback)) continue;
    const node = nodesById.get(checkIn.node_id);
    items.push({
      kind: "check_in",
      referenceId: checkIn.id,
      checkInId: checkIn.id,
      nodeId: checkIn.node_id,
      nodeTitle: node?.title ?? "Nível",
      weekNumber: node?.week_number ?? null,
      createdAt: checkIn.created_at,
      nodeKind: node?.kind ?? null,
    });
  }

  for (const levelFeedback of levelFeedbacks ?? []) {
    if (!hasVisibleLevelFeedback(levelFeedback)) continue;
    const node = nodesById.get(levelFeedback.node_id);
    items.push({
      kind: "level",
      referenceId: levelFeedback.id,
      nodeId: levelFeedback.node_id,
      nodeTitle: node?.title ?? "Nível",
      weekNumber: node?.week_number ?? null,
      createdAt: levelFeedback.created_at,
      nodeKind: node?.kind ?? null,
    });
  }

  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return items;
}

export async function loadStudentUnviewedFeedback(
  supabase: Supabase,
  studentId: string,
  nodes: StudentNode[],
): Promise<{
  count: number;
  items: StudentUnviewedFeedbackItem[];
  unviewedByNodeId: Map<string, number>;
}> {
  const accessibleIds = getStudentAccessibleNodeIds(nodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const [viewedKeys, allItems] = await Promise.all([
    loadViewedFeedbackKeys(supabase, studentId),
    loadFeedbackItemsForNodes(supabase, studentId, accessibleIds, nodesById),
  ]);

  const items = allItems.filter(
    (item) => !viewedKeys.has(viewKey(item.kind, item.referenceId)),
  );

  const unviewedByNodeId = new Map<string, number>();
  for (const item of items) {
    unviewedByNodeId.set(item.nodeId, (unviewedByNodeId.get(item.nodeId) ?? 0) + 1);
  }

  return { count: items.length, items, unviewedByNodeId };
}

/** All visible feedbacks for the student list page (unviewed first, then viewed). */
export async function loadStudentFeedbackList(
  supabase: Supabase,
  studentId: string,
  nodes: StudentNode[],
): Promise<{
  items: StudentFeedbackListItem[];
  unviewedCount: number;
}> {
  const accessibleIds = getStudentAccessibleNodeIds(nodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const [viewedKeys, allItems] = await Promise.all([
    loadViewedFeedbackKeys(supabase, studentId),
    loadFeedbackItemsForNodes(supabase, studentId, accessibleIds, nodesById),
  ]);

  const items: StudentFeedbackListItem[] = allItems.map((item) => ({
    ...item,
    viewed: viewedKeys.has(viewKey(item.kind, item.referenceId)),
    nodeKind: item.nodeKind ?? nodesById.get(item.nodeId)?.kind ?? null,
  }));

  items.sort((a, b) => {
    if (a.viewed !== b.viewed) return a.viewed ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    items,
    unviewedCount: items.filter((item) => !item.viewed).length,
  };
}

/** @deprecated use loadStudentUnviewedFeedback */
export async function studentHasFeedbackForNode(
  supabase: Supabase,
  studentId: string,
  nodeId: string,
): Promise<boolean> {
  const [{ data: recentCheckIns }, { data: levelFeedbacks }] = await Promise.all([
    supabase
      .from("check_ins")
      .select("id, feedback:feedbacks(notes, next_steps, video_url)")
      .eq("student_id", studentId)
      .eq("node_id", nodeId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("level_feedbacks")
      .select("id, notes, video_url, file_url")
      .eq("node_id", nodeId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const hasCheckInFeedback = (recentCheckIns ?? []).some((checkIn) => {
    const feedback = Array.isArray(checkIn.feedback)
      ? checkIn.feedback[0]
      : checkIn.feedback;
    return hasVisibleCheckInFeedback(feedback);
  });

  const hasLevelFeedback = (levelFeedbacks ?? []).some(hasVisibleLevelFeedback);

  return hasCheckInFeedback || hasLevelFeedback;
}

export async function loadStudentNodeActivity(
  supabase: Supabase,
  studentId: string,
  nodeId: string,
): Promise<StudentNodeActivity> {
  const [{ data: checkIns }, { data: levelFeedbacks }, viewedKeys] =
    await Promise.all([
    supabase
      .from("check_ins")
      .select(
        "id, status, kind, created_at, video_url, notes, feedback:feedbacks(notes, next_steps, video_url, approved)",
      )
      .eq("student_id", studentId)
      .eq("node_id", nodeId)
      .order("created_at", { ascending: false }),
    supabase
      .from("level_feedbacks")
      .select("id, notes, video_url, file_url, created_at")
      .eq("node_id", nodeId)
      .order("created_at", { ascending: false }),
    loadViewedFeedbackKeys(supabase, studentId),
  ]);

  const checkInIds = (checkIns ?? []).map((checkIn) => checkIn.id);
  const { data: tallyRows } =
    checkInIds.length > 0
      ? await supabase
          .from("tally_submissions")
          .select("check_in_id, answers, payload, video_url")
          .in("check_in_id", checkInIds)
      : { data: [] as { check_in_id: string; answers: unknown; payload: unknown; video_url: string | null }[] };

  const tallyByCheckInId = new Map(
    (tallyRows ?? []).map((row) => [row.check_in_id, row]),
  );

  return {
    checkIns: (checkIns ?? []).map((checkIn) => {
      const feedback = Array.isArray(checkIn.feedback)
        ? checkIn.feedback[0]
        : checkIn.feedback;
      const tally = tallyByCheckInId.get(checkIn.id);
      const submissionVideoUrl =
        checkIn.video_url || tally?.video_url || null;
      const hasFeedback = hasVisibleCheckInFeedback(feedback);

      return {
        id: checkIn.id,
        status: checkIn.status,
        kind: checkIn.kind,
        created_at: checkIn.created_at,
        video_url: checkIn.video_url,
        notes: checkIn.notes,
        submissionVideoUrl,
        tallyAnswers: tally
          ? resolveTallyAnswers(tally.answers, tally.payload)
          : [],
        feedback: feedback ?? null,
        viewed: hasFeedback
          ? viewedKeys.has(viewKey("check_in", checkIn.id))
          : true,
      };
    }),
    levelFeedbacks: (levelFeedbacks ?? [])
      .filter(hasVisibleLevelFeedback)
      .map((feedback) => ({
        id: feedback.id,
        notes: feedback.notes,
        video_url: feedback.video_url,
        file_url: feedback.file_url ?? null,
        created_at: feedback.created_at,
        viewed: viewedKeys.has(viewKey("level", feedback.id)),
      })),
  };
}

export async function markStudentFeedbackViewed(
  supabase: Supabase,
  studentId: string,
  refs: StudentFeedbackViewRef[],
): Promise<void> {
  if (refs.length === 0) return;

  const rows = refs.map((ref) => ({
    student_id: studentId,
    feedback_kind: ref.kind,
    reference_id: ref.referenceId,
  }));

  const { error } = await supabase
    .from("student_feedback_views")
    .upsert(rows, { onConflict: "student_id,feedback_kind,reference_id" });

  if (error && !isStudentFeedbackViewsUnavailable(error)) {
    console.error("[student_feedback_views]", error.message);
  }
}

export async function markNodeFeedbackViewed(
  supabase: Supabase,
  studentId: string,
  nodeId: string,
): Promise<void> {
  const activity = await loadStudentNodeActivity(supabase, studentId, nodeId);
  const refs: StudentFeedbackViewRef[] = [];

  for (const checkIn of activity.checkIns) {
    if (!hasVisibleCheckInFeedback(checkIn.feedback)) continue;
    refs.push({ kind: "check_in", referenceId: checkIn.id });
  }

  for (const levelFeedback of activity.levelFeedbacks) {
    refs.push({ kind: "level", referenceId: levelFeedback.id });
  }

  await markStudentFeedbackViewed(supabase, studentId, refs);
}

export async function markCheckInFeedbackViewed(
  supabase: Supabase,
  studentId: string,
  checkInId: string,
): Promise<void> {
  const { data: checkIn } = await supabase
    .from("check_ins")
    .select("id, feedback:feedbacks(notes, next_steps, video_url)")
    .eq("id", checkInId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!checkIn) return;

  const feedback = Array.isArray(checkIn.feedback)
    ? checkIn.feedback[0]
    : checkIn.feedback;

  if (!hasVisibleCheckInFeedback(feedback)) return;

  await markStudentFeedbackViewed(supabase, studentId, [
    { kind: "check_in", referenceId: checkIn.id },
  ]);
}

export async function markAllAccessibleFeedbackViewed(
  supabase: Supabase,
  studentId: string,
  nodes: StudentNode[],
): Promise<void> {
  const { items } = await loadStudentUnviewedFeedback(supabase, studentId, nodes);
  await markStudentFeedbackViewed(
    supabase,
    studentId,
    items.map((item) => ({
      kind: item.kind,
      referenceId: item.referenceId,
    })),
  );
}
