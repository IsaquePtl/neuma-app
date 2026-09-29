import type { createClient } from "@/lib/supabase/server";

import { createAdminClient } from "@/lib/supabase/admin";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type WriteClient = Supabase | ReturnType<typeof createAdminClient>;

/**
 * Completa o nível actual e activa o seguinte (ou conclui o percurso).
 * Internal helper — not a server action. Callers must already authorize.
 *
 * Students only have SELECT on nodes/paths (0001_init.sql). A user-scoped
 * update then matches zero rows and returns no error. Mentors have ALL, so
 * their write sticks. When the caller write comes back empty, retry with the
 * service role.
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

  await persist(supabase, (client) =>
    client
      .from("nodes")
      .update({ status: "completed" })
      .eq("id", node.id)
      .select("id")
      .maybeSingle(),
  );

  const { data: next, error: nextError } = await supabase
    .from("nodes")
    .select("id")
    .eq("path_id", pathId)
    .gt("order_index", node.order_index)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nextError) throw new Error(nextError.message);

  if (next) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("nodes")
      .select("id, status")
      .eq("path_id", pathId);
    if (siblingsError) throw new Error(siblingsError.message);

    for (const s of siblings ?? []) {
      if (s.id === next.id) {
        await persist(supabase, (client) =>
          client
            .from("nodes")
            .update({ status: "active" })
            .eq("id", s.id)
            .select("id")
            .maybeSingle(),
        );
      } else if (s.id !== node.id && s.status !== "completed") {
        await persist(supabase, (client) =>
          client
            .from("nodes")
            .update({ status: "locked" })
            .eq("id", s.id)
            .select("id")
            .maybeSingle(),
        );
      }
    }

    await persist(supabase, (client) =>
      client
        .from("paths")
        .update({ status: "active" })
        .eq("id", pathId)
        .select("id")
        .maybeSingle(),
    );
  } else {
    await persist(supabase, (client) =>
      client
        .from("paths")
        .update({ status: "completed" })
        .eq("id", pathId)
        .select("id")
        .maybeSingle(),
    );
  }
}

async function persist(
  caller: Supabase,
  query: (
    client: WriteClient,
  ) => PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>,
) {
  const first = await query(caller);
  if (first.error) throw new Error(first.error.message);
  if (first.data) return;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error(
      "Não foi possível gravar o nível: falta SUPABASE_SERVICE_ROLE_KEY no servidor.",
    );
  }
  const second = await query(admin);
  if (second.error || !second.data) {
    throw new Error(second.error?.message ?? "A alteração não foi gravada");
  }
}
