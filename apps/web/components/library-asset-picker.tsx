"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Check,
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

const filterSelectClass =
  "h-10 w-full min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground";

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
  const [categoryId, setCategoryId] = useState("");
  const [topicId, setTopicId] = useState("");

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

  const categoriesWithItems = useMemo(() => {
    const ids = new Set(
      compatible
        .map((a) => topicById.get(a.topic_id!)?.category_id)
        .filter(Boolean) as string[],
    );
    return categories.filter((c) => ids.has(c.id));
  }, [categories, compatible, topicById]);

  const topicsWithItems = useMemo(() => {
    if (!categoryId) return [];
    const ids = new Set(compatible.map((a) => a.topic_id));
    return topics.filter((t) => t.category_id === categoryId && ids.has(t.id));
  }, [categoryId, compatible, topics]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return compatible.filter((a) => {
      const topic = topicById.get(a.topic_id!);
      if (categoryId && topic?.category_id !== categoryId) return false;
      if (topicId && a.topic_id !== topicId) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        (topic?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [compatible, search, categoryId, topicId, topicById]);

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
        : "item de apoio";

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
              placeholder={`Procurar ${itemNoun} por título, tópico ou tag…`}
              className="h-10 rounded-xl pl-9 text-sm"
              aria-label="Procurar na biblioteca"
            />
          </div>

          {categoriesWithItems.length > 1 ? (
            <select
              aria-label="Categoria"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setTopicId("");
              }}
              className={filterSelectClass}
            >
              <option value="">Todas</option>
              {categoriesWithItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}

          {topicsWithItems.length > 1 ? (
            <select
              aria-label="Tópico"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className={filterSelectClass}
            >
              <option value="">Todos os tópicos</option>
              {topicsWithItems.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : null}

          <p className="text-sm text-muted-foreground">
            {results.length} resultado{results.length === 1 ? "" : "s"}
          </p>

          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-muted-foreground">
              {compatible.length === 0 ? (
                <>
                  Ainda não há {itemNoun}s na biblioteca.{" "}
                  <Link href={LIBRARY_PATH} className="underline hover:text-foreground">
                    Abrir biblioteca
                  </Link>
                </>
              ) : (
                "Nenhum item corresponde aos filtros."
              )}
            </div>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
              {results.slice(0, MAX_RESULTS).map((a) => {
                const isSelected = a.id === selectedId;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(toSelection(a));
                        setBrowsing(false);
                      }}
                      className={cn(
                        "flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
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
                        <span className="block truncate text-xs text-muted-foreground">
                          {!usageFilter
                            ? `${libraryAssetUsageLabel[a.usage]} · `
                            : null}
                          {locationLabel(a)}
                          {a.tags.length > 0
                            ? ` · ${a.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}`
                            : null}
                        </span>
                      </span>
                      {isSelected ? (
                        <Check className="size-4 shrink-0 text-[var(--neuma-coral)]" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {results.length > MAX_RESULTS ? (
                <li className="px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  +{results.length - MAX_RESULTS} itens — refina a pesquisa.
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
