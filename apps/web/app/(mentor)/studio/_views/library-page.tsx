import { redirect } from "next/navigation";

import { archiveLibraryAsset } from "@/lib/actions/library";
import { LibraryHub } from "@/components/library-hub";
import { LibraryAssetDialog } from "@/components/library-asset-dialog";
import {
  LibraryAssetDeleteButton,
  LibraryCategoryDialog,
  LibraryTopicDialog,
} from "@/components/library-taxonomy-dialogs";
import { PathTemplateComposer } from "@/components/path-template-composer";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { isReadyLibraryAsset } from "@/lib/library-ready";
import { LIBRARY_PATH } from "@/lib/library-routes";
import type { LibraryAssetUsage } from "@/lib/types/database.types";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ compose?: string; category?: string }>;
}) {
  const { compose, category } = await searchParams;
  const supabase = await createClient();

  const [
    { data: assets },
    { data: categories },
    { data: topics },
  ] = await Promise.all([
    supabase
      .from("library_assets")
      .select(
        "id, title, summary, kind, usage, topic_id, body, url, storage_path, tags, duration_label, archived_at, created_at, content_status, created_by_agent",
      )
      .eq("content_status", "ready")
      .order("created_at", { ascending: false }),
    supabase
      .from("library_categories")
      .select("id, name, slug, sort_index, theme")
      .order("sort_index", { ascending: true }),
    supabase
      .from("library_topics")
      .select("id, category_id, name, slug, sort_index, created_by_agent, rationale")
      .order("sort_index", { ascending: true }),
  ]);

  const cats = categories ?? [];
  const tops = topics ?? [];
  const readyAssets = (assets ?? []).filter(isReadyLibraryAsset);
  const activeAssets = readyAssets.filter((a) => !a.archived_at);
  const archivedAssets = readyAssets.filter((a) => a.archived_at);
  const libraryItems = activeAssets.filter((a) => a.topic_id);

  const topicById = new Map(tops.map((t) => [t.id, t]));
  const catById = new Map(cats.map((c) => [c.id, c]));

  const pickerCategories = cats.map((c) => ({ id: c.id, name: c.name }));
  const pickerTopics = tops.map((t) => ({
    id: t.id,
    category_id: t.category_id,
    name: t.name,
  }));
  const pickerAssets = activeAssets.map((a) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    usage: a.usage as LibraryAssetUsage,
    topic_id: a.topic_id,
    url: a.url,
    tags: a.tags ?? [],
  }));

  if (compose) {
    const [{ data: template }, { data: composeNodes }] = await Promise.all([
      supabase
        .from("path_templates")
        .select(
          "id, title, description, goal, duration_label, suggested_node_count, status, start_date, end_date, period_months",
        )
        .eq("id", compose)
        .maybeSingle(),
      supabase
        .from("path_template_nodes")
        .select(
          "id, title, description, kind, week_number, duration_weeks, order_index, default_resource_url, library_asset_id, library_assets(title)",
        )
        .eq("template_id", compose)
        .order("order_index", { ascending: true }),
    ]);

    if (template) {
      if (template.status === "archived") {
        redirect(LIBRARY_PATH);
      }

      const mappedNodes = (composeNodes ?? []).map((n) => {
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

      return (
        <PathTemplateComposer
          template={template}
          nodes={mappedNodes}
          categories={pickerCategories}
          topics={pickerTopics}
          assets={pickerAssets}
        />
      );
    }
  }

  if (category && !cats.some((c) => c.id === category)) {
    redirect(LIBRARY_PATH);
  }

  const activeCategory = category ? catById.get(category) : null;

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <PageHero eyebrow="Studio" title="Biblioteca" />

        <section id="biblioteca" className="scroll-mt-24 space-y-4 pt-1">
          <div className="flex flex-col gap-3 min-[950px]:flex-row min-[950px]:items-center min-[950px]:justify-between min-[950px]:gap-4">
            <h3 className="order-2 font-semibold min-[950px]:order-1">
              {activeCategory ? (
                <>
                  {activeCategory.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    (
                    {tops.filter((t) => t.category_id === activeCategory.id).length}{" "}
                    Tópicos,{" "}
                    {libraryItems.filter((a) => {
                      const t = a.topic_id ? topicById.get(a.topic_id) : null;
                      return t?.category_id === activeCategory.id;
                    }).length}{" "}
                    Itens)
                  </span>
                </>
              ) : (
                <>
                  Biblioteca{" "}
                  <span className="font-normal text-muted-foreground">
                    ({cats.length} Categorias, {tops.length} Tópicos,{" "}
                    {libraryItems.length} Itens)
                  </span>
                </>
              )}
            </h3>
            {!activeCategory ? (
              <div className="order-1 grid w-full grid-cols-3 gap-2 pt-1 min-[950px]:order-2 min-[950px]:w-auto min-[950px]:flex min-[950px]:pt-0">
                <div className="min-w-0 [&_button]:h-12 [&_button]:w-full min-[950px]:[&_button]:w-auto">
                  <LibraryCategoryDialog />
                </div>
                <div className="min-w-0 [&_button]:h-12 [&_button]:w-full min-[950px]:[&_button]:w-auto">
                  <LibraryTopicDialog categories={cats} />
                </div>
                <div className="min-w-0 [&_button]:h-12 [&_button]:w-full min-[950px]:[&_button]:w-auto">
                  <LibraryAssetDialog
                    categories={cats}
                    topics={tops}
                    triggerLabel="Item"
                    triggerVariant="outline"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {cats.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Começa por criar uma categoria (ex.: Teclado) e um tópico (ex.:
              Acordes). Depois adiciona itens (aulas, práticas, etc.) dentro do
              tópico.
            </Card>
          ) : (
            <LibraryHub
              categories={cats}
              topics={tops.map((t) => ({
                id: t.id,
                category_id: t.category_id,
                name: t.name,
                created_by_agent: t.created_by_agent,
              }))}
              items={libraryItems.map((a) => ({
                id: a.id,
                title: a.title,
                summary: a.summary,
                kind: a.kind,
                usage: a.usage,
                topic_id: a.topic_id,
                body: a.body,
                url: a.url,
                storage_path: a.storage_path,
                tags: a.tags ?? [],
                duration_label: a.duration_label,
              }))}
              categoryId={category}
            />
          )}

          {archivedAssets.length > 0 ? (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Arquivados ({archivedAssets.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {archivedAssets.map((a) => {
                  const topic = a.topic_id ? topicById.get(a.topic_id) : null;
                  const cat = topic ? catById.get(topic.category_id) : null;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/5 px-3 py-2"
                    >
                      <span className="truncate">
                        {a.title}
                        {cat ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {cat.name}
                            {topic ? ` / ${topic.name}` : ""}
                          </span>
                        ) : null}
                      </span>
                      <div className="flex gap-1">
                        <form action={archiveLibraryAsset}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="restore" value="1" />
                          <Button type="submit" size="sm" variant="ghost">
                            Restaurar
                          </Button>
                        </form>
                        <LibraryAssetDeleteButton assetId={a.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </div>
  );
}
