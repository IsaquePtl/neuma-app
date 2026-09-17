import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "../types/database.types";
import { DEFAULT_QUIZ_PASS_SCORE } from "../nodes/pass-rule";
import {
  QA_TEMPLATE_DESCRIPTION,
  QA_TEMPLATE_GOAL,
  QA_TEMPLATE_TITLE,
  flattenQaNodes,
  qaNodeTitle,
} from "./curriculum";
import { upsertQaReadyLibrary, type QaReadyAssets } from "./library";

export type QaTemplateClient = SupabaseClient<Database>;

export type QaTemplateSeedResult = {
  templateId: string;
  nodeCount: number;
  assets: QaReadyAssets;
};

export async function upsertQaCompleteTemplate(
  supabase: QaTemplateClient,
  createdBy: string | null,
): Promise<QaTemplateSeedResult> {
  const { assets } = await upsertQaReadyLibrary(supabase, createdBy);
  const nodes = flattenQaNodes();
  const now = new Date().toISOString();

  let { data: template } = await supabase
    .from("path_templates")
    .select("id")
    .eq("title", QA_TEMPLATE_TITLE)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const templatePayload = {
    title: QA_TEMPLATE_TITLE,
    description: QA_TEMPLATE_DESCRIPTION,
    goal: QA_TEMPLATE_GOAL,
    duration_label: "3 meses",
    suggested_node_count: nodes.length,
    period_months: 3,
    status: "ready" as const,
    updated_at: now,
  };

  if (!template) {
    const { data: created, error } = await supabase
      .from("path_templates")
      .insert({ ...templatePayload, created_by: createdBy })
      .select("id")
      .single();
    if (error || !created) {
      throw new Error(error?.message ?? "Falha no template QA");
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
    const asset = node.asset ? assets[node.asset] : null;
    const quiz = node.quiz ?? [];
    const row = {
      title: qaNodeTitle(node),
      description: node.description,
      kind: node.kind,
      order_index: node.orderIndex,
      week_number: null as number | null,
      duration_weeks: node.durationWeeks,
      phase_key: node.phaseKey,
      node_code: node.code,
      pass_rule: node.passRule,
      pass_score: node.passRule === "quiz" ? DEFAULT_QUIZ_PASS_SCORE : null,
      check_in_kind: node.checkInKind,
      library_asset_id: asset?.id ?? null,
      default_resource_url: asset?.url ?? null,
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

  return { templateId: template.id, nodeCount: nodes.length, assets };
}
