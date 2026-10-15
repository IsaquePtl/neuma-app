import "server-only";

import {
  buildPathPanorama,
  type PanoramaNodeInput,
  type PanoramaPathInput,
  type PathPanoramaModel,
} from "@/lib/calendar/path-panorama-model";
import { todayIsoDate } from "@/lib/nodes/level-open";
import { createClient } from "@/lib/supabase/server";
import type {
  CheckInKind,
  NodeKind,
  NodePassRule,
  NodeStatus,
  PathStatus,
} from "@/lib/types/database.types";

type NodeRow = {
  id: string;
  path_id: string;
  title: string;
  status: NodeStatus;
  week_number: number | null;
  duration_weeks: number | null;
  extended_weeks: number | null;
  kind: NodeKind;
  due_date: string | null;
  resource_url: string | null;
  content_body: string | null;
  library_asset_id: string | null;
  order_index: number;
  pass_rule: NodePassRule | null;
  check_in_kind: CheckInKind | null;
};

type PathRow = {
  id: string;
  title: string;
  status: PathStatus;
  start_date: string | null;
  created_at: string;
  placeholder_name: string | null;
  student:
    | {
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
      }
    | {
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
      }[]
    | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const NODE_SELECT =
  "id, path_id, title, status, week_number, duration_weeks, extended_weeks, kind, due_date, resource_url, content_body, library_asset_id, order_index, pass_rule, check_in_kind";

export async function loadPathPanorama(): Promise<PathPanoramaModel> {
  const supabase = await createClient();
  const { data: pathRows, error: pathError } = await supabase
    .from("paths")
    .select(
      "id, title, status, start_date, created_at, placeholder_name, student:profiles!paths_student_id_fkey(full_name, email, avatar_url)",
    )
    .in("status", ["active", "paused"]);
  if (pathError) throw new Error(pathError.message);

  const paths = (pathRows ?? []) as PathRow[];
  if (paths.length === 0) return buildPathPanorama([], todayIsoDate());

  const pathIds = paths.map((path) => path.id);
  const nodes: NodeRow[] = [];
  for (let index = 0; index < pathIds.length; index += 80) {
    const chunk = pathIds.slice(index, index + 80);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("nodes")
        .select(NODE_SELECT)
        .in("path_id", chunk)
        .order("order_index", { ascending: true })
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      nodes.push(...((data ?? []) as NodeRow[]));
      if (!data || data.length < 1000) break;
    }
  }

  const pendingByNode = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("check_ins")
      .select("id, node_id")
      .eq("status", "pending")
      .not("node_id", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (!row.node_id || pendingByNode.has(row.node_id)) continue;
      pendingByNode.set(row.node_id, row.id);
    }
    if (!data || data.length < 1000) break;
  }

  const nodesByPath = new Map<string, PanoramaNodeInput[]>();
  for (const node of nodes) {
    const list = nodesByPath.get(node.path_id) ?? [];
    list.push({
      id: node.id,
      title: node.title,
      status: node.status,
      weekNumber: node.week_number,
      durationWeeks: node.duration_weeks,
      extendedWeeks: node.extended_weeks,
      kind: node.kind,
      dueDate: node.due_date,
      resourceUrl: node.resource_url,
      contentBody: node.content_body,
      libraryAssetId: node.library_asset_id,
      orderIndex: node.order_index,
      passRule: node.pass_rule,
      checkInKind: node.check_in_kind,
      pendingCheckInId: pendingByNode.get(node.id) ?? null,
    });
    nodesByPath.set(node.path_id, list);
  }

  const input: PanoramaPathInput[] = paths.map((path) => {
    const student = one(path.student);
    return {
      id: path.id,
      title: path.title,
      status: path.status,
      startDate: path.start_date,
      createdAt: path.created_at,
      studentName: student?.full_name ?? null,
      studentEmail: student?.email ?? null,
      avatarUrl: student?.avatar_url ?? null,
      placeholderName: path.placeholder_name,
      nodes: nodesByPath.get(path.id) ?? [],
    };
  });

  return buildPathPanorama(input, todayIsoDate());
}
