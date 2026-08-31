import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Base slots per level + mentor extensions (or revision grants). */
export function allowedCheckInsForNode(weekExtensions: number | null | undefined) {
  const extras =
    typeof weekExtensions === "number" && Number.isFinite(weekExtensions)
      ? Math.max(0, Math.floor(weekExtensions))
      : 0;
  return 1 + extras;
}

export type CheckInAllowance = {
  allowed: boolean;
  used: number;
  limit: number;
  weekExtensions: number;
  /** Pending mentor review — student already submitted for this cycle. */
  awaitingReview: boolean;
};

/**
 * Video check-ins count toward the per-level limit.
 * Mentorship 1:1 messages (kind=text) do not.
 */
export async function getCheckInAllowance(
  supabase: Supabase,
  nodeId: string,
  studentId: string,
): Promise<CheckInAllowance> {
  const [{ data: node }, { count }, { count: pendingCount }] = await Promise.all([
    supabase
      .from("nodes")
      .select("week_extensions")
      .eq("id", nodeId)
      .maybeSingle(),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("node_id", nodeId)
      .eq("student_id", studentId)
      .eq("kind", "video"),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("node_id", nodeId)
      .eq("student_id", studentId)
      .eq("kind", "video")
      .eq("status", "pending"),
  ]);

  const weekExtensions = node?.week_extensions ?? 0;
  const used = count ?? 0;
  const limit = allowedCheckInsForNode(weekExtensions);

  return {
    allowed: used < limit,
    used,
    limit,
    weekExtensions,
    awaitingReview: (pendingCount ?? 0) > 0,
  };
}

export async function assertCanSubmitCheckIn(
  supabase: Supabase,
  nodeId: string,
  studentId: string,
) {
  const allowance = await getCheckInAllowance(supabase, nodeId, studentId);
  if (allowance.allowed) return allowance;

  if (allowance.awaitingReview) {
    throw new Error(
      "Já enviaste o check-in deste nível. Aguarda o feedback do mentor.",
    );
  }

  throw new Error(
    "Já usaste o check-in deste nível. Só podes enviar outro se o mentor prolongar o nível ou pedir uma revisão.",
  );
}

/** Human-readable PT message when the form/CTA should be hidden. */
export function checkInBlockedMessage(allowance: CheckInAllowance): string {
  if (allowance.awaitingReview) {
    return "Já enviaste o check-in deste nível. Aguarda o feedback do mentor.";
  }
  return "Já usaste o check-in deste nível. Só podes enviar outro se o mentor prolongar o nível ou pedir uma revisão.";
}
