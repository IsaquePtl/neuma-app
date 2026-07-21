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

  await supabase
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", user.id);

  revalidatePath("/", "layout");
}
