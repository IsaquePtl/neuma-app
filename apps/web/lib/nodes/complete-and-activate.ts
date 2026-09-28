import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Completa o nível actual e activa o seguinte (ou conclui o percurso).
 *
 * Callers must already authorize (mentor, or the student who owns an active
 * node that their pass rule allows them to finish). The caller client is
 * used only to prove the node is visible under RLS. Writes use the service
 * role: students can SELECT their nodes and paths, but there is no UPDATE
 * policy, so a user-scoped update matches zero rows and does not error.
 */
export async function completeCurrentAndActivateNext(
  supabase: Supabase,
  nodeId: string,
  pathId: string,
) {
  const { data: node, error: readError } = await supabase
    .from("nodes")
    .select("id, path_id, order_index")
    .eq("id", nodeId)
    .eq("path_id", pathId)
    .single();
  if (readError || !node) throw new Error("Nível não encontrado");

  const admin = createAdminClient();

  const { error: completeError } = await admin
    .from("nodes")
    .update({ status: "completed" })
    .eq("id", node.id)
    .eq("path_id", pathId);
  if (completeError) throw new Error(completeError.message);

  const { data: next, error: nextError } = await admin
    .from("nodes")
    .select("id")
    .eq("path_id", pathId)
    .gt("order_index", node.order_index)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nextError) throw new Error(nextError.message);

  if (next) {
    const { data: siblings, error: siblingsError } = await admin
      .from("nodes")
      .select("id, status")
      .eq("path_id", pathId);
    if (siblingsError) throw new Error(siblingsError.message);

    for (const s of siblings ?? []) {
      if (s.id === next.id) {
        const { error } = await admin
          .from("nodes")
          .update({ status: "active" })
          .eq("id", s.id);
        if (error) throw new Error(error.message);
      } else if (s.id !== node.id && s.status !== "completed") {
        const { error } = await admin
          .from("nodes")
          .update({ status: "locked" })
          .eq("id", s.id);
        if (error) throw new Error(error.message);
      }
    }

    const { error: pathError } = await admin
      .from("paths")
      .update({ status: "active" })
      .eq("id", pathId);
    if (pathError) throw new Error(pathError.message);
  } else {
    const { error: pathError } = await admin
      .from("paths")
      .update({ status: "completed" })
      .eq("id", pathId);
    if (pathError) throw new Error(pathError.message);
  }
}
