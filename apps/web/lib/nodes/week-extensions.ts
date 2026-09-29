import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * One extra check-in slot. Throws if `nodes.week_extensions` is missing
 * (migration 0032) or the write does not stick — a silent no-op used to
 * tell the mentor the deadline moved while the student stayed blocked.
 */
export async function tryIncrementWeekExtensions(
  supabase: Supabase,
  nodeId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("nodes")
    .select("week_extensions")
    .eq("id", nodeId)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message.includes("week_extensions")
        ? "Falta a coluna week_extensions (migração 0032). O prazo não desbloqueia outro check-in."
        : error.message,
    );
  }
  if (!data) throw new Error("Nível não encontrado");

  const { data: updated, error: updateError } = await supabase
    .from("nodes")
    .update({ week_extensions: (data.week_extensions ?? 0) + 1 })
    .eq("id", nodeId)
    .select("id")
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);
  if (!updated) {
    throw new Error("Não foi possível acrescentar o check-in extra deste nível.");
  }
}
