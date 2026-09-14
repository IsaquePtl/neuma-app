import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Completa o nível actual e activa o seguinte (ou conclui o percurso).
 * Internal helper — not a server action. Callers must already authorize.
 */
export async function completeCurrentAndActivateNext(
  supabase: Supabase,
  nodeId: string,
  pathId: string,
) {
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
}
