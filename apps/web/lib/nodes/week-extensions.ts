import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Increment week_extensions when migration 0032 is applied; no-op otherwise. */
export async function tryIncrementWeekExtensions(
  supabase: Supabase,
  nodeId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("nodes")
    .select("week_extensions")
    .eq("id", nodeId)
    .maybeSingle();

  if (error || !data) return;

  await supabase
    .from("nodes")
    .update({ week_extensions: (data.week_extensions ?? 0) + 1 })
    .eq("id", nodeId);
}
