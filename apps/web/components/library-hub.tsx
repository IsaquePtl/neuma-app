"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Search } from "lucide-react";

import { CategoryThemeIcon } from "@/components/category-theme-icon";
import { LibraryAssetDialog } from "@/components/library-asset-dialog";
import {
  LibraryCategoryActions,
  LibraryTopicDeleteButton,
} from "@/components/library-taxonomy-dialogs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { libraryAssetKindLabel, libraryAssetUsageLabel } from "@/lib/labels";
import {
  CATEGORY_THEMES,
  categoryThemeWash,
  inferCategoryTheme,
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
          className="overflow-hidden border-white/10 p-4 shadow-none backdrop-blur-none"
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
            <LibraryCategoryActions category={activeCategory} />
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

        {categoryTopics.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Sem tópicos nesta categoria. Usa o botão Tópico acima para criar um.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {categoryTopics.map((topic) => {
              const topicItems = items.filter((a) => a.topic_id === topic.id);
              const visibleItems = topicItems.filter((a) =>
                itemMatchesSearch(a, searchQuery),
              );
              if (searchQuery && visibleItems.length === 0) return null;

              const expanded =
                searchQuery.length > 0 || openTopics.has(topic.id);

              return (
                <Card key={topic.id} className="overflow-hidden p-0">
                  <button
                    type="button"
                    onClick={() => toggleTopic(topic.id)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{topic.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {topicItems.length} item
                        {topicItems.length === 1 ? "" : "s"}
                        {topic.created_by_agent ? (
                          <span className="ml-1 uppercase text-amber-500">
                            agent
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <LibraryTopicDeleteButton topicId={topic.id} />
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-white/5">
                      {visibleItems.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">
                          Sem itens neste tópico.
                        </p>
                      ) : (
                        <ul className="divide-y divide-white/5">
                          {visibleItems.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center justify-between gap-2 px-4 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {a.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {libraryAssetUsageLabel[a.usage]} ·{" "}
                                  {libraryAssetKindLabel[a.kind]}
                                  {a.duration_label
                                    ? ` · ${a.duration_label}`
                                    : ""}
                                </p>
                              </div>
                              <LibraryAssetDialog
                                asset={a}
                                categories={categories}
                                topics={topics}
                              />
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

        {searchQuery &&
        categoryTopics.every(
          (t) =>
            items.filter(
              (a) =>
                a.topic_id === t.id && itemMatchesSearch(a, searchQuery),
            ).length === 0,
        ) ? (
          <p className="text-sm text-muted-foreground">
            Nenhum item corresponde a «{searchQuery}».
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
            className="cursor-pointer space-y-2 overflow-hidden border-white/10 p-4 shadow-none backdrop-blur-none transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
                <LibraryCategoryActions category={cat} />
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
