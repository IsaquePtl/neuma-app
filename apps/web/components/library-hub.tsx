"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  File,
  FileText,
  Folder,
  FolderOpen,
  ImageIcon,
  Link2,
  Search,
  Video,
} from "lucide-react";

import { CategoryThemeIcon } from "@/components/category-theme-icon";
import { LibraryAssetDialog } from "@/components/library-asset-dialog";
import {
  LibraryCategoryActions,
  LibraryItemMenu,
  LibraryTopicActions,
  LibraryTopicDialog,
} from "@/components/library-taxonomy-dialogs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { libraryAssetKindLabel, libraryAssetUsageLabel } from "@/lib/labels";
import {
  CATEGORY_THEMES,
  categoryThemeWash,
  inferCategoryTheme,
  isCategoryTheme,
} from "@/lib/brand-themes";
import { LIBRARY_PATH } from "@/lib/library-routes";
import type {
  LibraryAssetKind,
  LibraryAssetUsage,
} from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

export type LibraryCategoryRow = {
  id: string;
  name: string;
  slug: string;
  theme: string | null;
};

function categoryForActions(cat: LibraryCategoryRow) {
  return {
    ...cat,
    theme: isCategoryTheme(cat.theme) ? cat.theme : null,
  };
}

export type LibraryTopicRow = {
  id: string;
  category_id: string;
  name: string;
  created_by_agent: boolean;
};

export type LibraryItemRow = {
  id: string;
  title: string;
  summary: string | null;
  kind: LibraryAssetKind;
  usage: LibraryAssetUsage;
  topic_id: string | null;
  body: string | null;
  url: string | null;
  storage_path: string | null;
  tags: string[];
  duration_label: string | null;
};

type Props = {
  categories: LibraryCategoryRow[];
  topics: LibraryTopicRow[];
  items: LibraryItemRow[];
  categoryId?: string | null;
};

type UsageFilter = "all" | LibraryAssetUsage;

const USAGE_FILTERS: { id: UsageFilter; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "lesson", label: "Aulas" },
  { id: "practice", label: "Práticas" },
];

function AssetKindIcon({ kind }: { kind: LibraryAssetKind }) {
  const Icon =
    kind === "video"
      ? Video
      : kind === "image"
        ? ImageIcon
        : kind === "link"
          ? Link2
          : kind === "file"
            ? File
            : FileText;
  return <Icon className="size-3.5 text-muted-foreground" aria-hidden />;
}

function itemMatchesSearch(item: LibraryItemRow, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    (item.summary?.toLowerCase().includes(q) ?? false) ||
    item.tags.some((t) => t.toLowerCase().includes(q)) ||
    libraryAssetUsageLabel[item.usage].toLowerCase().includes(q) ||
    libraryAssetKindLabel[item.kind].toLowerCase().includes(q)
  );
}

export function LibraryHub({ categories, topics, items, categoryId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [openTopics, setOpenTopics] = useState<Set<string>>(() => new Set());
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");

  const activeCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : null;

  const categoryTopics = useMemo(
    () =>
      activeCategory
        ? topics.filter((t) => t.category_id === activeCategory.id)
        : [],
    [topics, activeCategory],
  );

  const searchQuery = search.trim();
  const allOpen =
    categoryTopics.length > 0 &&
    categoryTopics.every((t) => openTopics.has(t.id));

  function toggleTopic(topicId: string) {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }

  if (activeCategory) {
    const theme = inferCategoryTheme(activeCategory);
    const wash = theme
      ? categoryThemeWash(CATEGORY_THEMES[theme].color)
      : "linear-gradient(155deg, #1f1f1f 0%, #161616 100%)";

    return (
      <div className="space-y-4">
        <Link
          href={LIBRARY_PATH}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Biblioteca
        </Link>

        <Card
          className="overflow-hidden border-0 p-4 shadow-none backdrop-blur-none"
          style={{ background: wash }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 truncate text-lg font-semibold">
              <CategoryThemeIcon
                theme={activeCategory.theme}
                slug={activeCategory.slug}
                name={activeCategory.name}
                size={36}
              />
              <span className="truncate">{activeCategory.name}</span>
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <LibraryTopicDialog
                categories={categories}
                defaultCategoryId={activeCategory.id}
                triggerSize="sm"
              />
              <LibraryAssetDialog
                categories={categories}
                topics={topics}
                defaultCategoryId={activeCategory.id}
                triggerLabel="Item"
                triggerVariant="outline"
                triggerSize="sm"
              />
              <LibraryCategoryActions
                category={categoryForActions(activeCategory)}
              />
            </div>
          </div>
        </Card>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar itens nesta categoria…"
            className="pl-9"
            aria-label="Pesquisar itens"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {USAGE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setUsageFilter(f.id)}
              aria-pressed={usageFilter === f.id}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                usageFilter === f.id
                  ? "border-[var(--neuma-coral)]/60 bg-[var(--neuma-coral)]/15 text-foreground"
                  : "border-white/10 text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          {categoryTopics.length > 1 ? (
            <button
              type="button"
              onClick={() =>
                setOpenTopics(
                  allOpen ? new Set() : new Set(categoryTopics.map((t) => t.id)),
                )
              }
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              {allOpen ? "Fechar todos" : "Abrir todos"}
            </button>
          ) : null}
        </div>

        {categoryTopics.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 p-6 text-sm text-muted-foreground">
            <span>
              Esta categoria ainda não tem tópicos. Cria pastas (ex.: Acordes,
              Escalas) para organizar os itens.
            </span>
            <LibraryTopicDialog
              categories={categories}
              defaultCategoryId={activeCategory.id}
              triggerSize="sm"
            />
          </Card>
        ) : (
          <div className="flex w-full flex-col gap-2.5">
            {categoryTopics.map((topic, topicIndex) => {
              const topicItems = items.filter((a) => a.topic_id === topic.id);
              const visibleItems = topicItems.filter(
                (a) =>
                  itemMatchesSearch(a, searchQuery) &&
                  (usageFilter === "all" || a.usage === usageFilter),
              );
              const filtering = searchQuery.length > 0 || usageFilter !== "all";
              if (filtering && visibleItems.length === 0) return null;

              const expanded = searchQuery.length > 0 || openTopics.has(topic.id);
              const lessons = topicItems.filter((a) => a.usage === "lesson").length;
              const practices = topicItems.length - lessons;

              return (
                <Card
                  key={topic.id}
                  className={cn(
                    "w-full gap-0 overflow-hidden rounded-2xl p-0 transition-colors",
                    expanded && "ring-1 ring-white/12",
                  )}
                >
                  <div className="flex w-full flex-nowrap items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3">
                    <button
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-muted-foreground">
                        {expanded ? (
                          <FolderOpen className="size-4" aria-hidden />
                        ) : (
                          <Folder className="size-4" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{topic.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {topicItems.length === 0
                            ? "Vazio"
                            : [
                                lessons ? `${lessons} aula${lessons === 1 ? "" : "s"}` : null,
                                practices
                                  ? `${practices} prática${practices === 1 ? "" : "s"}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <LibraryAssetDialog
                        categories={categories}
                        topics={topics}
                        defaultCategoryId={activeCategory.id}
                        defaultTopicId={topic.id}
                        triggerLabel="Item"
                        triggerVariant="ghost"
                        triggerSize="sm"
                        compactOnMobile
                      />
                      <LibraryTopicActions
                        topic={topic}
                        categories={categories}
                        itemCount={topicItems.length}
                        isFirst={topicIndex === 0}
                        isLast={topicIndex === categoryTopics.length - 1}
                      />
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-white/5 p-2">
                      {visibleItems.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-muted-foreground">
                          Sem itens nesta pasta. Usa “Item” para adicionar.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {visibleItems.map((a) => (
                            <li
                              key={a.id}
                              className="group/item flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]"
                            >
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/30">
                                <AssetKindIcon kind={a.kind} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {a.title}
                                </p>
                                <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                                  <span
                                    className={cn(
                                      "font-medium",
                                      a.usage === "practice"
                                        ? "text-sky-300"
                                        : "text-[var(--neuma-coral)]",
                                    )}
                                  >
                                    {libraryAssetUsageLabel[a.usage]}
                                  </span>
                                  <span aria-hidden>·</span>
                                  <span>{libraryAssetKindLabel[a.kind]}</span>
                                  {a.duration_label ? (
                                    <>
                                      <span aria-hidden>·</span>
                                      <span>{a.duration_label}</span>
                                    </>
                                  ) : null}
                                  {a.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10px]"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center">
                                <LibraryAssetDialog
                                  asset={a}
                                  categories={categories}
                                  topics={topics}
                                />
                                <LibraryItemMenu assetId={a.id} title={a.title} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}

        {(searchQuery || usageFilter !== "all") &&
        categoryTopics.length > 0 &&
        categoryTopics.every(
          (t) =>
            items.filter(
              (a) =>
                a.topic_id === t.id &&
                itemMatchesSearch(a, searchQuery) &&
                (usageFilter === "all" || a.usage === usageFilter),
            ).length === 0,
        ) ? (
          <p className="text-sm text-muted-foreground">
            Nenhum item corresponde aos filtros.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((cat) => {
        const catTopics = topics.filter((t) => t.category_id === cat.id);
        const catItems = items.filter((a) =>
          catTopics.some((t) => t.id === a.topic_id),
        );
        const theme = inferCategoryTheme(cat);
        const wash = theme
          ? categoryThemeWash(CATEGORY_THEMES[theme].color)
          : "linear-gradient(155deg, #1f1f1f 0%, #161616 100%)";

        return (
          <Card
            key={cat.id}
            role="button"
            tabIndex={0}
            className="cursor-pointer space-y-2 overflow-hidden border-0 p-4 shadow-none backdrop-blur-none transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            style={{ background: wash }}
            onClick={() =>
              router.push(`${LIBRARY_PATH}?category=${encodeURIComponent(cat.id)}`)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(
                  `${LIBRARY_PATH}?category=${encodeURIComponent(cat.id)}`,
                );
              }
            }}
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
              <div
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <LibraryCategoryActions category={categoryForActions(cat)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {catTopics.length} tópico{catTopics.length === 1 ? "" : "s"} ·{" "}
              {catItems.length} item{catItems.length === 1 ? "" : "s"}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
