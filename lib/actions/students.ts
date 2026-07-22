"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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
  return supabase;
}

export async function updateStudentNotes(formData: FormData) {
  const supabase = await requireMentor();
  const studentId = formData.get("student_id") as string;
  const notes = ((formData.get("internal_notes") as string) || "").trim() || null;

  await supabase
    .from("profiles")
    .update({ internal_notes: notes })
    .eq("id", studentId)
    .eq("role", "student");

  revalidatePath(`/studio/students/${studentId}`);
}

export async function updateStudentProfile(formData: FormData) {
  const supabase = await requireMentor();
  const studentId = formData.get("student_id") as string;
  const fullName = ((formData.get("full_name") as string) || "").trim() || null;

  await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", studentId)
    .eq("role", "student");

  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath("/studio/students");
}
