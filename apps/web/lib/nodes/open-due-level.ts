import type { createClient } from "@/lib/supabase/server";

import { dueLevelToOpen, earlyActiveLevel } from "@/lib/nodes/level-open";
import { createAdminClient } from "@/lib/supabase/admin";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Writer = Supabase | ReturnType<typeof createAdminClient>;

type OpenableNode = {
  id: string;
  status: string;
  week_number: number | null;
};

/**
 * On path load: close a level that was opened before its Monday, then open
 * the next one once that Monday has arrived. No cron.
 * Students cannot UPDATE nodes, so the student loader passes the admin client.
 * `nodes` must be ordered by order_index. Statuses in the array are updated.
 */
export async function reconcileLevelSchedule(
  writer: Writer,
  nodes: OpenableNode[],
  path: {
    id: string;
    status: string;
    startDate: string | null;
  },
): Promise<{ heldId: string | null; openedId: string | null }> {
  if (path.status !== "active") return { heldId: null, openedId: null };

  const early = earlyActiveLevel(nodes, path.startDate);
  let heldId: string | null = null;
  if (early) {
    const { error } = await writer
      .from("nodes")
      .update({ status: "locked" })
      .eq("id", early.id)
      .eq("path_id", path.id)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    early.status = "locked";
    heldId = early.id;
  }

  const due = dueLevelToOpen(nodes, path.startDate, path.status);
  if (!due) return { heldId, openedId: null };

  const { error } = await writer
    .from("nodes")
    .update({ status: "active" })
    .eq("id", due.id)
    .eq("path_id", path.id)
    .eq("status", "locked");
  if (error) throw new Error(error.message);
  due.status = "active";
  return { heldId, openedId: due.id };
}
