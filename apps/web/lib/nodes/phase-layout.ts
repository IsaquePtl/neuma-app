import type { createClient } from "@/lib/supabase/server";
import {
  canCloseOwnPhase,
  normalizePhaseKey,
  planPhaseLayout,
  sameOrder,
} from "@/lib/nodes/phases";
import type { NodeKind } from "@/lib/types/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export function parsePhaseFields(formData: FormData, kind: NodeKind) {
  const phaseKey = normalizePhaseKey(formData.get("phase_key") as string);
  const raw = String(formData.get("is_phase_checkpoint") ?? "");
  const wanted = raw === "1" || raw === "true" || raw === "on";
  const isPhaseCheckpoint =
    wanted && canCloseOwnPhase({ id: "", kind, phase_key: phaseKey });
  return { phaseKey, isPhaseCheckpoint };
}

/** Frees the phase's checkpoint slot (one per phase, unique index) before claiming it. */
export async function releasePathPhaseCheckpoint(
  supabase: Supabase,
  pathId: string,
  phaseKey: string,
  exceptId?: string,
) {
  let query = supabase
    .from("nodes")
    .update({ is_phase_checkpoint: false })
    .eq("path_id", pathId)
    .eq("phase_key", phaseKey)
    .eq("is_phase_checkpoint", true);
  if (exceptId) query = query.neq("id", exceptId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function releaseTemplatePhaseCheckpoint(
  supabase: Supabase,
  templateId: string,
  phaseKey: string,
  exceptId?: string,
) {
  let query = supabase
    .from("path_template_nodes")
    .update({ is_phase_checkpoint: false })
    .eq("template_id", templateId)
    .eq("phase_key", phaseKey)
    .eq("is_phase_checkpoint", true);
  if (exceptId) query = query.neq("id", exceptId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function writeFlags(
  supabase: Supabase,
  table: "nodes" | "path_template_nodes",
  flagChanges: Map<string, boolean>,
) {
  const entries = [...flagChanges];
  // Clear first so the one-per-phase unique index never sees two at once.
  for (const value of [false, true]) {
    for (const [id, next] of entries) {
      if (next !== value) continue;
      const { error } = await supabase
        .from(table)
        .update({ is_phase_checkpoint: next })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }
  }
}

/** Contiguous phases, one checkpoint per phase, checkpoint last. */
export async function applyPathPhaseLayout(
  supabase: Supabase,
  pathId: string,
  preferredCheckpointId?: string | null,
) {
  const { data: nodes, error } = await supabase
    .from("nodes")
    .select("id, kind, phase_key, is_phase_checkpoint, order_index")
    .eq("path_id", pathId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  if (!nodes?.length) return;

  const plan = planPhaseLayout(nodes, preferredCheckpointId);
  await writeFlags(supabase, "nodes", plan.flagChanges);
  await reorderPathNodes(supabase, pathId, nodes, plan.orderedIds);
}

export async function reorderPathNodes(
  supabase: Supabase,
  pathId: string,
  current: Array<{ id: string; order_index: number }>,
  orderedIds: string[],
) {
  const alreadyDense = current.every((n, i) => n.order_index === i);
  if (alreadyDense && sameOrder(current.map((n) => n.id), orderedIds)) return;
  const { error } = await supabase.rpc("reorder_path_nodes", {
    p_path_id: pathId,
    p_ids: orderedIds,
  });
  if (error) throw new Error(error.message);
}

export async function applyTemplatePhaseLayout(
  supabase: Supabase,
  templateId: string,
  preferredCheckpointId?: string | null,
) {
  const { data: nodes, error } = await supabase
    .from("path_template_nodes")
    .select("id, kind, phase_key, is_phase_checkpoint, order_index")
    .eq("template_id", templateId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  if (!nodes?.length) return;

  const plan = planPhaseLayout(nodes, preferredCheckpointId);
  await writeFlags(supabase, "path_template_nodes", plan.flagChanges);
  await reorderTemplateNodes(supabase, templateId, nodes, plan.orderedIds);
}

export async function reorderTemplateNodes(
  supabase: Supabase,
  templateId: string,
  current: Array<{ id: string; order_index: number }>,
  orderedIds: string[],
) {
  const alreadyDense = current.every((n, i) => n.order_index === i);
  if (alreadyDense && sameOrder(current.map((n) => n.id), orderedIds)) return;
  const { error } = await supabase.rpc("reorder_template_nodes", {
    p_template_id: templateId,
    p_ids: orderedIds,
  });
  if (error) throw new Error(error.message);
}
