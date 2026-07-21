"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/path");
}
