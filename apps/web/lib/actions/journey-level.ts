"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

async function mentorClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissão");
  return { supabase, user };
}

async function revalidateJourney(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pathId: string,
  studentId?: string | null,
) {
  revalidatePath(`/studio/journeys/${pathId}`);
  revalidatePath("/studio/journeys");
  revalidatePath("/home");
  revalidatePath("/path");
  revalidatePath("/session");
  if (studentId) revalidatePath(`/studio/students/${studentId}`);
}

/** Completa o nível atual e ativa o seguinte (ou conclui o percurso). */
export async function advanceLevel(formData: FormData) {
  const { supabase } = await mentorClient();
  const nodeId = String(formData.get("node_id") ?? "");
  const pathId = String(formData.get("path_id") ?? "");
  if (!nodeId || !pathId) throw new Error("Dados em falta");

  const { data: node } = await supabase
    .from("nodes")
    .select("id, path_id, order_index")
    .eq("id", nodeId)
    .eq("path_id", pathId)
    .single();
  if (!node) throw new Error("Nível não encontrado");

  await supabase
    .from("nodes")
    .update({ status: "completed" })
    .eq("id", node.id);

  const { data: next } = await supabase
    .from("nodes")
    .select("id")
    .eq("path_id", pathId)
    .gt("order_index", node.order_index)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (next) {
    // Lock other non-completed nodes; activate next
    const { data: siblings } = await supabase
      .from("nodes")
      .select("id, status")
      .eq("path_id", pathId);
    for (const s of siblings ?? []) {
      if (s.id === next.id) {
        await supabase.from("nodes").update({ status: "active" }).eq("id", s.id);
      } else if (s.id !== node.id && s.status !== "completed") {
        await supabase.from("nodes").update({ status: "locked" }).eq("id", s.id);
      }
    }
    await supabase.from("paths").update({ status: "active" }).eq("id", pathId);
  } else {
    await supabase.from("paths").update({ status: "completed" }).eq("id", pathId);
  }

  const { data: path } = await supabase
    .from("paths")
    .select("student_id")
    .eq("id", pathId)
    .single();

  await revalidateJourney(supabase, pathId, path?.student_id);
}

/** Mantém o aluno no nível e prolonga o prazo pelo nº de semanas indicado. */
export async function extendLevelWeek(formData: FormData) {
  const { supabase } = await mentorClient();
  const nodeId = String(formData.get("node_id") ?? "");
  const pathId = String(formData.get("path_id") ?? "");
  const weeksRaw = Number(formData.get("weeks") ?? 1);
  const weeks =
    Number.isFinite(weeksRaw) && weeksRaw > 0
      ? Math.min(Math.floor(weeksRaw), 52)
      : 0;
  if (!nodeId || !pathId) throw new Error("Dados em falta");
  if (weeks < 1) throw new Error("Indica quantas semanas a prolongar");

  const { data: node } = await supabase
    .from("nodes")
    .select("id, due_date, status")
    .eq("id", nodeId)
    .eq("path_id", pathId)
    .single();
  if (!node) throw new Error("Nível não encontrado");

  const base = node.due_date
    ? new Date(`${node.due_date}T12:00:00`)
    : new Date();
  base.setDate(base.getDate() + weeks * 7);
  const nextDue = base.toISOString().slice(0, 10);

  await supabase
    .from("nodes")
    .update({
      due_date: nextDue,
      status: "active",
    })
    .eq("id", nodeId);

  // Ensure this is the active node
  const { data: siblings } = await supabase
    .from("nodes")
    .select("id, status")
    .eq("path_id", pathId);
  for (const s of siblings ?? []) {
    if (s.id === nodeId) continue;
    if (s.status !== "completed") {
      await supabase.from("nodes").update({ status: "locked" }).eq("id", s.id);
    }
  }

  await supabase.from("paths").update({ status: "active" }).eq("id", pathId);

  const { data: path } = await supabase
    .from("paths")
    .select("student_id")
    .eq("id", pathId)
    .single();

  await revalidateJourney(supabase, pathId, path?.student_id);
}

export async function createLevelFeedback(formData: FormData) {
  const { supabase, user } = await mentorClient();
  const nodeId = String(formData.get("node_id") ?? "");
  const pathId = String(formData.get("path_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const videoUrl = String(formData.get("video_url") ?? "").trim() || null;
  const fileUrl = String(formData.get("file_url") ?? "").trim() || null;

  if (!nodeId || !pathId) throw new Error("Dados em falta");
  if (!notes && !videoUrl && !fileUrl) {
    throw new Error("Escreve texto ou adiciona um link");
  }

  const { error } = await supabase.from("level_feedbacks").insert({
    node_id: nodeId,
    mentor_id: user.id,
    notes,
    video_url: videoUrl,
    file_url: fileUrl,
  });
  if (error) throw new Error(error.message);

  const { data: path } = await supabase
    .from("paths")
    .select("student_id")
    .eq("id", pathId)
    .single();

  await revalidateJourney(supabase, pathId, path?.student_id);
}
