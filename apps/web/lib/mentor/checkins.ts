import "server-only";

import { createClient } from "@/lib/supabase/server";
import { mentorLevelReviewHref } from "@/lib/journey-path/level-review-url";
import {
  checkInKindLabel,
  checkInLevelTitle,
  nodeKindLabel,
} from "@/lib/labels";
import type { CheckInKind, NodeKind } from "@/lib/types/database.types";

export type MentorCheckInNode = {
  title: string | null;
  path_id: string | null;
  order_index: number | null;
  kind: NodeKind | null;
  week_number: number | null;
};

export type MentorPendingCheckIn = {
  id: string;
  status: string;
  kind: CheckInKind;
  notes: string | null;
  created_at: string;
  node_id: string | null;
  student: { full_name: string | null; email: string | null } | null;
  node: MentorCheckInNode | null;
};

export function resolveRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function mentorCheckInHref(c: {
  id: string;
  node_id: string | null;
  node: MentorCheckInNode | null;
}) {
  const pathId = c.node?.path_id;
  const nodeId = c.node_id;
  if (pathId && nodeId) {
    return mentorLevelReviewHref(pathId, nodeId, {
      checkin: c.id,
    });
  }
  return `/studio/checkins/${c.id}`;
}

export function mentorCheckInLevelNumber(
  node: MentorCheckInNode | null,
): number | null {
  if (node?.order_index == null) return null;
  return node.order_index + 1;
}

export function mentorCheckInLevelMeta(
  node: MentorCheckInNode | null,
  checkInKind: CheckInKind,
): string {
  const parts: string[] = [];
  if (node?.kind) parts.push(nodeKindLabel[node.kind]);
  if (node?.week_number) parts.push(`Sem. ${node.week_number}`);
  parts.push(checkInKindLabel[checkInKind]);
  return parts.join(" · ");
}

export function mentorCheckInLevelTitle(node: MentorCheckInNode | null): string {
  return checkInLevelTitle(node?.title, null);
}

export async function loadPendingCheckIns(
  limit = 60,
): Promise<MentorPendingCheckIn[]> {
  const supabase = await createClient();

  const { data: checkIns } = await supabase
    .from("check_ins")
    .select(
      "id, status, kind, notes, created_at, node_id, student:profiles!check_ins_student_id_fkey(full_name, email), node:nodes(title, path_id, order_index, kind, week_number)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (
    checkIns?.map((c) => ({
      id: c.id,
      status: c.status,
      kind: c.kind,
      notes: c.notes,
      created_at: c.created_at,
      node_id: c.node_id,
      student: resolveRelation(c.student),
      node: resolveRelation(
        c.node as MentorCheckInNode | MentorCheckInNode[] | null | undefined,
      ),
    })) ?? []
  );
}
