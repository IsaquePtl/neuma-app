"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { LibraryAssetDialog } from "@/components/library-asset-dialog";
import { LibraryTopicDeleteButton } from "@/components/library-taxonomy-dialogs";
import type {
  LibraryAssetKind,
  LibraryAssetUsage,
} from "@/lib/types/database.types";

type GapTopic = {
  id: string;
  name: string;
  rationale: string | null;
  category_name?: string;
};

type GapAsset = {
  id: string;
  title: string;
  summary: string | null;
  usage: LibraryAssetUsage | string;
  kind: LibraryAssetKind | string;
  topic_id: string | null;
  body: string | null;
  url: string | null;
  storage_path: string | null;
  tags: string[];
  duration_label: string | null;
};

type Category = { id: string; name: string };
type Topic = { id: string; category_id: string; name: string };

export function LibraryAgentNeedsYou({
  topics,
  assets,
  categories = [],
  libraryTopics = [],
  pathId,
  pathTitle,
}: {
  topics: GapTopic[];
  assets: GapAsset[];
  categories?: Category[];
  libraryTopics?: Topic[];
  pathId?: string;
  pathTitle?: string;
}) {
  if (topics.length === 0 && assets.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="font-medium">
              {pathTitle ? `Cascas por preencher · ${pathTitle}` : "O Agent precisa de ti"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {pathTitle
                ? "Níveis deste percurso ainda sem material na Biblioteca. Grava, anexa ou confirma no nível."
                : "Cascas vazias dos percursos — ainda não entram na Biblioteca. Grava, anexa ou confirma no nível; só material pronto é reutilizável."}
            </p>
          </div>
          {topics.length > 0 && (
            <ul className="space-y-2 text-sm">
              {topics.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-2 rounded-lg bg-background/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {t.category_name ? `${t.category_name} · ` : ""}
                      {t.name}
                    </p>
                    {t.rationale && (
                      <p className="text-xs text-muted-foreground">
                        {t.rationale}
                      </p>
                    )}
                  </div>
                  <LibraryTopicDeleteButton topicId={t.id} />
                </li>
              ))}
            </ul>
          )}
          {assets.length > 0 && (
            <ul className="divide-y divide-amber-500/10 rounded-lg border border-amber-500/15 bg-background/40">
              {assets.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      [{a.usage}/{a.kind}]
                    </p>
                  </div>
                  <LibraryAssetDialog
                    asset={{
                      id: a.id,
                      title: a.title,
                      summary: a.summary,
                      kind: a.kind as LibraryAssetKind,
                      usage: a.usage as LibraryAssetUsage,
                      topic_id: a.topic_id,
                      body: a.body,
                      url: a.url,
                      storage_path: a.storage_path,
                      tags: a.tags,
                      duration_label: a.duration_label,
                    }}
                    categories={categories}
                    topics={libraryTopics}
                    triggerLabel="Completar"
                    triggerVariant="outline"
                  />
                </li>
              ))}
            </ul>
          )}
          <Link
            href={pathId ? `/studio/journeys/${pathId}` : "/studio/journeys#agent-paths"}
            className="text-sm underline underline-offset-4"
          >
            {pathId ? "Abrir percurso" : "Ver percursos do Agent"}
          </Link>
        </div>
      </div>
    </section>
  );
}
