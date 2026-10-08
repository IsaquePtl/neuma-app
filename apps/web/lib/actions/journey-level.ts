"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertMentorMayCompleteNode } from "@/lib/nodes/advance-gate";
import { completeCurrentAndActivateNext } from "@/lib/nodes/complete-and-activate";
import { resegmentPath } from "@/lib/nodes/schedule-server";
import { MAX_EXTENSION_WEEKS } from "@/lib/nodes/week-budget";
import { addWeeksToDate } from "@/lib/path-period";
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

  await assertMentorMayCompleteNode(supabase, nodeId, "advance");
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
export async function markNodeSeen(
  formData: FormData,
): Promise<{ error: string } | void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Não autenticado" };

    const nodeId = String(formData.get("node_id") ?? "");
    if (!nodeId) return { error: "Dados em falta" };

    const { data: node } = await supabase
      .from("nodes")
      .select(
        "id, path_id, kind, status, pass_rule, path:paths!inner(id, student_id, status)",
      )
      .eq("id", nodeId)
      .maybeSingle();
    if (!node) return { error: "Nível não encontrado" };

    const path = Array.isArray(node.path) ? node.path[0] : node.path;
    if (!path || path.student_id !== user.id) {
      return { error: "Este nível não pertence ao teu percurso." };
    }
    // Um percurso já concluído pode ainda ter o nível activo (visto) por fechar.
    if (path.status === "paused" || path.status === "draft") {
      return {
        error:
          path.status === "paused"
            ? "Este percurso está em pausa."
            : "Este percurso ainda não está activo.",
      };
    }
    if (node.status !== "active") {
      return { error: "Só podes concluir o nível activo." };
    }
    if (!nodeAllowsMarkSeen(node.pass_rule)) {
      return {
        error: nodeRequiresCheckIn(node.pass_rule)
          ? "Este nível pede check-in — envia o check-in em vez de marcar visto."
          : "Este nível não se conclui só com «visto».",
      };
    }

    await completeCurrentAndActivateNext(supabase, node.id, path.id);
    await revalidateJourney(supabase, path.id, user.id, node.id);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Não foi possível marcar como visto.",
    };
  }
}

function resolveExtensionWeeks(formData: FormData): number {
  const raw = Number(formData.get("weeks") ?? formData.get("amount") ?? 1);
  if (!Number.isFinite(raw) || raw < 1) return 0;
  return Math.min(Math.floor(raw), MAX_EXTENSION_WEEKS);
}

/**
 * Mantém o aluno no nível e prolonga-o em semanas inteiras (mínimo 1).
 * Os níveis seguintes avançam o mesmo número de semanas.
 */
export async function extendLevelWeek(formData: FormData) {
  const { supabase } = await mentorClient();
  const nodeId = String(formData.get("node_id") ?? "");
  const pathId = String(formData.get("path_id") ?? "");
  const weeks = resolveExtensionWeeks(formData);
  if (!nodeId || !pathId) throw new Error("Dados em falta");
  if (weeks < 1) throw new Error("Prolonga pelo menos 1 semana");

  const { data: node, error: nodeError } = await supabase
    .from("nodes")
    .select("id, status, due_date, extended_weeks, path:paths!inner(start_date)")
    .eq("id", nodeId)
    .eq("path_id", pathId)
    .single();
  if (nodeError || !node) throw new Error("Nível não encontrado");
  const pathRow = Array.isArray(node.path) ? node.path[0] : node.path;

  const { error: extendError } = await supabase
    .from("nodes")
    .update({
      extended_weeks: Math.min(52, (node.extended_weeks ?? 0) + weeks),
      status: "active",
    })
    .eq("id", nodeId);
  if (extendError) throw new Error(extendError.message);
  await resegmentPath(supabase, pathId);

  if (!pathRow?.start_date) {
    // No calendar yet: keep a concrete deadline relative to the old one.
    const today = new Date().toISOString().slice(0, 10);
    const from = node.due_date && node.due_date > today ? node.due_date : today;
    const { error: dueError } = await supabase
      .from("nodes")
      .update({ due_date: addWeeksToDate(from, weeks) })
      .eq("id", nodeId);
    if (dueError) throw new Error(dueError.message);
  }

  // One extend → one extra check-in slot. Throws if 0032 is missing.
  await tryIncrementWeekExtensions(supabase, nodeId);

  // A pending submission leaves "Por rever". The student can send another
  // because the extra slot was just granted. This is a revision, not a pass.
  const { error: queueError } = await supabase
    .from("check_ins")
    .update({ status: "needs_revision" })
    .eq("node_id", nodeId)
    .eq("status", "pending");
  if (queueError) throw new Error(queueError.message);

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
