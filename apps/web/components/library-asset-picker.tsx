"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  File,
  FileText,
  ImageIcon,
  Link2,
  Search,
  Video,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { libraryAssetUsageLabel } from "@/lib/labels";
import { LIBRARY_PATH } from "@/lib/library-routes";
import type { LibraryAssetUsage, NodeKind } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

export type PickerCategory = { id: string; name: string };
export type PickerTopic = { id: string; category_id: string; name: string };
export type PickerAsset = {
  id: string;
  title: string;
  kind: string;
  usage: LibraryAssetUsage;
  topic_id: string | null;
  url: string | null;
  body?: string | null;
  tags: string[];
};

export type LibraryPickerSelection = {
  assetId: string;
  title: string;
  url: string | null;
  body: string | null;
};

type Props = {
  nodeKind: NodeKind;
  categories: PickerCategory[];
  topics: PickerTopic[];
  assets: PickerAsset[];
  value: string;
  onChange: (next: LibraryPickerSelection | null) => void;
  initialAssetId?: string | null;
};

const MAX_RESULTS = 60;

function usageForNodeKind(nodeKind: NodeKind): LibraryAssetUsage | null {
  if (nodeKind === "practice") return "practice";
  if (nodeKind === "lesson" || nodeKind === "resource") return "lesson";
  return null;
}

function KindIcon({ kind, className }: { kind: string; className?: string }) {
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
  return <Icon className={cn("size-3.5", className)} aria-hidden />;
}

/** Selected library item inside a level: icon, title, meta. No media preview. */
export function LibraryAssetItemCard({
  kind,
  title,
  meta,
  children,
  className,
}: {
  kind: string;
  title: string;
  meta?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl border border-[var(--neuma-coral)]/35 bg-[var(--neuma-coral)]/[0.07] px-3 py-2.5",
        className,
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-black/30">
        <KindIcon kind={kind} className="size-4 text-[var(--neuma-coral)]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {meta ? (
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function toSelection(a: PickerAsset): LibraryPickerSelection {
  return { assetId: a.id, title: a.title, url: a.url, body: a.body ?? null };
}

export function LibraryAssetPicker({
  nodeKind,
  categories,
  topics,
  assets,
  value,
  onChange,
  initialAssetId,
}: Props) {
  // "" is a clear. Nullish coalescing keeps that; `||` used to restore the
  // original item after Tipo changed or the mentor removed the pick.
  const selectedId = value ?? initialAssetId ?? "";
  const selected = selectedId ? assets.find((a) => a.id === selectedId) : null;
  const [browsing, setBrowsing] = useState(!selected);
  const [search, setSearch] = useState("");
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);

  const usageFilter = usageForNodeKind(nodeKind);
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const compatible = useMemo(
    () =>
      assets.filter(
        (a) => a.topic_id && (!usageFilter || a.usage === usageFilter),
      ),
    [assets, usageFilter],
  );

  const groups = useMemo(() => {
    const byTopic = new Map<string, PickerAsset[]>();
    for (const asset of compatible) {
      const topicId = asset.topic_id;
      if (!topicId) continue;
      const list = byTopic.get(topicId);
      if (list) list.push(asset);
      else byTopic.set(topicId, [asset]);
    }

    const rows: {
      topic: PickerTopic;
      categoryName: string;
      assets: PickerAsset[];
    }[] = [];
    const seen = new Set<string>();
    for (const category of categories) {
      for (const topic of topics) {
        if (topic.category_id !== category.id) continue;
        const items = byTopic.get(topic.id);
        if (!items?.length) continue;
        seen.add(topic.id);
        rows.push({ topic, categoryName: category.name, assets: items });
      }
    }
    for (const topic of topics) {
      if (seen.has(topic.id)) continue;
      const items = byTopic.get(topic.id);
      if (!items?.length) continue;
      const categoryName = categoryById.get(topic.category_id)?.name ?? "";
      rows.push({ topic, categoryName, assets: items });
    }
    return rows;
  }, [categories, categoryById, compatible, topics]);

  const query = search.trim().toLowerCase();

  function assetMatches(asset: PickerAsset) {
    return (
      asset.title.toLowerCase().includes(query) ||
      asset.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  const visibleGroups = groups.flatMap((group) => {
    if (openTopicId && group.topic.id !== openTopicId) return [];
    if (!query) return [{ ...group, items: group.assets }];
    if (openTopicId) {
      return [{ ...group, items: group.assets.filter(assetMatches) }];
    }
    const topicHit = group.topic.name.toLowerCase().includes(query);
    const itemHits = group.assets.filter(assetMatches);
    if (!topicHit && itemHits.length === 0) return [];
    return [{ ...group, items: topicHit && itemHits.length === 0 ? group.assets : itemHits }];
  });

  const visibleItemCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  function locationLabel(a: PickerAsset) {
    const topic = a.topic_id ? topicById.get(a.topic_id) : null;
    const category = topic ? categoryById.get(topic.category_id) : null;
    return [category?.name, topic?.name].filter(Boolean).join(" / ");
  }

  const itemNoun =
    usageFilter === "practice"
      ? "prática"
      : usageFilter === "lesson"
        ? "aula"
        : "item";

  function itemCountLabel(count: number) {
    const noun =
      count === 1
        ? itemNoun
        : usageFilter === "practice"
          ? "práticas"
          : usageFilter === "lesson"
            ? "aulas"
            : "itens";
    return `${count} ${noun}`;
  }

  return (
    <div className="min-w-0 space-y-3">
      {selected ? (
        <LibraryAssetItemCard
          kind={selected.kind}
          title={selected.title}
          meta={`${libraryAssetUsageLabel[selected.usage]} · ${locationLabel(selected)}`}
        >
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setBrowsing((open) => !open)}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground hover:bg-white/10"
            >
              {browsing ? "Fechar" : "Trocar"}
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setBrowsing(true);
              }}
              aria-label="Remover item"
              className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </LibraryAssetItemCard>
      ) : selectedId ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-muted-foreground">
          O item ligado a este nível foi arquivado ou não é compatível com o tipo
          de nível. Escolhe outro.
        </p>
      ) : null}

      {browsing || !selected ? (
        <div className="min-w-0 space-y-2.5 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="picker-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder={
                openTopicId
                  ? `Procurar ${itemNoun} neste tópico…`
                  : `Procurar ${itemNoun} por título ou tópico…`
              }
              className="h-10 rounded-xl pl-9 text-sm"
              aria-label="Procurar na biblioteca"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {openTopicId || query
              ? `${visibleItemCount} resultado${visibleItemCount === 1 ? "" : "s"}`
              : `${groups.length} tópico${groups.length === 1 ? "" : "s"}`}
          </p>

          {compatible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-muted-foreground">
              Ainda não há{" "}
              {usageFilter === "practice"
                ? "práticas"
                : usageFilter === "lesson"
                  ? "aulas"
                  : "itens"}{" "}
              na biblioteca.{" "}
              <Link href={LIBRARY_PATH} className="underline hover:text-foreground">
                Abrir biblioteca
              </Link>
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum item corresponde à pesquisa.
            </div>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
              {visibleGroups.map((group) => {
                const expanded = openTopicId === group.topic.id || (query.length > 0 && !openTopicId);
                const count = itemCountLabel(group.assets.length);
                return (
                  <li key={group.topic.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() =>
                        setOpenTopicId((current) =>
                          current === group.topic.id ? null : group.topic.id,
                        )
                      }
                      className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {group.topic.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {group.categoryName ? `${group.categoryName} · ${count}` : count}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </button>
                    {expanded ? (
                      group.items.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          Nenhum item neste tópico.
                        </p>
                      ) : (
                        <ul className="space-y-0.5 pb-1 pl-3">
                          {group.items.slice(0, MAX_RESULTS).map((a) => {
                            const isSelected = a.id === selectedId;
                            const meta = !usageFilter
                              ? libraryAssetUsageLabel[a.usage]
                              : null;
                            return (
                              <li key={a.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onChange(toSelection(a));
                                    setBrowsing(false);
                                  }}
                                  className={cn(
                                    "flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                                    isSelected
                                      ? "bg-[var(--neuma-coral)]/12"
                                      : "hover:bg-white/[0.05]",
                                  )}
                                >
                                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/30">
                                    <KindIcon kind={a.kind} className="text-muted-foreground" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm">{a.title}</span>
                                    {meta ? (
                                      <span className="block truncate text-xs text-muted-foreground">
                                        {meta}
                                      </span>
                                    ) : null}
                                  </span>
                                  {isSelected ? (
                                    <Check className="size-4 shrink-0 text-[var(--neuma-coral)]" />
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
