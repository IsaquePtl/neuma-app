import {
  Archive,
  ArrowRight,
} from "lucide-react";

import { archiveLibraryAsset } from "@/lib/actions/library";
import { LibraryAssetDialog } from "@/components/library-asset-dialog";
import {
  LibraryAssetDeleteButton,
  LibraryCategoryDialog,
  LibraryCategoryActions,
  LibraryTopicDialog,
  LibraryTopicDeleteButton,
} from "@/components/library-taxonomy-dialogs";
import { PathTemplateComposer } from "@/components/path-template-composer";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { libraryAssetKindLabel } from "@/lib/labels";
import { isReadyLibraryAsset } from "@/lib/library-ready";
import type { LibraryAssetUsage } from "@/lib/types/database.types";
import { CategoryThemeIcon } from "@/components/category-theme-icon";
import {
  CATEGORY_THEMES,
  categoryThemeWash,
  inferCategoryTheme,
} from "@/lib/brand-themes";

export default async function PathsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ compose?: string }>;
}) {
  const { compose } = await searchParams;
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
  // Cascas Agent (empty/drafting) nunca entram aqui — só ready.
  const readyAssets = (assets ?? []).filter(isReadyLibraryAsset);
  const activeAssets = readyAssets.filter((a) => !a.archived_at);
  const archivedAssets = readyAssets.filter((a) => a.archived_at);
  const lessonAssets = activeAssets.filter((a) => a.usage === "lesson");
  const practiceAssets = activeAssets.filter((a) => a.usage === "practice");

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

  return (
    <div className="space-y-10">
      <div className="space-y-3">
      <PageHero
        eyebrow="Studio"
        title="Biblioteca"
        subtitle="Só material pronto a reutilizar. Cascas do Agent ficam nos Agents e no percurso até confirmares."
      />

      <section id="biblioteca" className="scroll-mt-24 space-y-3">
        <div id="lessons" className="scroll-mt-24 space-y-4 pt-1">
          <div className="flex flex-col gap-3 min-[950px]:flex-row min-[950px]:items-center min-[950px]:justify-between min-[950px]:gap-4">
            <h3 className="order-2 font-semibold min-[950px]:order-1">
              Biblioteca{" "}
              <span className="font-normal text-muted-foreground">
                ({cats.length} Categorias, {tops.length} Tópicos,{" "}
                {lessonAssets.length} aulas)
              </span>
            </h3>
            <div className="order-1 grid w-full grid-cols-3 gap-2 pt-1 min-[950px]:order-2 min-[950px]:w-auto min-[950px]:flex min-[950px]:pt-0">
              <div className="min-w-0 [&_button]:h-12 [&_button]:w-full min-[950px]:[&_button]:w-auto">
                <LibraryCategoryDialog />
              </div>
              <div className="min-w-0 [&_button]:h-12 [&_button]:w-full min-[950px]:[&_button]:w-auto">
                <LibraryTopicDialog categories={cats} />
              </div>
              <div className="min-w-0 [&_button]:h-12 [&_button]:w-full min-[950px]:[&_button]:w-auto">
                <LibraryAssetDialog
                  defaultUsage="lesson"
                  categories={cats}
                  topics={tops}
                  triggerLabel="Aula"
                  triggerVariant="outline"
                />
              </div>
            </div>
          </div>

          {cats.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Começa por criar uma categoria (ex.: Teclado) e um tópico (ex.:
              Acordes). Depois adiciona aulas dentro do tópico.
            </Card>
          ) : (
            <div className="space-y-4">
              {cats.map((cat) => {
                const catTopics = tops.filter((t) => t.category_id === cat.id);
                const theme = inferCategoryTheme(cat);
                const wash = theme
                  ? categoryThemeWash(CATEGORY_THEMES[theme].color)
                  : "linear-gradient(155deg, #1f1f1f 0%, #161616 100%)";
                return (
                  <Card
                    key={cat.id}
                    className="space-y-3 overflow-hidden border-white/10 p-4 shadow-none backdrop-blur-none"
                    style={{ background: wash }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-2 truncate font-medium">
                        <CategoryThemeIcon
                          theme={cat.theme}
                          slug={cat.slug}
                          name={cat.name}
                          size={32}
                        />
                        <span className="truncate">{cat.name}</span>
                      </p>
                      <LibraryCategoryActions category={cat} />
                    </div>
                    {catTopics.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sem tópicos nesta categoria.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {catTopics.map((topic) => {
                          const items = lessonAssets.filter(
                            (a) => a.topic_id === topic.id,
                          );
                          return (
                            <div key={topic.id} className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm text-muted-foreground">
                                  {topic.name}{" "}
                                  <span className="tabular-nums">
                                    ({items.length})
                                  </span>
                                  {topic.created_by_agent ? (
                                    <span className="ml-1 text-[10px] uppercase text-amber-500">
                                      agent
                                    </span>
                                  ) : null}
                                </p>
                                <LibraryTopicDeleteButton topicId={topic.id} />
                              </div>
                              {items.length === 0 ? (
                                <p className="text-xs text-muted-foreground pl-1">
                                  Sem aulas neste tópico.
                                </p>
                              ) : (
                                <ul className="divide-y divide-white/5 rounded-lg border border-white/5">
                                  {items.map((a) => (
                                    <li
                                      key={a.id}
                                      className="flex items-center justify-between gap-2 px-3 py-2"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                          {a.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {libraryAssetKindLabel[a.kind]}
                                          {a.duration_label
                                            ? ` · ${a.duration_label}`
                                            : ""}
                                        </p>
                                      </div>
                                      <LibraryAssetDialog
                                        asset={{
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
                                        }}
                                        categories={cats}
                                        topics={tops}
                                      />
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div id="practice" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              Prática{" "}
              <span className="text-muted-foreground">
                ({practiceAssets.length})
              </span>
            </h3>
            <LibraryAssetDialog
              defaultUsage="practice"
              categories={cats}
              topics={tops}
              triggerLabel="Adicionar prática"
            />
          </div>

          {practiceAssets.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Drills, backing tracks, PDFs — materiais práticos (sem árvore de
              aulas).
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {practiceAssets.map((a) => (
                <Card key={a.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {libraryAssetKindLabel[a.kind]}
                        {a.duration_label ? ` · ${a.duration_label}` : ""}
                      </p>
                      <p className="truncate font-medium">{a.title}</p>
                      {(a.tags ?? []).length > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(a.tags ?? []).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <LibraryAssetDialog
                      asset={{
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
                      }}
                      categories={cats}
                      topics={tops}
                    />
                  </div>
                  <div className="mt-auto flex gap-2 border-t border-white/5 pt-3">
                    {a.url ? (
                      <Button
                        render={
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                        nativeButton={false}
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                      >
                        Abrir <ArrowRight className="size-3.5" />
                      </Button>
                    ) : null}
                    <form action={archiveLibraryAsset} className="ml-auto">
                      <input type="hidden" name="id" value={a.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        <Archive className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

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
