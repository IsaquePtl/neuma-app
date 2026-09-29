"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { LIBRARY_PATH } from "@/lib/library-routes";
import {
  upsertTeoriaMusicalTemplate,
  type TeoriaTemplateSeedResult,
} from "@/lib/teoria-musical/upsert-template";

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

/** Rascunho do template Teoria Musical. Não toca na biblioteca nem activa alunos. */
export async function seedTeoriaMusicalTemplate(): Promise<TeoriaTemplateSeedResult> {
  const { supabase, user } = await requireMentor();
  const result = await upsertTeoriaMusicalTemplate(supabase, user.id);
  revalidatePath(LIBRARY_PATH);
  revalidatePath("/studio/journeys");
  revalidatePath("/studio/library", "layout");
  return result;
}
