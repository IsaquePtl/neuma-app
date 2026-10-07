import {
  cancelMultipartUpload,
  finishMultipartUpload,
  getCheckInVideoUploadUrl,
  getLibraryAssetUploadUrl,
  getMentorFeedbackVideoUploadUrl,
  type PresignedMultipartUpload,
  type PresignedPutUpload,
  type PresignedUploadOutcome,
} from "@/lib/actions/r2-uploads";
import { R2_MULTIPART_THRESHOLD_BYTES } from "@/lib/uploads/video-limits";

export type R2UploadKind = "library" | "check-in" | "mentor-feedback";

/**
 * Upload a file directly to R2 via a presigned PUT URL (bypasses Next.js body limits).
 */
export async function uploadViaPresignedPut(
  file: File,
  presigned: { uploadUrl: string; publicUrl: string },
): Promise<string> {
  const contentType = (file.type || "application/octet-stream")
    .split(";")[0]
    ?.trim() || "application/octet-stream";
  const res = await fetch(presigned.uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (!res.ok) {
    let host = "R2";
    try {
      host = new URL(presigned.uploadUrl).host;
    } catch {
      /* ignore */
    }
    if (res.status === 413) {
      throw new Error(
        `Ficheiro demasiado grande para um único pedido (413 em ${host}). A tentar multipart…`,
      );
    }
    throw new Error(
      `Falha no upload (${res.status} em ${host}). Verifica CORS no bucket R2.`,
    );
  }

  return presigned.publicUrl;
}

function normalizeEtag(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

/**
 * Multipart: partes ≥5 MiB (excepto a última). O bucket CORS tem de expor ETag:
 * ExposeHeaders: ["ETag"].
 */
export async function uploadViaPresignedMultipart(
  file: File,
  plan: PresignedMultipartUpload,
): Promise<string> {
  const completed: { partNumber: number; etag: string }[] = [];

  try {
    const concurrency = 3;
    let next = 0;

    async function uploadOne(part: {
      partNumber: number;
      uploadUrl: string;
    }) {
      const start = (part.partNumber - 1) * plan.partSize;
      const end = Math.min(start + plan.partSize, file.size);
      const blob = file.slice(start, end);

      const res = await fetch(part.uploadUrl, {
        method: "PUT",
        body: blob,
      });
      if (!res.ok) {
        let host = "R2";
        try {
          host = new URL(part.uploadUrl).host;
        } catch {
          /* ignore */
        }
        throw new Error(
          `Falha na parte ${part.partNumber} (${res.status} em ${host}).` +
            (res.status === 413
              ? " Parte ainda demasiado grande."
              : " Verifica CORS no bucket R2."),
        );
      }
      const etag = normalizeEtag(res.headers.get("etag"));
      if (!etag) {
        throw new Error(
          "O R2 não devolveu ETag. No CORS do bucket adiciona ExposeHeaders: ETag.",
        );
      }
      completed.push({ partNumber: part.partNumber, etag });
    }

    const workers = Array.from(
      { length: Math.min(concurrency, plan.parts.length) },
      async () => {
        while (next < plan.parts.length) {
          const index = next;
          next += 1;
          const part = plan.parts[index];
          if (part) await uploadOne(part);
        }
      },
    );
    await Promise.all(workers);

    const finished = await finishMultipartUpload({
      key: plan.key,
      uploadId: plan.uploadId,
      parts: completed,
    });
    if (!finished.ok) throw new Error(finished.error);

    return plan.publicUrl;
  } catch (err) {
    void cancelMultipartUpload({
      key: plan.key,
      uploadId: plan.uploadId,
    });
    throw err;
  }
}

async function requestUploadPlan(
  kind: R2UploadKind,
  file: File,
  opts: { categoryId?: string | null; forceMultipart?: boolean },
): Promise<PresignedUploadOutcome> {
  const meta = {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    forceMultipart: opts.forceMultipart,
  };
  if (kind === "library") {
    return getLibraryAssetUploadUrl({ ...meta, categoryId: opts.categoryId });
  }
  if (kind === "mentor-feedback") {
    return getMentorFeedbackVideoUploadUrl(meta);
  }
  return getCheckInVideoUploadUrl(meta);
}

/**
 * Escolhe PUT ou multipart. Se o PUT devolver 413 (teto Cloudflare ~100 MB),
 * repete automaticamente em multipart.
 */
export async function uploadToR2Presigned(
  file: File,
  plan: PresignedPutUpload | PresignedMultipartUpload,
  opts?: { kind?: R2UploadKind; categoryId?: string | null },
): Promise<string> {
  const preferMultipart =
    file.size > R2_MULTIPART_THRESHOLD_BYTES || plan.mode === "multipart";

  if (preferMultipart && plan.mode === "put" && opts?.kind) {
    const forced = await requestUploadPlan(opts.kind, file, {
      categoryId: opts.categoryId,
      forceMultipart: true,
    });
    if (!forced.ok) throw new Error(forced.error);
    if (forced.mode !== "multipart") {
      throw new Error("Não foi possível iniciar upload multipart.");
    }
    return uploadViaPresignedMultipart(file, forced);
  }

  if (plan.mode === "multipart") {
    return uploadViaPresignedMultipart(file, plan);
  }

  try {
    return await uploadViaPresignedPut(file, plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.includes("413") || !opts?.kind) throw err;

    const forced = await requestUploadPlan(opts.kind, file, {
      categoryId: opts.categoryId,
      forceMultipart: true,
    });
    if (!forced.ok) throw new Error(forced.error);
    if (forced.mode !== "multipart") throw err;
    return uploadViaPresignedMultipart(file, forced);
  }
}
