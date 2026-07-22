"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const fullName = ((formData.get("full_name") as string) || "").trim();
  const calUsername = ((formData.get("cal_username") as string) || "").trim();
  const styleNotes = ((formData.get("mentor_style_notes") as string) || "").trim();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const update: {
    full_name: string | null;
    cal_username?: string | null;
    mentor_style_notes?: string | null;
  } = {
    full_name: fullName || null,
  };

  if (profile?.role === "mentor") {
    update.cal_username = calUsername || null;
    update.mentor_style_notes = styleNotes || null;
  }

  await supabase.from("profiles").update(update).eq("id", user.id);

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/studio/settings");
}
