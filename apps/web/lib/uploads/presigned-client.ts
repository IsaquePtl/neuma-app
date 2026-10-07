import {
  cancelMultipartUpload,
  finishMultipartUpload,
  type PresignedMultipartUpload,
  type PresignedPutUpload,
} from "@/lib/actions/r2-uploads";

/**
 * Upload a file directly to R2 via a presigned PUT URL (bypasses Next.js body limits).
 */
export async function uploadViaPresignedPut(
  file: File,
  presigned: { uploadUrl: string; publicUrl: string },
): Promise<string> {
  const res = await fetch(presigned.uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Falha no upload (${res.status}). Verifica CORS no bucket R2 e as credenciais.`,
    );
  }

  return presigned.publicUrl;
}

function normalizeEtag(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // R2/S3 devolvem ETag com aspas; CompleteMultipartUpload aceita com ou sem.
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
    // Até 3 partes em paralelo — equilíbrio entre velocidade e o browser.
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
        throw new Error(
          `Falha na parte ${part.partNumber} (${res.status}). Verifica CORS no bucket R2.`,
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

export async function uploadToR2Presigned(
  file: File,
  plan: PresignedPutUpload | PresignedMultipartUpload,
): Promise<string> {
  if (plan.mode === "put") {
    return uploadViaPresignedPut(file, plan);
  }
  return uploadViaPresignedMultipart(file, plan);
}
