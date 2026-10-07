"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { deleteR2Object, getPublicUrl, keyFromPublicUrl } from "@/lib/storage/r2";
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

function libraryObjectKey(
  storagePath: string | null | undefined,
  url: string | null | undefined,
): string | null {
  const path = storagePath?.trim() ?? "";
  if (path.startsWith("library/") && !path.includes("..")) return path;
  if (!url) return null;
  const key = keyFromPublicUrl(url);
  if (key?.startsWith("library/") && !key.includes("..")) return key;
  return null;
}

/** True when a level, template, or another library item still points at this object. */
async function libraryObjectInUse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  key: string,
  exceptAssetId?: string,
): Promise<boolean> {
  const url = getPublicUrl(key);
  const [byPath, byUrl, nodes, templates] = await Promise.all([
    supabase.from("library_assets").select("id").eq("storage_path", key).limit(5),
    supabase.from("library_assets").select("id").eq("url", url).limit(5),
    supabase.from("nodes").select("id").eq("resource_url", url).limit(1),
    supabase
      .from("path_template_nodes")
      .select("id")
      .eq("default_resource_url", url)
      .limit(1),
  ]);
  if (byPath.error || byUrl.error || nodes.error || templates.error) return true;

  const assetIds = new Set(
    [...(byPath.data ?? []), ...(byUrl.data ?? [])].map((row) => row.id),
  );
  if (exceptAssetId) assetIds.delete(exceptAssetId);
  if (assetIds.size > 0) return true;
  if ((nodes.data ?? []).length > 0) return true;
  if ((templates.data ?? []).length > 0) return true;
  return false;
}

async function deleteLibraryObjectIfFree(
  supabase: Awaited<ReturnType<typeof createClient>>,
  key: string | null,
  exceptAssetId?: string,
): Promise<boolean> {
  if (!key) return false;
  if (await libraryObjectInUse(supabase, key, exceptAssetId)) return false;
  await deleteR2Object(key);
  return true;
}

function revalidateLibrary() {
  revalidatePath("/studio/library");
  revalidatePath("/studio/library", "layout");
  revalidatePath("/studio/agent");
  revalidatePath("/path", "layout");
}

/**
 * Percursos que não devem ser reescritos quando um item da biblioteca muda.
 * O ficheiro antigo fica no R2 enquanto estes níveis ainda o usam.
 */
const PROTECTED_PATH_IDS = [
  "b2c498a9-436c-4721-83ff-62f90641a37d",
  "e2389334-62d2-46cb-a321-91baa5ee78f6",
  "7db4ea45-d7ee-4ec6-b50e-179e02581425",
];

async function propagateReplacedMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  previousUrl: string | null | undefined,
  nextUrl: string | null | undefined,
) {
  const from = previousUrl?.trim() ?? "";
  const to = nextUrl?.trim() ?? "";
  if (!from || !to || from === to) return;

  const { error: templateError } = await supabase
    .from("path_template_nodes")
    .update({ default_resource_url: to })
    .eq("default_resource_url", from);
  if (templateError) throw new Error(templateError.message);

  const { error: nodeError } = await supabase
    .from("nodes")
    .update({ resource_url: to })
    .eq("resource_url", from)
    .not("path_id", "in", `(${PROTECTED_PATH_IDS.join(",")})`);
  if (nodeError) throw new Error(nodeError.message);
}

export async function upsertLibraryAsset(formData: FormData) {
  const { supabase, user } = await requireMentor();
  const id = (formData.get("id") as string) || null;
  const now = new Date().toISOString();
  const usage = ((formData.get("usage") as LibraryAssetUsage) || "lesson");
  const topicId = ((formData.get("topic_id") as string) || "").trim() || null;

  if (!topicId) {
    throw new Error("Escolhe categoria e tópico");
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
    const { data: previous } = await supabase
      .from("library_assets")
      .select("storage_path, url")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("library_assets")
      .update(payload)
      .eq("id", id);
    if (error) throw new Error(error.message);

    await propagateReplacedMedia(supabase, previous?.url, payload.url);

    const previousKey = libraryObjectKey(
      previous?.storage_path,
      previous?.url,
    );
    const nextKey = libraryObjectKey(payload.storage_path, payload.url);
    if (previousKey && previousKey !== nextKey) {
      try {
        await deleteLibraryObjectIfFree(supabase, previousKey, id);
      } catch (err) {
        console.error("[library] failed to delete replaced object", err);
      }
    }
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

  const redirectTo = (formData.get("redirect_to") as string)?.trim();
  if (redirectTo?.startsWith("/studio/")) {
    redirect(redirectTo);
  }
}

export async function deleteLibraryAsset(
  formData: FormData,
): Promise<{ fileRemoved: boolean | null }> {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const { data: previous } = await supabase
    .from("library_assets")
    .select("storage_path, url")
    .eq("id", id)
    .maybeSingle();
  const key = libraryObjectKey(previous?.storage_path, previous?.url);

  let fileRemoved: boolean | null = key ? false : null;
  if (key && !(await libraryObjectInUse(supabase, key, id))) {
    await deleteR2Object(key);
    fileRemoved = true;
  }

  const { error } = await supabase.from("library_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLibrary();

  const redirectTo = (formData.get("redirect_to") as string)?.trim();
  if (redirectTo?.startsWith("/studio/")) {
    redirect(redirectTo);
  }
  return { fileRemoved };
}

/** Grava o ficheiro no item assim que o envio para a Cloudflare termina. */
export async function replaceLibraryAssetMedia(input: {
  id: string;
  url: string;
  storagePath: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await requireMentor();
    const id = input.id.trim();
    const url = input.url.trim();
    const storagePath = input.storagePath.trim();
    if (!id || !url || !storagePath.startsWith("library/") || storagePath.includes("..")) {
      return { ok: false, error: "Ficheiro inválido" };
    }

    const { data: previous, error: readError } = await supabase
      .from("library_assets")
      .select("storage_path, url")
      .eq("id", id)
      .maybeSingle();
    if (readError) return { ok: false, error: readError.message };
    if (!previous) return { ok: false, error: "Item não encontrado" };

    const { error } = await supabase
      .from("library_assets")
      .update({
        url,
        storage_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    await propagateReplacedMedia(supabase, previous.url, url);

    const previousKey = libraryObjectKey(previous.storage_path, previous.url);
    if (previousKey && previousKey !== storagePath) {
      try {
        await deleteLibraryObjectIfFree(supabase, previousKey, id);
      } catch (err) {
        console.error("[library] failed to delete replaced object", err);
      }
    }

    revalidateLibrary();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao guardar o ficheiro",
    };
  }
}

/** Removes an upload that was never saved on a library item and is not used by a level. */
export async function releaseUnsavedLibraryUpload(key: string): Promise<void> {
  const { supabase, user } = await requireMentor();
  const trimmed = key.trim();
  if (!trimmed.startsWith("library/") || !trimmed.includes(`/${user.id}/`)) return;
  if (trimmed.includes("..")) return;
  try {
    await deleteLibraryObjectIfFree(supabase, trimmed);
  } catch (err) {
    console.error("[library] failed to release unsaved upload", err);
  }
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

export type LibraryActionResult = { ok: true } | { ok: false; error: string };

function friendlyTopicError(message: string) {
  if (/duplicate key|unique/i.test(message)) {
    return "Já existe um tópico com esse nome nesta categoria.";
  }
  return message;
}

export async function updateLibraryTopic(
  formData: FormData,
): Promise<LibraryActionResult> {
  try {
    const { supabase } = await requireMentor();
    const id = ((formData.get("id") as string) || "").trim();
    const name = ((formData.get("name") as string) || "").trim();
    const categoryId = ((formData.get("category_id") as string) || "").trim();
    if (!id || !name) return { ok: false, error: "Nome obrigatório" };

    const { data: current } = await supabase
      .from("library_topics")
      .select("category_id")
      .eq("id", id)
      .maybeSingle();
    if (!current) return { ok: false, error: "Tópico não encontrado" };

    const patch: {
      name: string;
      slug: string;
      category_id?: string;
      sort_index?: number;
    } = { name, slug: slugify(name) };

    if (categoryId && categoryId !== current.category_id) {
      const { data: last } = await supabase
        .from("library_topics")
        .select("sort_index")
        .eq("category_id", categoryId)
        .order("sort_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      patch.category_id = categoryId;
      patch.sort_index = (last?.sort_index ?? -1) + 1;
    }

    const { error } = await supabase
      .from("library_topics")
      .update(patch)
      .eq("id", id);
    if (error) return { ok: false, error: friendlyTopicError(error.message) };

    revalidateLibrary();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não foi possível guardar",
    };
  }
}

export async function moveLibraryTopic(
  topicId: string,
  direction: "up" | "down",
): Promise<LibraryActionResult> {
  try {
    const { supabase } = await requireMentor();
    const { data: topic } = await supabase
      .from("library_topics")
      .select("id, category_id")
      .eq("id", topicId)
      .maybeSingle();
    if (!topic) return { ok: false, error: "Tópico não encontrado" };

    const { data: siblings, error } = await supabase
      .from("library_topics")
      .select("id, sort_index")
      .eq("category_id", topic.category_id)
      .order("sort_index", { ascending: true })
      .order("name", { ascending: true });
    if (error) return { ok: false, error: error.message };

    const ordered = siblings ?? [];
    const index = ordered.findIndex((t) => t.id === topicId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ordered.length) return { ok: true };

    const next = [...ordered];
    [next[index], next[target]] = [next[target]!, next[index]!];
    const results = await Promise.all(
      next.map((t, i) =>
        t.sort_index === i
          ? Promise.resolve({ error: null })
          : supabase.from("library_topics").update({ sort_index: i }).eq("id", t.id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return { ok: false, error: failed.error.message };

    revalidateLibrary();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não foi possível mover",
    };
  }
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
