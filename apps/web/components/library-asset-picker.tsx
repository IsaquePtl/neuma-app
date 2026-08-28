"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { LibraryAssetUsage, NodeKind } from "@/lib/types/database.types";

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

function resolveInitial(
  assets: PickerAsset[],
  topics: PickerTopic[],
  assetId: string | null | undefined,
) {
  if (!assetId) return { categoryId: "", topicId: "", assetId: "" };
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) return { categoryId: "", topicId: "", assetId };
  const topic = topics.find((t) => t.id === asset.topic_id);
  return {
    categoryId: topic?.category_id ?? "",
    topicId: asset.topic_id ?? "",
    assetId,
  };
}

function usageForNodeKind(nodeKind: NodeKind): LibraryAssetUsage | null {
  if (nodeKind === "practice") return "practice";
  if (nodeKind === "lesson" || nodeKind === "resource") return "lesson";
  return null;
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
  const seed = resolveInitial(assets, topics, initialAssetId ?? value);
  const [categoryId, setCategoryId] = useState(seed.categoryId);
  const [topicId, setTopicId] = useState(seed.topicId);
  const [search, setSearch] = useState("");

  const usageFilter = usageForNodeKind(nodeKind);

  const topicsForCategory = useMemo(
    () => topics.filter((t) => t.category_id === categoryId),
    [topics, categoryId],
  );

  const itemsForTopic = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (a.topic_id !== topicId) return false;
      if (usageFilter && a.usage !== usageFilter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
      );
    });
  }, [assets, topicId, usageFilter, search]);

  const supportItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (!a.topic_id) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
      );
    });
  }, [assets, search]);

  const pickerLabel =
    nodeKind === "practice"
      ? "Item de prática"
      : nodeKind === "call" || nodeKind === "milestone"
        ? "Anexo de apoio"
        : "Item";

  if (nodeKind === "call" || nodeKind === "milestone") {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
          {nodeKind === "call"
            ? "Anexo de apoio (opcional) — não é o foco; a sessão é o Meet."
            : "Material de apoio ao check-point (opcional)."}
        </p>
        <div className="space-y-2">
          <Label htmlFor="picker-support-search">Filtrar biblioteca</Label>
          <Input
            id="picker-support-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por título ou tag…"
          />
        </div>
        <select
          value={value}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              onChange(null);
              return;
            }
            const a = assets.find((x) => x.id === id);
            onChange(
              a
                ? {
                    assetId: a.id,
                    title: a.title,
                    url: a.url,
                    body: a.body ?? null,
                  }
                : null,
            );
          }}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">— sem anexo —</option>
          {supportItems.map((a) => (
            <option key={a.id} value={a.id}>
              [{a.usage}/{a.kind}] {a.title}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="picker-cat">Categoria</Label>
        <select
          id="picker-cat"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setTopicId("");
            onChange(null);
          }}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">— escolher categoria —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="picker-topic">Tópico</Label>
        <select
          id="picker-topic"
          value={topicId}
          disabled={!categoryId}
          onChange={(e) => {
            setTopicId(e.target.value);
            onChange(null);
          }}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-50"
        >
          <option value="">— escolher tópico —</option>
          {topicsForCategory.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="picker-item">{pickerLabel}</Label>
        <Input
          id="picker-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por título ou tag…"
          disabled={!topicId}
          className="mb-2 disabled:opacity-50"
        />
        <select
          id="picker-item"
          value={value}
          disabled={!topicId}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              onChange(null);
              return;
            }
            const a = assets.find((x) => x.id === id);
            onChange(
              a
                ? {
                    assetId: a.id,
                    title: a.title,
                    url: a.url,
                    body: a.body ?? null,
                  }
                : null,
            );
          }}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-50"
        >
          <option value="">— escolher item —</option>
          {itemsForTopic.map((a) => (
            <option key={a.id} value={a.id}>
              [{a.kind}] {a.title}
            </option>
          ))}
        </select>
      </div>

      {categories.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Cria categorias e tópicos em Biblioteca, depois adiciona itens com + Item.
        </p>
      ) : itemsForTopic.length === 0 && topicId ? (
        <p className="text-xs text-muted-foreground">
          Sem itens compatíveis neste tópico. Adiciona um em Biblioteca → + Item.
        </p>
      ) : null}
    </div>
  );
}
