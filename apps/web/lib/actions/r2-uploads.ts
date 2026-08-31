"use server";

import { createClient } from "@/lib/supabase/server";
import {
  buildCheckInKey,
  buildLibraryKey,
  buildMentorFeedbackKey,
  createPresignedPutUrl,
  getPublicUrl,
} from "@/lib/storage/r2";
import {
  MAX_VIDEO_BYTES,
  videoTooLargeMessage,
} from "@/lib/uploads/video-limits";

type UploadMeta = {
  filename: string;
  contentType: string;
  size: number;
};

function validateVideoMeta({ contentType, size }: UploadMeta) {
  if (!contentType.startsWith("video/")) {
    throw new Error("Escolhe um ficheiro de vídeo (MP4, MOV, etc.)");
  }
  if (size <= 0) throw new Error("Ficheiro inválido");
  if (size > MAX_VIDEO_BYTES) throw new Error(videoTooLargeMessage());
}

function validateFileMeta({ size }: UploadMeta) {
  if (size <= 0) throw new Error("Ficheiro inválido");
  if (size > MAX_VIDEO_BYTES) throw new Error(videoTooLargeMessage());
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return user;
}

async function requireMentor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissão");
  return user;
}

export type PresignedUploadResult = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

/** Presigned PUT for check-in student videos (direct browser → R2). */
export async function getCheckInVideoUploadUrl(
  meta: UploadMeta,
): Promise<PresignedUploadResult> {
  const user = await requireUser();
  validateVideoMeta(meta);

  const key = buildCheckInKey(user.id, meta.filename);
  const uploadUrl = await createPresignedPutUrl(key, meta.contentType);
  return { uploadUrl, publicUrl: getPublicUrl(key), key };
}

/** Presigned PUT for mentor feedback videos. */
export async function getMentorFeedbackVideoUploadUrl(
  meta: UploadMeta,
): Promise<PresignedUploadResult> {
  const user = await requireMentor();
  validateVideoMeta(meta);

  const key = buildMentorFeedbackKey(user.id, meta.filename);
  const uploadUrl = await createPresignedPutUrl(key, meta.contentType);
  return { uploadUrl, publicUrl: getPublicUrl(key), key };
}

/** Presigned PUT for library assets (video, image, file). */
export async function getLibraryAssetUploadUrl(
  meta: UploadMeta & { categoryId?: string | null },
): Promise<PresignedUploadResult> {
  const user = await requireMentor();
  validateFileMeta(meta);

  const key = buildLibraryKey(meta.categoryId ?? "", user.id, meta.filename);
  const uploadUrl = await createPresignedPutUrl(key, meta.contentType);
  return { uploadUrl, publicUrl: getPublicUrl(key), key };
}
