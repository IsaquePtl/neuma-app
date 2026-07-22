"use server";

import { revalidatePath } from "next/cache";

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
  return supabase;
}

export async function rejectFeedbackDraft(draftId: string) {
  const supabase = await mentorClient();
  await supabase
    .from("feedback_drafts")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);
  revalidatePath("/studio/checkins");
}
