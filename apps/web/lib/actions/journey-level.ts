"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { completeCurrentAndActivateNext } from "@/lib/nodes/complete-and-activate";
import { tryIncrementWeekExtensions } from "@/lib/nodes/week-extensions";
import {
  nodeAllowsMarkSeen,
  nodeRequiresCheckIn,
} from "@/lib/nodes/pass-rule";

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
  nodeId?: string | null,
) {
  revalidatePath(`/studio/journeys/${pathId}`);
  revalidatePath("/studio/journeys");
  revalidatePath("/home");
  revalidatePath("/path");
  revalidatePath("/session");
  revalidatePath("/session/feedback");
  if (studentId) revalidatePath(`/studio/students/${studentId}`);
  if (nodeId) {
    revalidatePath(`/studio/journeys/${pathId}/levels/${nodeId}`);
    revalidatePath(`/path/${nodeId}`);
  }
}

/** Completa o nível atual e ativa o seguinte (ou conclui o percurso). */
export async function advanceLevel(formData: FormData) {
  const { supabase } = await mentorClient();
  const nodeId = String(formData.get("node_id") ?? "");
  const pathId = String(formData.get("path_id") ?? "");
  if (!nodeId || !pathId) throw new Error("Dados em falta");

  await completeCurrentAndActivateNext(supabase, nodeId, pathId);

  const { data: path } = await supabase
    .from("paths")
    .select("student_id")
    .eq("id", pathId)
    .single();

  await revalidateJourney(supabase, pathId, path?.student_id, nodeId);
}

/**
 * Aluno marca um nível `pass_rule=none` como visto e avança.
 * Check-in e quiz têm os seus próprios gates. Mentor continua a poder usar advanceLevel.
 */
export async function markNodeSeen(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const nodeId = String(formData.get("node_id") ?? "");
  if (!nodeId) throw new Error("Dados em falta");

  const { data: node } = await supabase
    .from("nodes")
    .select(
      "id, path_id, kind, status, pass_rule, path:paths!inner(id, student_id, status)",
    )
    .eq("id", nodeId)
    .maybeSingle();
  if (!node) throw new Error("Nível não encontrado");

  const path = Array.isArray(node.path) ? node.path[0] : node.path;
  if (!path || path.student_id !== user.id) {
    throw new Error("Este nível não pertence ao teu percurso.");
  }
  if (path.status !== "active") {
    throw new Error(
      path.status === "paused"
        ? "Este percurso está em pausa."
        : "Este percurso ainda não está activo.",
    );
  }
  if (node.status !== "active") {
    throw new Error("Só podes concluir o nível activo.");
  }
  if (!nodeAllowsMarkSeen(node.pass_rule)) {
    throw new Error(
      nodeRequiresCheckIn(node.pass_rule)
        ? "Este nível pede check-in — envia o check-in em vez de marcar visto."
        : "Este nível não se conclui só com «visto».",
    );
  }

  await completeCurrentAndActivateNext(supabase, node.id, path.id);
  await revalidateJourney(supabase, path.id, user.id, node.id);
}

function resolveExtensionDays(formData: FormData): number {
  const unit = String(formData.get("unit") ?? "weeks");
  const amountRaw = Number(
    formData.get("amount") ?? formData.get("weeks") ?? formData.get("days") ?? 1,
  );
  const amount =
    Number.isFinite(amountRaw) && amountRaw > 0
      ? Math.min(Math.floor(amountRaw), unit === "days" ? 365 : 52)
      : 0;
  if (amount < 1) return 0;
  return unit === "days" ? amount : amount * 7;
}

/** Mantém o aluno no nível e prolonga o prazo (dias ou semanas). */
export async function extendLevelWeek(formData: FormData) {
  const { supabase } = await mentorClient();
  const nodeId = String(formData.get("node_id") ?? "");
  const pathId = String(formData.get("path_id") ?? "");
  const daysToAdd = resolveExtensionDays(formData);
  if (!nodeId || !pathId) throw new Error("Dados em falta");
  if (daysToAdd < 1) throw new Error("Indica quanto tempo prolongar");

  const { data: node, error: nodeError } = await supabase
    .from("nodes")
    .select("id, due_date, status")
    .eq("id", nodeId)
    .eq("path_id", pathId)
    .single();
  if (nodeError || !node) throw new Error("Nível não encontrado");

  const base = node.due_date
    ? new Date(`${node.due_date}T12:00:00`)
    : new Date();
  base.setDate(base.getDate() + daysToAdd);
  const nextDue = base.toISOString().slice(0, 10);

  await supabase
    .from("nodes")
    .update({
      due_date: nextDue,
      status: "active",
    })
    .eq("id", nodeId);

  // One extend action → one extra check-in slot (when migration 0032 is applied).
  await tryIncrementWeekExtensions(supabase, nodeId);

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

  await revalidateJourney(supabase, pathId, path?.student_id, nodeId);
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

  await revalidateJourney(supabase, pathId, path?.student_id, nodeId);
}
