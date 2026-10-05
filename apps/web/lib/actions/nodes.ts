"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  parseCheckInKind,
  parsePassRule,
  parsePassScore,
} from "@/lib/nodes/pass-rule";
import {
  applyPathPhaseLayout,
  parsePhaseFields,
  releasePathPhaseCheckpoint,
  reorderPathNodes,
} from "@/lib/nodes/phase-layout";
import {
  planPhaseAwareDrop,
  planPhaseAwareMove,
  planPhaseRanges,
  validatePhaseRanges,
  type PhaseRange,
} from "@/lib/nodes/phases";
import {
  checkWeeksFit,
  loadPathWeekBudget,
  resegmentPath,
} from "@/lib/nodes/schedule-server";
import { plannedWeeks } from "@/lib/nodes/week-budget";
import type { NodeKind, NodeStatus } from "@/lib/types/database.types";

async function mentorClient() {
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

async function studentIdOfPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pathId: string,
) {
  const { data } = await supabase
    .from("paths")
    .select("student_id")
    .eq("id", pathId)
    .single();
  return data?.student_id;
}

function revalidateJourneyPath(pathId: string) {
  revalidatePath(`/studio/journeys/${pathId}`);
  revalidatePath(`/studio/journeys/${pathId}/edit`);
  revalidatePath("/studio/journeys");
}

async function revalidateAfterNodeChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pathId: string,
) {
  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
    revalidatePath("/home");
    revalidatePath("/path", "layout");
    revalidatePath("/session");
  }
  revalidateJourneyPath(pathId);
}

/** Null when the form doesn't carry the field (weeks edited elsewhere). */
function parseDurationWeeks(formData: FormData): number | null {
  const value = formData.get("duration_weeks");
  if (value == null || value === "") return null;
  return plannedWeeks(Number(value));
}

const resegmentPathLevels = resegmentPath;

async function assertWeeksFit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pathId: string,
  nodeId: string | null,
  weeks: number,
) {
  const budget = await loadPathWeekBudget(supabase, pathId);
  const message = checkWeeksFit(budget, nodeId, weeks);
  if (message) throw new Error(message);
}

/** Inline stepper on the level card. Returns the error instead of throwing (prod hides messages). */
export async function setNodeWeeks(input: {
  id: string;
  pathId: string;
  weeks: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await mentorClient();
  const weeks = plannedWeeks(input.weeks);
  const budget = await loadPathWeekBudget(supabase, input.pathId);
  if (!budget.byNode.has(input.id)) return { ok: false, error: "Nível não encontrado." };
  const message = checkWeeksFit(budget, input.id, weeks);
  if (message) return { ok: false, error: message };

  const { error } = await supabase
    .from("nodes")
    .update({ duration_weeks: weeks })
    .eq("id", input.id)
    .eq("path_id", input.pathId);
  if (error) return { ok: false, error: "Não foi possível guardar as semanas." };

  await resegmentPathLevels(supabase, input.pathId);
  await revalidateAfterNodeChange(supabase, input.pathId);
  return { ok: true };
}

export async function createNode(formData: FormData) {
  const supabase = await mentorClient();
  const pathId = formData.get("path_id") as string;
  const durationWeeks = parseDurationWeeks(formData) ?? 1;
  await assertWeeksFit(supabase, pathId, null, durationWeeks);

  const { data: last } = await supabase
    .from("nodes")
    .select("order_index")
    .eq("path_id", pathId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIndex = (last?.order_index ?? -1) + 1;

  // Primeiro node de um percurso comeca ativo; restantes bloqueados.
  const status: NodeStatus = nextIndex === 0 ? "active" : "locked";

  const kind = ((formData.get("kind") as NodeKind) || "practice");
  const passRule = parsePassRule(
    (formData.get("pass_rule") as string) || "",
    kind,
  );
  const { phaseKey, isPhaseCheckpoint } = parsePhaseFields(formData, kind);
  if (isPhaseCheckpoint && phaseKey) {
    await releasePathPhaseCheckpoint(supabase, pathId, phaseKey);
  }
  const { data: created, error: insertError } = await supabase
    .from("nodes")
    .insert({
    path_id: pathId,
    title: (formData.get("title") as string)?.trim() || "Novo bloco",
    description: ((formData.get("description") as string) || "").trim() || null,
    duration_weeks: durationWeeks,
    kind,
    resource_url: ((formData.get("resource_url") as string) || "").trim() || null,
    content_body:
      ((formData.get("content_body") as string) || "").trim() || null,
    pass_rule: passRule,
    pass_score: parsePassScore((formData.get("pass_score") as string) || ""),
    check_in_kind: parseCheckInKind(
      (formData.get("check_in_kind") as string) || "",
      kind,
      passRule,
    ),
    phase_key: phaseKey,
    node_code: ((formData.get("node_code") as string) || "").trim() || null,
    is_phase_checkpoint: isPhaseCheckpoint,
    order_index: nextIndex,
    status,
    })
    .select("id")
    .single();
  if (insertError || !created) {
    throw new Error(insertError?.message ?? "Não foi possível criar o nível");
  }

  await applyPathPhaseLayout(
    supabase,
    pathId,
    isPhaseCheckpoint ? created.id : null,
  );
  await resegmentPathLevels(supabase, pathId);
  await revalidateAfterNodeChange(supabase, pathId);
}

export async function updateNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;
  const durationWeeks = parseDurationWeeks(formData);
  if (durationWeeks != null) {
    await assertWeeksFit(supabase, pathId, id, durationWeeks);
  }

  const kind = ((formData.get("kind") as NodeKind) || "practice");
  const passRule = parsePassRule(
    (formData.get("pass_rule") as string) || "",
    kind,
  );
  if (passRule === "quiz") {
    const { count } = await supabase
      .from("node_quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("node_id", id);
    if (!count) {
      throw new Error(
        "Adiciona pelo menos uma pergunta antes de usar o gate Quiz.",
      );
    }
  }
  const { phaseKey, isPhaseCheckpoint } = parsePhaseFields(formData, kind);
  if (isPhaseCheckpoint && phaseKey) {
    await releasePathPhaseCheckpoint(supabase, pathId, phaseKey, id);
  }
  const { error: updateError } = await supabase
    .from("nodes")
    .update({
      title: (formData.get("title") as string)?.trim() || "Bloco",
      description: ((formData.get("description") as string) || "").trim() || null,
      ...(durationWeeks != null ? { duration_weeks: durationWeeks } : {}),
      kind,
      status: ((formData.get("status") as NodeStatus) || "locked"),
      resource_url: ((formData.get("resource_url") as string) || "").trim() || null,
      content_body:
        ((formData.get("content_body") as string) || "").trim() || null,
      pass_rule: passRule,
      pass_score: parsePassScore((formData.get("pass_score") as string) || ""),
      check_in_kind: parseCheckInKind(
        (formData.get("check_in_kind") as string) || "",
        kind,
        passRule,
      ),
      phase_key: phaseKey,
      node_code: ((formData.get("node_code") as string) || "").trim() || null,
      is_phase_checkpoint: isPhaseCheckpoint,
    })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  await applyPathPhaseLayout(supabase, pathId, isPhaseCheckpoint ? id : null);
  await resegmentPathLevels(supabase, pathId);
  await revalidateAfterNodeChange(supabase, pathId);
}

export async function deleteNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;
  await supabase.from("nodes").delete().eq("id", id);
  await applyPathPhaseLayout(supabase, pathId);
  await resegmentPathLevels(supabase, pathId);
  await revalidateAfterNodeChange(supabase, pathId);
}

/** Crossing a phase boundary moves the level into that phase; checkpoints stay last. */
export async function moveNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;
  const direction = formData.get("direction") as "up" | "down";

  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, kind, phase_key, is_phase_checkpoint, order_index")
    .eq("path_id", pathId)
    .order("order_index", { ascending: true });
  if (!nodes) return;

  const move = planPhaseAwareMove(nodes, id, direction);
  if (!move) return;

  if (move.phaseChanged) {
    const { error } = await supabase
      .from("nodes")
      .update({ phase_key: move.phaseKey })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
  await reorderPathNodes(supabase, pathId, nodes, move.orderedIds);
  await applyPathPhaseLayout(supabase, pathId);
  await resegmentPathLevels(supabase, pathId);
  await revalidateAfterNodeChange(supabase, pathId);
}

/** Phase editor in the calendar: phases as contiguous level ranges. */
export async function setPathPhases(input: {
  pathId: string;
  phases: PhaseRange[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await mentorClient();
  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, kind, phase_key, is_phase_checkpoint, order_index")
    .eq("path_id", input.pathId)
    .order("order_index", { ascending: true });
  if (!nodes) return { ok: false, error: "Percurso não encontrado." };

  const invalid = validatePhaseRanges(input.phases, nodes.length);
  if (invalid) return { ok: false, error: invalid };

  const planned = planPhaseRanges(nodes, input.phases);
  const changed = planned.filter((next, i) => {
    const prev = nodes[i];
    return (
      next.phase_key !== (prev.phase_key ?? null) ||
      next.is_phase_checkpoint !== Boolean(prev.is_phase_checkpoint)
    );
  });
  const results = await Promise.all(
    changed.map((n) =>
      supabase
        .from("nodes")
        .update({ phase_key: n.phase_key, is_phase_checkpoint: n.is_phase_checkpoint })
        .eq("id", n.id),
    ),
  );
  if (results.some((r) => r.error)) {
    return { ok: false, error: "Não foi possível guardar as fases." };
  }

  await applyPathPhaseLayout(supabase, input.pathId);
  await resegmentPathLevels(supabase, input.pathId);
  await revalidateAfterNodeChange(supabase, input.pathId);
  return { ok: true };
}

/** Drag & drop: `toIndex` is the level's final position (0-based). */
export async function reorderNode(input: {
  id: string;
  pathId: string;
  toIndex: number;
}) {
  const supabase = await mentorClient();
  const { id, pathId, toIndex } = input;
  if (!Number.isFinite(toIndex)) throw new Error("Posição inválida.");

  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, kind, phase_key, is_phase_checkpoint, order_index")
    .eq("path_id", pathId)
    .order("order_index", { ascending: true });
  if (!nodes) return;

  const move = planPhaseAwareDrop(nodes, id, toIndex);
  if (!move) return;

  if (move.phaseChanged) {
    const { error } = await supabase
      .from("nodes")
      .update({ phase_key: move.phaseKey })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
  await reorderPathNodes(supabase, pathId, nodes, move.orderedIds);
  await applyPathPhaseLayout(supabase, pathId);
  await resegmentPathLevels(supabase, pathId);
  await revalidateAfterNodeChange(supabase, pathId);
}

export async function activateNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;

  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, status")
    .eq("path_id", pathId);

  if (!nodes?.length) return;

  for (const n of nodes) {
    if (n.id === id) {
      await supabase.from("nodes").update({ status: "active" }).eq("id", n.id);
    } else if (n.status !== "completed") {
      await supabase.from("nodes").update({ status: "locked" }).eq("id", n.id);
    }
  }

  await supabase.from("paths").update({ status: "active" }).eq("id", pathId);

  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
    revalidatePath("/home");
    revalidatePath("/path");
    revalidatePath("/session");
  }
  revalidateJourneyPath(pathId);
}
