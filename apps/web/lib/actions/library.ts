"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type {
  LibraryAssetKind,
  LibraryAssetUsage,
} from "@/lib/types/database.types";

async function requireMentor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissao");
  return { supabase, user };
}

function parseTags(raw: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(/[,#]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function revalidateLibrary() {
  revalidatePath("/studio/paths");
  revalidatePath("/studio/paths", "layout");
  revalidatePath("/studio/agent");
}

export async function upsertLibraryAsset(formData: FormData) {
  const { supabase, user } = await requireMentor();
  const id = (formData.get("id") as string) || null;
  const now = new Date().toISOString();
  const usage = ((formData.get("usage") as LibraryAssetUsage) || "lesson");
  const topicId =
    usage === "lesson"
      ? ((formData.get("topic_id") as string) || "").trim() || null
      : null;

  if (usage === "lesson" && !topicId) {
    throw new Error("Escolhe categoria e tópico para uma aula");
  }

  // Mentor save = confirmação → entra na Biblioteca como ready.
  const payload = {
    title: (formData.get("title") as string)?.trim() || "Sem título",
    summary: ((formData.get("summary") as string) || "").trim() || null,
    kind: ((formData.get("kind") as LibraryAssetKind) || "link"),
    usage,
    topic_id: topicId,
    body: ((formData.get("body") as string) || "").trim() || null,
    url: ((formData.get("url") as string) || "").trim() || null,
    storage_path:
      ((formData.get("storage_path") as string) || "").trim() || null,
    tags: parseTags((formData.get("tags") as string) || ""),
    cover_url: ((formData.get("cover_url") as string) || "").trim() || null,
    duration_label:
      ((formData.get("duration_label") as string) || "").trim() || null,
    content_status: "ready" as const,
    updated_at: now,
  };

  if (id) {
    const { error } = await supabase
      .from("library_assets")
      .update(payload)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("library_assets").insert({
      ...payload,
      created_by: user.id,
    });
    if (error) throw new Error(error.message);
  }

  revalidateLibrary();
}

export async function archiveLibraryAsset(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const restore = formData.get("restore") === "1";

  const { error } = await supabase
    .from("library_assets")
    .update({
      archived_at: restore ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateLibrary();
}

export async function deleteLibraryAsset(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const { error } = await supabase.from("library_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLibrary();
}

export async function createLibraryCategory(formData: FormData) {
  const { supabase } = await requireMentor();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Nome obrigatório");

  const themeRaw = ((formData.get("theme") as string) || "").trim();
  const theme =
    themeRaw === "acoustic" || themeRaw === "electric" || themeRaw === "piano"
      ? themeRaw
      : null;

  const { data: last } = await supabase
    .from("library_categories")
    .select("sort_index")
    .order("sort_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("library_categories").insert({
    name,
    slug: slugify(name),
    sort_index: (last?.sort_index ?? -1) + 1,
    theme,
  });
  if (error) throw new Error(error.message);
  revalidateLibrary();
}

export async function renameLibraryCategory(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!id || !name) throw new Error("Nome obrigatório");
  const themeRaw = ((formData.get("theme") as string) || "").trim();
  const theme =
    themeRaw === "acoustic" || themeRaw === "electric" || themeRaw === "piano"
      ? themeRaw
      : null;

  const { error } = await supabase
    .from("library_categories")
    .update({ name, slug: slugify(name), theme })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLibrary();
}

export async function createLibraryTopic(formData: FormData) {
  const { supabase } = await requireMentor();
  const name = (formData.get("name") as string)?.trim();
  const categoryId = formData.get("category_id") as string;
  if (!name || !categoryId) throw new Error("Categoria e nome obrigatórios");

  const { data: last } = await supabase
    .from("library_topics")
    .select("sort_index")
    .eq("category_id", categoryId)
    .order("sort_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("library_topics").insert({
    category_id: categoryId,
    name,
    slug: slugify(name),
    sort_index: (last?.sort_index ?? -1) + 1,
  });
  if (error) throw new Error(error.message);
  revalidateLibrary();
}

export async function deleteLibraryCategory(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const { error } = await supabase
    .from("library_categories")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLibrary();
}

export async function deleteLibraryTopic(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const { error } = await supabase.from("library_topics").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLibrary();
}
