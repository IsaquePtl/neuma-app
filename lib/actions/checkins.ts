"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { CheckInKind } from "@/lib/types/database.types";

export async function submitCheckIn(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const nodeId = formData.get("node_id") as string;
  const kind = ((formData.get("kind") as CheckInKind) || "video");
  const videoUrl = ((formData.get("video_url") as string) || "").trim() || null;
  const notes = ((formData.get("notes") as string) || "").trim() || null;

  await supabase.from("check_ins").insert({
    node_id: nodeId,
    student_id: user.id,
    kind,
    video_url: videoUrl,
    notes,
    status: "pending",
  });

  revalidatePath("/checkins");
  revalidatePath("/path");
  redirect("/checkins");
}
