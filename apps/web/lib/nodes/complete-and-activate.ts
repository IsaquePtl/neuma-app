import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

/**
 * Completa o nível actual e activa o seguinte (ou conclui o percurso).
 * Internal helper — not a server action. Callers must already authorize.
 *
 * Writes go through the service-role client: students can SELECT their nodes
 * (RLS) but cannot UPDATE them, so mark-seen / quiz pass would otherwise no-op.
 */
export async function completeCurrentAndActivateNext(
  _supabase: Supabase,
  nodeId: string,
  pathId: string,
) {
  void _supabase;
  const admin = createAdminClient();

  const { data: node, error: nodeErr } = await admin
    .from("nodes")
    .select("id, path_id, order_index")
    .eq("id", nodeId)
    .eq("path_id", pathId)
    .single();
  throwIfError(nodeErr, "Nível não encontrado");
  if (!node) throw new Error("Nível não encontrado");

  const { error: completeErr } = await admin
    .from("nodes")
    .update({ status: "completed" })
    .eq("id", node.id);
  throwIfError(completeErr, "Falha ao concluir o nível");

  const { data: next, error: nextErr } = await admin
    .from("nodes")
    .select("id")
    .eq("path_id", pathId)
    .gt("order_index", node.order_index)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();
  throwIfError(nextErr, "Falha ao ler o nível seguinte");

  if (next) {
    const { data: siblings, error: sibErr } = await admin
      .from("nodes")
      .select("id, status")
      .eq("path_id", pathId);
    throwIfError(sibErr, "Falha ao ler os níveis do percurso");
    for (const s of siblings ?? []) {
      if (s.id === next.id) {
        const { error } = await admin
          .from("nodes")
          .update({ status: "active" })
          .eq("id", s.id);
        throwIfError(error, "Falha ao activar o nível seguinte");
      } else if (s.id !== node.id && s.status !== "completed") {
        const { error } = await admin
          .from("nodes")
          .update({ status: "locked" })
          .eq("id", s.id);
        throwIfError(error, "Falha ao bloquear níveis irmãos");
      }
    }
    const { error: pathErr } = await admin
      .from("paths")
      .update({ status: "active" })
      .eq("id", pathId);
    throwIfError(pathErr, "Falha ao manter o percurso activo");
  } else {
    const { error: pathErr } = await admin
      .from("paths")
      .update({ status: "completed" })
      .eq("id", pathId);
    throwIfError(pathErr, "Falha ao concluir o percurso");
  }
}
