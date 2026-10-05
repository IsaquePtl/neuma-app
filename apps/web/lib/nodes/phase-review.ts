import type { createClient } from "@/lib/supabase/server";
import { nodeUsesQuizGate, quizPassScore } from "@/lib/nodes/pass-rule";
import {
  normalizePhaseKey,
  phaseReviewNodes,
  resolvePhaseCheckpointIds,
  type PhaseNodeLike,
} from "@/lib/nodes/phases";
import type { NodePassRule, NodeStatus } from "@/lib/types/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ReviewNode = PhaseNodeLike & {
  title: string;
  status: NodeStatus;
  pass_rule: NodePassRule;
  pass_score: number | null;
};

export type PhaseReviewItem = {
  id: string;
  title: string;
  levelNumber: number;
  visited: boolean;
};

export type PhaseReview = {
  checkpointId: string;
  phaseKey: string;
  phaseLabel: string;
  /** Levels the checkpoint closes (everything in the phase before it). */
  items: PhaseReviewItem[];
  /** Last quiz attempt failed → items must be revisited before a retry. */
  reviewRequired: boolean;
  pendingCount: number;
  failedAt: string | null;
};

/**
 * Phase checkpoint state for one student. `null` when the node isn't a phase
 * checkpoint (standalone checkpoints have no review — the quiz is retried).
 * Review applies only while the checkpoint is not completed and gates by quiz.
 */
export async function loadPhaseReview(
  supabase: Supabase,
  studentId: string,
  nodes: ReviewNode[],
  checkpointId: string,
): Promise<PhaseReview | null> {
  if (!resolvePhaseCheckpointIds(nodes).has(checkpointId)) return null;
  const checkpoint = nodes.find((n) => n.id === checkpointId);
  const phaseKey = normalizePhaseKey(checkpoint?.phase_key);
  if (!checkpoint || !phaseKey) return null;

  const reviewNodes = phaseReviewNodes(nodes, checkpointId);
  const levelOf = new Map(nodes.map((n, i) => [n.id, i + 1]));
  const base: PhaseReview = {
    checkpointId,
    phaseKey,
    phaseLabel: `Fase ${phaseKey}`,
    items: reviewNodes.map((n) => ({
      id: n.id,
      title: n.title,
      levelNumber: levelOf.get(n.id) ?? 0,
      visited: false,
    })),
    reviewRequired: false,
    pendingCount: 0,
    failedAt: null,
  };

  if (
    checkpoint.status === "completed" ||
    !nodeUsesQuizGate(checkpoint.pass_rule) ||
    reviewNodes.length === 0
  ) {
    return base;
  }

  const { data: lastAttempt } = await supabase
    .from("node_quiz_attempts")
    .select("score, created_at")
    .eq("node_id", checkpointId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastAttempt || lastAttempt.score >= quizPassScore(checkpoint.pass_score)) {
    return base;
  }

  const { data: visits } = await supabase
    .from("node_visits")
    .select("node_id, visited_at")
    .eq("student_id", studentId)
    .in(
      "node_id",
      reviewNodes.map((n) => n.id),
    );
  const failedAtMs = new Date(lastAttempt.created_at).getTime();
  const visitedIds = new Set(
    (visits ?? [])
      .filter((v) => new Date(v.visited_at).getTime() > failedAtMs)
      .map((v) => v.node_id),
  );
  const items = base.items.map((item) => ({
    ...item,
    visited: visitedIds.has(item.id),
  }));

  return {
    ...base,
    items,
    reviewRequired: true,
    pendingCount: items.filter((i) => !i.visited).length,
    failedAt: lastAttempt.created_at,
  };
}

/** Review the active level imposes (when it's a failed phase checkpoint). */
export async function loadActivePhaseReview(
  supabase: Supabase,
  studentId: string,
  nodes: ReviewNode[],
): Promise<PhaseReview | null> {
  const active = nodes.find((n) => n.status === "active");
  if (!active || !active.is_phase_checkpoint) return null;
  const review = await loadPhaseReview(supabase, studentId, nodes, active.id);
  return review?.reviewRequired ? review : null;
}
