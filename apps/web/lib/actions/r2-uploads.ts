"use server";

import { createClient } from "@/lib/supabase/server";
import {
  abortLibraryMultipartUploadsForUser,
  abortMultipartUpload,
  buildCheckInKey,
  buildLibraryKey,
  buildMentorFeedbackKey,
  completeMultipartUpload,
  createMultipartUpload,
  createPresignedPutUrl,
  createPresignedUploadPartUrl,
  getPublicUrl,
  multipartPartCount,
  sanitizeContentType,
} from "@/lib/storage/r2";
import {
  MAX_LIBRARY_FILE_BYTES,
  MAX_VIDEO_BYTES,
  R2_LIBRARY_PART_BYTES,
  R2_MULTIPART_PART_BYTES,
  R2_MULTIPART_THRESHOLD_BYTES,
  libraryFileTooLargeMessage,
  videoTooLargeMessage,
} from "@/lib/uploads/video-limits";

type UploadMeta = {
  filename: string;
  contentType: string;
  size: number;
};

export type PresignedPutUpload = {
  ok: true;
  mode: "put";
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

export type PresignedMultipartUpload = {
  ok: true;
  mode: "multipart";
  publicUrl: string;
  key: string;
  uploadId: string;
  partSize: number;
  parts: { partNumber: number; uploadUrl: string }[];
};

/** Não lançar: em produção o Next esconde a mensagem e a página fica com 500. */
export type PresignedUploadOutcome =
  | PresignedPutUpload
  | PresignedMultipartUpload
  | { ok: false; error: string };

function validateVideoMeta({ contentType, size }: UploadMeta): string | null {
  if (!contentType.startsWith("video/")) {
    return "Escolhe um ficheiro de vídeo (MP4, MOV, etc.)";
  }
  if (size <= 0) return "Ficheiro inválido";
  if (size > MAX_VIDEO_BYTES) return videoTooLargeMessage();
  return null;
}

function validateLibraryFileMeta({ size }: UploadMeta): string | null {
  if (size <= 0) return "Ficheiro inválido";
  if (size > MAX_LIBRARY_FILE_BYTES) return libraryFileTooLargeMessage();
  return null;
}

async function requireUser(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  return { ok: true, id: user.id };
}

async function requireMentor(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") return { ok: false, error: "Sem permissão" };
  return { ok: true, id: user.id };
}

async function buildUploadPlan(
  key: string,
  contentType: string,
  size: number,
  forceMultipart = false,
  partBytes = R2_MULTIPART_PART_BYTES,
): Promise<PresignedPutUpload | PresignedMultipartUpload> {
  const publicUrl = getPublicUrl(key);
  const bytes = Number(size);
  const safeType = sanitizeContentType(contentType);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error("Ficheiro inválido");
  }

  if (!forceMultipart && bytes <= R2_MULTIPART_THRESHOLD_BYTES) {
    const uploadUrl = await createPresignedPutUrl(key, safeType);
    return { ok: true, mode: "put", uploadUrl, publicUrl, key };
  }

  const { uploadId } = await createMultipartUpload(key, safeType);
  const partCount = multipartPartCount(bytes, partBytes);
  const parts = await Promise.all(
    Array.from({ length: partCount }, async (_, i) => {
      const partNumber = i + 1;
      const uploadUrl = await createPresignedUploadPartUrl(
        key,
        uploadId,
        partNumber,
        60 * 60 * 6,
      );
      return { partNumber, uploadUrl };
    }),
  );

  return {
    ok: true,
    mode: "multipart",
    publicUrl,
    key,
    uploadId,
    partSize: partBytes,
    parts,
  };
}

type UploadMetaOpts = UploadMeta & { forceMultipart?: boolean };

/** Presigned upload for check-in student videos (browser → R2). */
export async function getCheckInVideoUploadUrl(
  meta: UploadMetaOpts,
): Promise<PresignedUploadOutcome> {
  const user = await requireUser();
  if (!user.ok) return user;

  const invalid = validateVideoMeta(meta);
  if (invalid) return { ok: false, error: invalid };

  const key = buildCheckInKey(user.id, meta.filename);
  try {
    return await buildUploadPlan(
      key,
      meta.contentType,
      meta.size,
      Boolean(meta.forceMultipart),
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha a preparar o upload",
    };
  }
}

/** Presigned upload for mentor feedback videos. */
export async function getMentorFeedbackVideoUploadUrl(
  meta: UploadMetaOpts,
): Promise<PresignedUploadOutcome> {
  const user = await requireMentor();
  if (!user.ok) return user;

  const invalid = validateVideoMeta(meta);
  if (invalid) return { ok: false, error: invalid };

  const key = buildMentorFeedbackKey(user.id, meta.filename);
  try {
    return await buildUploadPlan(
      key,
      meta.contentType,
      meta.size,
      Boolean(meta.forceMultipart),
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha a preparar o upload",
    };
  }
}

/** Presigned upload for library assets (video, image, file). */
export async function getLibraryAssetUploadUrl(
  meta: UploadMetaOpts & { categoryId?: string | null },
): Promise<PresignedUploadOutcome> {
  const user = await requireMentor();
  if (!user.ok) return user;

  const invalid = validateLibraryFileMeta(meta);
  if (invalid) return { ok: false, error: invalid };

  const key = buildLibraryKey(meta.categoryId ?? "", user.id, meta.filename);
  try {
    await abortLibraryMultipartUploadsForUser(user.id);
    // Biblioteca: vídeos longos — multipart cedo (acima de 5 MiB, mínimo
    // de parte R2) para nunca bater no 413 do proxy Cloudflare (~100 MB).
    const force =
      Boolean(meta.forceMultipart) ||
      Number(meta.size) > 5 * 1024 * 1024;
    return await buildUploadPlan(
      key,
      meta.contentType,
      meta.size,
      force,
      R2_LIBRARY_PART_BYTES,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha a preparar o upload",
    };
  }
}

export async function finishMultipartUpload(input: {
  key: string;
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!user.ok) return user;

  const ownsCheckIn = input.key.startsWith(`check-ins/${user.id}/`);
  const ownsFeedback = input.key.startsWith(`mentor-feedback/${user.id}/`);
  const isLibrary = input.key.startsWith("library/");

  if (!ownsCheckIn && !ownsFeedback && !isLibrary) {
    return { ok: false, error: "Chave inválida" };
  }

  if (isLibrary) {
    const mentor = await requireMentor();
    if (!mentor.ok) return mentor;
    if (!input.key.includes(`/${mentor.id}/`)) {
      return { ok: false, error: "Chave inválida" };
    }
  }

  try {
    await completeMultipartUpload(
      input.key,
      input.uploadId,
      input.parts.map((p) => ({
        PartNumber: p.partNumber,
        ETag: p.etag,
      })),
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha a finalizar o upload",
    };
  }
}

export async function cancelMultipartUpload(input: {
  key: string;
  uploadId: string;
}): Promise<void> {
  try {
    await abortMultipartUpload(input.key, input.uploadId);
  } catch {
    // best-effort cleanup
  }
}
