"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIBRARY_PATH } from "@/lib/library-routes";
import { applyQaPathToAna, type QaApplyResult } from "@/lib/qa-path/apply-path";

async function requireMentor() {
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

/** Template QA + assets ready + path activo da Ana. Não activa beta live. */
export async function seedQaAnaPath(reset = false): Promise<QaApplyResult> {
  const { user } = await requireMentor();
  const admin = createAdminClient();
  const result = await applyQaPathToAna(admin, {
    mentorId: user.id,
    reset,
  });
  revalidatePath(LIBRARY_PATH);
  revalidatePath("/studio/journeys");
  revalidatePath("/studio/library", "layout");
  revalidatePath("/studio/students");
  revalidatePath(`/studio/students/${result.studentId}`);
  revalidatePath("/home");
  revalidatePath("/path");
  return result;
}
