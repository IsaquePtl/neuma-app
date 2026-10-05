"use server";

import { createClient } from "@/lib/supabase/server";

/** Called from the level page on mount (never during render — prefetch must not count). */
export async function recordNodeVisit(nodeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !nodeId) return;
  const { error } = await supabase.from("node_visits").upsert(
    {
      student_id: user.id,
      node_id: nodeId,
      visited_at: new Date().toISOString(),
    },
    { onConflict: "student_id,node_id" },
  );
  if (error) console.warn("[node-visits] record failed", error.message);
}
