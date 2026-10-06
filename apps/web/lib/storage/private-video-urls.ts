import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Public URLs of check-in and feedback files attached to these levels. */
export async function listPrivateVideoUrlsForNodes(
  supabase: Supabase,
  nodeIds: string[],
): Promise<Array<string | null>> {
  if (nodeIds.length === 0) return [];

  const { data: checkIns } = await supabase
    .from("check_ins")
    .select("id, video_url")
    .in("node_id", nodeIds);
  const checkInIds = (checkIns ?? []).map((row) => row.id);

  const [{ data: feedbacks }, { data: levelFeedbacks }] = await Promise.all([
    checkInIds.length > 0
      ? supabase
          .from("feedbacks")
          .select("video_url")
          .in("check_in_id", checkInIds)
      : Promise.resolve({ data: [] as { video_url: string | null }[] }),
    supabase
      .from("level_feedbacks")
      .select("video_url, file_url")
      .in("node_id", nodeIds),
  ]);

  return [
    ...(checkIns ?? []).map((row) => row.video_url),
    ...(feedbacks ?? []).map((row) => row.video_url),
    ...(levelFeedbacks ?? []).flatMap((row) => [row.video_url, row.file_url]),
  ];
}
