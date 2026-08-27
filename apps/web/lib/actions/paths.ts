"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { PathStatus } from "@/lib/types/database.types";

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

export async function upsertPath(formData: FormData) {
  const { supabase, user } = await requireMentor();

  const id = (formData.get("id") as string) || null;
  const studentId = formData.get("student_id") as string;
  const payload = {
    student_id: studentId,
    created_by: user.id,
    title: (formData.get("title") as string)?.trim() || "Percurso",
    description: ((formData.get("description") as string) || "").trim() || null,
    goal: ((formData.get("goal") as string) || "").trim() || null,
    duration_label: ((formData.get("duration_label") as string) || "").trim() || null,
    start_date: (formData.get("start_date") as string) || null,
    end_date: (formData.get("end_date") as string) || null,
    status: ((formData.get("status") as PathStatus) || "draft"),
  };

  if (id) {
    await supabase.from("paths").update(payload).eq("id", id);
  } else {
    await supabase.from("paths").insert(payload);
  }

  if (studentId) {
    await supabase
      .from("profiles")
      .update({ mentor_id: user.id })
      .eq("id", studentId)
      .eq("role", "student");
  }

  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath("/home");
  revalidatePath("/session");
}

export async function deletePath(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const studentId = formData.get("student_id") as string;

  await supabase.from("paths").delete().eq("id", id);

  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath("/home");
  revalidatePath("/session");
}

export async function setPathStatus(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const studentId = formData.get("student_id") as string;
  const status = (formData.get("status") as PathStatus) || "draft";

  await supabase.from("paths").update({ status }).eq("id", id);

  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath("/home");
  revalidatePath("/session");
}
