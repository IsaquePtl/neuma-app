import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../types/database.types";
import {
  QA_CATEGORY_NAME,
  QA_CATEGORY_SLUG,
  QA_STUB_TEXT_BODY,
  QA_STUB_VIDEO_LESSON,
  QA_STUB_VIDEO_PRACTICE,
  QA_TOPIC_NAME,
  QA_TOPIC_SLUG,
  type QaAssetKey,
} from "./curriculum";

export type QaLibraryClient = SupabaseClient<Database>;

export type QaReadyAssets = Record<QaAssetKey, { id: string; url: string | null; body: string | null }>;

async function upsertCategory(supabase: QaLibraryClient) {
  const { data: existing } = await supabase
    .from("library_categories")
    .select("id")
    .eq("slug", QA_CATEGORY_SLUG)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: last } = await supabase
    .from("library_categories")
    .select("sort_index")
    .order("sort_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("library_categories")
    .insert({
      name: QA_CATEGORY_NAME,
      slug: QA_CATEGORY_SLUG,
      sort_index: (last?.sort_index ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "Falha a criar categoria QA");
  }
  return created.id;
}

async function upsertTopic(
  supabase: QaLibraryClient,
  categoryId: string,
) {
  const { data: existing } = await supabase
    .from("library_topics")
    .select("id")
    .eq("category_id", categoryId)
    .eq("slug", QA_TOPIC_SLUG)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("library_topics")
    .insert({
      category_id: categoryId,
      name: QA_TOPIC_NAME,
      slug: QA_TOPIC_SLUG,
      sort_index: 0,
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "Falha a criar tópico QA");
  }
  return created.id;
}

async function upsertAsset(
  supabase: QaLibraryClient,
  createdBy: string | null,
  topicId: string,
  spec: {
    title: string;
    kind: "video" | "text";
    usage: "lesson" | "practice";
    url: string | null;
    body: string | null;
  },
) {
  const { data: existing } = await supabase
    .from("library_assets")
    .select("id, url, body")
    .eq("title", spec.title)
    .eq("topic_id", topicId)
    .is("archived_at", null)
    .maybeSingle();

  const payload = {
    title: spec.title,
    summary: "Stub QA — conteúdo placeholder para o picker e percursos de teste.",
    kind: spec.kind,
    usage: spec.usage,
    topic_id: topicId,
    url: spec.url,
    body: spec.body,
    tags: ["qa", "stub"],
    content_status: "ready" as const,
    created_by_agent: false,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("library_assets")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id, url: spec.url, body: spec.body };
  }

  const { data: created, error } = await supabase
    .from("library_assets")
    .insert({ ...payload, created_by: createdBy })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? `Falha a criar asset ${spec.title}`);
  }
  return { id: created.id, url: spec.url, body: spec.body };
}

/** Ensures picker has ≥1 video lesson, 1 video practice, 1 text (ready). */
export async function upsertQaReadyLibrary(
  supabase: QaLibraryClient,
  createdBy: string | null,
): Promise<{ categoryId: string; topicId: string; assets: QaReadyAssets }> {
  const categoryId = await upsertCategory(supabase);
  const topicId = await upsertTopic(supabase, categoryId);

  const [videoLesson, videoPractice, text] = await Promise.all([
    upsertAsset(supabase, createdBy, topicId, {
      title: "QA stub — aula vídeo",
      kind: "video",
      usage: "lesson",
      url: QA_STUB_VIDEO_LESSON,
      body: null,
    }),
    upsertAsset(supabase, createdBy, topicId, {
      title: "QA stub — prática vídeo",
      kind: "video",
      usage: "practice",
      url: QA_STUB_VIDEO_PRACTICE,
      body: null,
    }),
    upsertAsset(supabase, createdBy, topicId, {
      title: "QA stub — texto",
      kind: "text",
      usage: "lesson",
      url: null,
      body: QA_STUB_TEXT_BODY,
    }),
  ]);

  return {
    categoryId,
    topicId,
    assets: {
      video_lesson: videoLesson,
      video_practice: videoPractice,
      text,
    },
  };
}
