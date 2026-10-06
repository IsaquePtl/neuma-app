import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import {
  createPresignedGetUrl,
  isR2PublicUrl,
  keyFromPublicUrl,
} from "@/lib/storage/r2";

const loadViewer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    role: profile?.role ?? null,
    supabase,
  };
});

/**
 * Check-in and mentor-feedback objects are meant to be private. Callers
 * receive a short-lived URL after we confirm they own the file, are the
 * mentor, or are the student the feedback was written for. Other URLs
 * (YouTube, Tally, library) pass through.
 */
export async function playableVideoUrl(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  if (!isR2PublicUrl(url)) return url;

  const key = keyFromPublicUrl(url);
  if (!key) return null;
  const [folder, ownerId] = key.split("/");
  if (folder !== "check-ins" && folder !== "mentor-feedback") return url;
  if (!ownerId) return null;

  const viewer = await loadViewer();
  if (!viewer) return null;

  if (ownerId === viewer.id || viewer.role === "mentor") {
    return createPresignedGetUrl(key);
  }

  if (folder === "mentor-feedback") {
    const { data: feedback } = await viewer.supabase
      .from("feedbacks")
      .select("id, check_in:check_ins!inner(student_id)")
      .eq("video_url", url)
      .limit(1)
      .maybeSingle();
    const checkIn = Array.isArray(feedback?.check_in)
      ? feedback.check_in[0]
      : feedback?.check_in;
    if (checkIn?.student_id === viewer.id) {
      return createPresignedGetUrl(key);
    }

    const { data: levelByVideo } = await viewer.supabase
      .from("level_feedbacks")
      .select("id, node:nodes!inner(path:paths!inner(student_id))")
      .eq("video_url", url)
      .limit(1)
      .maybeSingle();
    const { data: levelByFile } = levelByVideo
      ? { data: null }
      : await viewer.supabase
          .from("level_feedbacks")
          .select("id, node:nodes!inner(path:paths!inner(student_id))")
          .eq("file_url", url)
          .limit(1)
          .maybeSingle();
    const levelFeedback = levelByVideo ?? levelByFile;
    const node = Array.isArray(levelFeedback?.node)
      ? levelFeedback.node[0]
      : levelFeedback?.node;
    const path = Array.isArray(node?.path) ? node.path[0] : node?.path;
    if (path?.student_id === viewer.id) {
      return createPresignedGetUrl(key);
    }
  }

  return null;
}
