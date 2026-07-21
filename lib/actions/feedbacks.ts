"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function mentorClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissao");
  return { supabase, user };
}

export async function submitFeedback(formData: FormData) {
  const { supabase, user } = await mentorClient();

  const checkInId = formData.get("check_in_id") as string;
  const approved = formData.get("approved") === "on";
  const videoUrl = ((formData.get("video_url") as string) || "").trim() || null;
  const notes = ((formData.get("notes") as string) || "").trim() || null;
  const nextSteps = ((formData.get("next_steps") as string) || "").trim() || null;

  // upsert do feedback (1 por check-in)
  await supabase
    .from("feedbacks")
    .upsert(
      {
        check_in_id: checkInId,
        mentor_id: user.id,
        video_url: videoUrl,
        notes,
        next_steps: nextSteps,
        approved,
      },
      { onConflict: "check_in_id" },
    );

  // atualiza estado do check-in
  await supabase
    .from("check_ins")
    .update({ status: approved ? "approved" : "needs_revision" })
    .eq("id", checkInId);

  if (approved) {
    // avanca o percurso: node atual -> completed, proximo -> active
    const { data: checkIn } = await supabase
      .from("check_ins")
      .select("node_id")
      .eq("id", checkInId)
      .single();

    if (checkIn?.node_id) {
      const { data: node } = await supabase
        .from("nodes")
        .select("id, path_id, order_index")
        .eq("id", checkIn.node_id)
        .single();

      if (node) {
        await supabase
          .from("nodes")
          .update({ status: "completed" })
          .eq("id", node.id);

        const { data: next } = await supabase
          .from("nodes")
          .select("id")
          .eq("path_id", node.path_id)
          .gt("order_index", node.order_index)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (next) {
          await supabase
            .from("nodes")
            .update({ status: "active" })
            .eq("id", next.id);
        }
      }
    }
  }

  revalidatePath("/studio/checkins");
  redirect("/studio/checkins");
}
