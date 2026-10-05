import type { createClient } from "@/lib/supabase/server";
import { weekFridayForPath, weeksBetweenDates } from "@/lib/path-period";
import { plannedWeeks, weeksOverBudgetMessage } from "@/lib/nodes/week-budget";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Lays levels end to end. Each level takes its planned weeks plus any
 * "Prolongar prazo" weeks, so an extension pushes every following level.
 */
export async function resegmentPath(supabase: Supabase, pathId: string) {
  const [{ data: path }, { data: nodes }] = await Promise.all([
    supabase.from("paths").select("start_date").eq("id", pathId).single(),
    supabase
      .from("nodes")
      .select("id, duration_weeks, extended_weeks")
      .eq("path_id", pathId)
      .order("order_index", { ascending: true }),
  ]);
  if (!nodes?.length) return;

  const startDate = path?.start_date ?? null;
  let week = 1;
  const updates = nodes.map((node) => {
    const planned = plannedWeeks(node.duration_weeks);
    const span = planned + Math.max(0, node.extended_weeks ?? 0);
    const row = {
      id: node.id,
      week_number: week,
      duration_weeks: planned,
      due_date: startDate ? weekFridayForPath(startDate, week + span - 1) : null,
    };
    week += span;
    return row;
  });

  const results = await Promise.all(
    updates.map(({ id, ...patch }) =>
      supabase.from("nodes").update(patch).eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export type PathWeekBudget = {
  /** Weeks between start and end; null until the path has dates. */
  total: number | null;
  /** Planned weeks per level id. */
  byNode: Map<string, number>;
  used: number;
};

export async function loadPathWeekBudget(
  supabase: Supabase,
  pathId: string,
): Promise<PathWeekBudget> {
  const [{ data: path }, { data: nodes }] = await Promise.all([
    supabase.from("paths").select("start_date, end_date").eq("id", pathId).single(),
    supabase.from("nodes").select("id, duration_weeks").eq("path_id", pathId),
  ]);
  const byNode = new Map(
    (nodes ?? []).map((n) => [n.id, plannedWeeks(n.duration_weeks)]),
  );
  const used = [...byNode.values()].reduce((sum, w) => sum + w, 0);
  const total =
    path?.start_date && path?.end_date
      ? weeksBetweenDates(path.start_date, path.end_date)
      : null;
  return { total, byNode, used };
}

/**
 * Hard budget: a level may only grow into free weeks. Shrinking is always
 * allowed so an over-allocated path can be fixed. Returns an error message.
 */
export function checkWeeksFit(
  budget: PathWeekBudget,
  nodeId: string | null,
  weeks: number,
): string | null {
  if (budget.total == null) return null;
  const current = nodeId ? (budget.byNode.get(nodeId) ?? 0) : 0;
  if (nodeId && weeks <= current) return null;
  const free = budget.total - (budget.used - current);
  if (weeks <= free) return null;
  return weeksOverBudgetMessage(Math.max(0, free), budget.total);
}
