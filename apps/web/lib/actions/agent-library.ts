"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { orphanedAgentShells } from "@/lib/agent-path-gaps";
import { isAgentEmptyShell } from "@/lib/library-ready";

async function requireMentor() {
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
  return { supabase, mentorId: user.id };
}

function revalidateAgentSurfaces() {
  revalidatePath("/studio/agent");
  revalidatePath("/studio/journeys");
  revalidatePath("/studio/library");
}

/** Remove cascas Agent órfãs (sem nível correspondente em nenhum percurso). */
export async function purgeOrphanedAgentShells() {
  const { supabase } = await requireMentor();

  const [{ data: nodes }, { data: shells }] = await Promise.all([
    supabase.from("nodes").select("title"),
    supabase
      .from("library_assets")
      .select("id, title, content_status, created_by_agent")
      .eq("created_by_agent", true)
      .in("content_status", ["empty", "drafting"])
      .is("archived_at", null),
  ]);

  const allNodeTitles = new Set((nodes ?? []).map((n) => n.title));
  const toDelete = orphanedAgentShells(shells ?? [], allNodeTitles);
  if (toDelete.length === 0) return 0;

  const { error } = await supabase
    .from("library_assets")
    .delete()
    .in(
      "id",
      toDelete.map((s) => s.id),
    );
  if (error) throw error;

  const { data: agentTopics } = await supabase
    .from("library_topics")
    .select("id, name")
    .eq("created_by_agent", true);

  const { data: topicRefs } = await supabase
    .from("library_assets")
    .select("topic_id")
    .not("topic_id", "is", null);

  const usedTopicIds = new Set(
    (topicRefs ?? [])
      .map((r) => r.topic_id)
      .filter((id): id is string => Boolean(id)),
  );

  const orphanTopicIds =
    agentTopics
      ?.filter(
        (t) => !allNodeTitles.has(t.name) && !usedTopicIds.has(t.id),
      )
      .map((t) => t.id) ?? [];

  if (orphanTopicIds.length > 0) {
    await supabase.from("library_topics").delete().in("id", orphanTopicIds);
  }

  revalidateAgentSurfaces();
  return toDelete.length;
}

/** Cascas Agent ligadas a um percurso que foi apagado. */
export async function purgeAgentShellsForPathTitles(titles: string[]) {
  if (titles.length === 0) return;
  const { supabase } = await requireMentor();

  const { data: shells } = await supabase
    .from("library_assets")
    .select("id, title, content_status, created_by_agent")
    .eq("created_by_agent", true)
    .in("content_status", ["empty", "drafting"])
    .in("title", titles)
    .is("archived_at", null);

  const ids = (shells ?? [])
    .filter(isAgentEmptyShell)
    .map((s) => s.id);
  if (ids.length === 0) return;

  const { error } = await supabase.from("library_assets").delete().in("id", ids);
  if (error) throw error;
  revalidateAgentSurfaces();
}
