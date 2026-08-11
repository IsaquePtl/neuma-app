import { notFound } from "next/navigation";

import { PathTemplateEditor } from "@/components/path-template-editor";
import { createClient } from "@/lib/supabase/server";
import type { LibraryAssetUsage } from "@/lib/types/database.types";

export default async function PathTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: template },
    { data: nodes },
    { data: assets },
    { data: categories },
    { data: topics },
  ] = await Promise.all([
    supabase
      .from("path_templates")
      .select(
        "id, title, description, goal, duration_label, suggested_node_count, status",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("path_template_nodes")
      .select(
          "id, title, description, kind, week_number, duration_weeks, order_index, default_resource_url, library_asset_id, library_assets(title)",
        )
      .eq("template_id", id)
      .order("order_index", { ascending: true }),
    supabase
      .from("library_assets")
      .select("id, title, kind, usage, topic_id, url, tags")
      .is("archived_at", null)
      .order("title", { ascending: true }),
    supabase
      .from("library_categories")
      .select("id, name")
      .order("sort_index", { ascending: true }),
    supabase
      .from("library_topics")
      .select("id, category_id, name")
      .order("sort_index", { ascending: true }),
  ]);

  if (!template) notFound();

  const mappedNodes = (nodes ?? []).map((n) => {
    const asset = Array.isArray(n.library_assets)
      ? n.library_assets[0]
      : n.library_assets;
    return {
      id: n.id,
      title: n.title,
      description: n.description,
      kind: n.kind,
      week_number: n.week_number,
      duration_weeks: n.duration_weeks,
      order_index: n.order_index,
      default_resource_url: n.default_resource_url,
      library_asset_id: n.library_asset_id,
      asset_title: asset?.title ?? null,
    };
  });

  const pickerAssets = (assets ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    usage: a.usage as LibraryAssetUsage,
    topic_id: a.topic_id,
    url: a.url,
    tags: a.tags ?? [],
  }));

  return (
    <div className="space-y-6">
      <PathTemplateEditor
        template={template}
        nodes={mappedNodes}
        categories={categories ?? []}
        topics={topics ?? []}
        assets={pickerAssets}
      />
    </div>
  );
}
