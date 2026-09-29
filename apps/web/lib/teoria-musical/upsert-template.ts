import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "../types/database.types";
import { DEFAULT_QUIZ_PASS_SCORE } from "../nodes/pass-rule";
import {
  TEORIA_MUSICAL_TITLE,
  TEORIA_TEMPLATE_DESCRIPTION,
  TEORIA_TEMPLATE_GOAL,
  flattenTeoriaNodes,
  teoriaNodeTitle,
  teoriaSkeletonQuiz,
} from "./curriculum";

export type TeoriaTemplateClient = SupabaseClient<Database>;

export type TeoriaTemplateSeedResult = {
  templateId: string;
  nodeCount: number;
};

/**
 * Draft path template only. Does not touch library_categories/topics/assets
 * and does not assign or activate students.
 */
export async function upsertTeoriaMusicalTemplate(
  supabase: TeoriaTemplateClient,
  createdBy: string | null,
): Promise<TeoriaTemplateSeedResult> {
  const nodes = flattenTeoriaNodes();
  const now = new Date().toISOString();

  let { data: template } = await supabase
    .from("path_templates")
    .select("id")
    .eq("title", TEORIA_MUSICAL_TITLE)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const templatePayload = {
    title: TEORIA_MUSICAL_TITLE,
    description: TEORIA_TEMPLATE_DESCRIPTION,
    goal: TEORIA_TEMPLATE_GOAL,
    duration_label: null as string | null,
    suggested_node_count: nodes.length,
    status: "draft" as const,
    updated_at: now,
  };

  if (!template) {
    const { data: created, error } = await supabase
      .from("path_templates")
      .insert({ ...templatePayload, created_by: createdBy })
      .select("id")
      .single();
    if (error || !created) {
      throw new Error(error?.message ?? "Falha no template Teoria Musical");
    }
    template = created;
  } else {
    const { error } = await supabase
      .from("path_templates")
      .update(templatePayload)
      .eq("id", template.id);
    if (error) throw new Error(error.message);
  }

  for (const node of nodes) {
    const quiz =
      node.kind === "milestone" ? teoriaSkeletonQuiz(node.code) : [];
    const row = {
      title: teoriaNodeTitle(node),
      description: node.description ?? null,
      kind: node.kind,
      order_index: node.orderIndex,
      phase_key: node.phaseKey,
      node_code: node.code,
      pass_rule: node.passRule,
      pass_score: node.passRule === "quiz" ? DEFAULT_QUIZ_PASS_SCORE : null,
      check_in_kind: node.checkInKind,
      quiz_questions: quiz as unknown as Json,
    };

    const { data: existing } = await supabase
      .from("path_template_nodes")
      .select("id")
      .eq("template_id", template.id)
      .eq("node_code", node.code)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("path_template_nodes")
        .update(row)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("path_template_nodes").insert({
        ...row,
        template_id: template.id,
      });
      if (error) throw new Error(error.message);
    }
  }

  const keep = nodes.map((n) => n.code);
  const { data: extras } = await supabase
    .from("path_template_nodes")
    .select("id, node_code")
    .eq("template_id", template.id);
  const extraIds = (extras ?? [])
    .filter((n) => !n.node_code || !keep.includes(n.node_code))
    .map((n) => n.id);
  if (extraIds.length) {
    await supabase.from("path_template_nodes").delete().in("id", extraIds);
  }

  return { templateId: template.id, nodeCount: nodes.length };
}
