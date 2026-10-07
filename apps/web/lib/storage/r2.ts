import "server-only";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListMultipartUploadsCommand,
  PutObjectCommand,
  UploadPartCommand,
  S3Client,
  type CompletedPart,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2_MULTIPART_PART_BYTES } from "@/lib/uploads/video-limits";

export {
  R2_MULTIPART_PART_BYTES,
  R2_MULTIPART_THRESHOLD_BYTES,
} from "@/lib/uploads/video-limits";

type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  endpoint: string;
};

/**
 * Vercel/env colam por vezes \\n, aspas ou espaços nas secrets.
 * Isso parte o header Authorization do AWS SDK (Node: Invalid character…).
 */
function cleanEnv(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  let v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  v = v.replace(/[\0\r\n]/g, "").trim();
  return v || undefined;
}

/** MIME simples para headers S3/R2 — evita chars inválidos no Authorization. */
export function sanitizeContentType(raw: string | undefined | null): string {
  const base = (raw ?? "").split(";")[0]?.trim().toLowerCase() || "";
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(base)) return base;
  return "application/octet-stream";
}

function getR2Config(): R2Config {
  const accessKeyId = cleanEnv(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = cleanEnv(process.env.R2_SECRET_ACCESS_KEY);
  const bucketName = cleanEnv(process.env.R2_BUCKET_NAME);
  const publicUrl = cleanEnv(process.env.R2_PUBLIC_URL);
  const endpoint = cleanEnv(process.env.R2_ENDPOINT);

  if (
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !publicUrl ||
    !endpoint
  ) {
    throw new Error(
      "Configuração R2 incompleta. Verifica R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL e R2_ENDPOINT.",
    );
  }

  return { accessKeyId, secretAccessKey, bucketName, publicUrl, endpoint };
}

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (client) return client;
  const cfg = getR2Config();
  client = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // SDK recente manda checksums que o R2 ainda não implementa.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

function sanitizeExt(filename: string, fallback = "bin"): string {
  const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext && ext.length <= 8 ? ext : fallback;
}

export function buildCheckInKey(userId: string, filename: string): string {
  const ext = sanitizeExt(filename, "mp4");
  return `check-ins/${userId}/${Date.now()}.${ext}`;
}

export function buildMentorFeedbackKey(userId: string, filename: string): string {
  const ext = sanitizeExt(filename, "mp4");
  return `mentor-feedback/${userId}/${Date.now()}.${ext}`;
}

export function buildLibraryKey(
  categoryId: string,
  userId: string,
  filename: string,
): string {
  const ext = sanitizeExt(filename, "bin");
  const categorySegment = categoryId.trim() || "unassigned";
  return `library/${categorySegment}/${userId}/${Date.now()}.${ext}`;
}

/** Public URL for an object key on the R2 dev/public domain. */
export function getPublicUrl(key: string): string {
  const base = getR2Config().publicUrl.replace(/\/$/, "");
  return `${base}/${key}`;
}

/** True when the URL is served from the configured R2 public domain. */
export function isR2PublicUrl(url: string): boolean {
  try {
    const base = getR2Config().publicUrl.replace(/\/$/, "");
    return url.startsWith(`${base}/`);
  } catch {
    return false;
  }
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const cfg = getR2Config();
  const input: PutObjectCommandInput = {
    Bucket: cfg.bucketName,
    Key: key,
    Body: body,
    ContentType: sanitizeContentType(contentType),
  };

  const { error } = await getR2Client()
    .send(new PutObjectCommand(input))
    .then(
      () => ({ error: null as null }),
      (err: Error) => ({ error: err }),
    );

  if (error) {
    throw new Error(error.message || "Falha ao enviar ficheiro para R2");
  }

  return getPublicUrl(key);
}

export function keyFromPublicUrl(url: string): string | null {
  if (!isR2PublicUrl(url)) return null;
  const base = getR2Config().publicUrl.replace(/\/$/, "");
  const raw = url.slice(base.length + 1).split("?")[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Presigned GET (default 10 min). The bucket can stay private. */
export async function createPresignedGetUrl(
  key: string,
  expiresInSeconds = 60 * 10,
): Promise<string> {
  const cfg = getR2Config();
  const command = new GetObjectCommand({ Bucket: cfg.bucketName, Key: key });
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}

export async function deleteR2Object(key: string): Promise<void> {
  const cfg = getR2Config();
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: cfg.bucketName, Key: key }),
  );
}

/** Removes check-in and mentor-feedback objects. Other keys are left alone. */
export async function deletePrivateR2Urls(
  urls: Array<string | null | undefined>,
): Promise<void> {
  const keys = new Set<string>();
  for (const url of urls) {
    if (!url) continue;
    const key = keyFromPublicUrl(url);
    if (!key) continue;
    if (!key.startsWith("check-ins/") && !key.startsWith("mentor-feedback/")) {
      continue;
    }
    keys.add(key);
  }

  await Promise.all(
    [...keys].map(async (key) => {
      try {
        await deleteR2Object(key);
      } catch (err) {
        console.error("[r2] delete failed", key, err);
      }
    }),
  );
}

/** Presigned PUT URL for direct browser upload (default 15 min). */
export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 60 * 15,
): Promise<string> {
  const cfg = getR2Config();
  const command = new PutObjectCommand({
    Bucket: cfg.bucketName,
    Key: key,
    ContentType: sanitizeContentType(contentType),
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}

export async function createMultipartUpload(
  key: string,
  contentType: string,
): Promise<{ uploadId: string }> {
  const cfg = getR2Config();
  const out = await getR2Client().send(
    new CreateMultipartUploadCommand({
      Bucket: cfg.bucketName,
      Key: key,
      ContentType: sanitizeContentType(contentType),
    }),
  );
  if (!out.UploadId) throw new Error("R2 não devolveu uploadId");
  return { uploadId: out.UploadId };
}

export async function createPresignedUploadPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresInSeconds = 60 * 60 * 2,
): Promise<string> {
  const cfg = getR2Config();
  const command = new UploadPartCommand({
    Bucket: cfg.bucketName,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPart[],
): Promise<void> {
  const cfg = getR2Config();
  await getR2Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: cfg.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts].sort(
          (a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0),
        ),
      },
    }),
  );
}

/** Drops library uploads this mentor abandoned. Fresh ones stay, so a retry does not kill an upload in progress. */
export async function abortLibraryMultipartUploadsForUser(
  userId: string,
  minAgeMs = 45 * 60 * 1000,
): Promise<void> {
  const cfg = getR2Config();
  let keyMarker: string | undefined;
  let uploadIdMarker: string | undefined;

  do {
    const page = await getR2Client().send(
      new ListMultipartUploadsCommand({
        Bucket: cfg.bucketName,
        Prefix: "library/",
        KeyMarker: keyMarker,
        UploadIdMarker: uploadIdMarker,
      }),
    );
    for (const upload of page.Uploads ?? []) {
      if (!upload.Key || !upload.UploadId) continue;
      if (!upload.Key.includes(`/${userId}/`)) continue;
      const started = upload.Initiated?.getTime() ?? 0;
      if (started && Date.now() - started < minAgeMs) continue;
      try {
        await abortMultipartUpload(upload.Key, upload.UploadId);
      } catch (err) {
        console.error("[r2] abort library multipart", upload.Key, err);
      }
    }
    keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
    uploadIdMarker = page.IsTruncated ? page.NextUploadIdMarker : undefined;
  } while (keyMarker);
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string,
): Promise<void> {
  const cfg = getR2Config();
  await getR2Client().send(
    new AbortMultipartUploadCommand({
      Bucket: cfg.bucketName,
      Key: key,
      UploadId: uploadId,
    }),
  );
}

export function multipartPartCount(
  size: number,
  partBytes = R2_MULTIPART_PART_BYTES,
): number {
  return Math.max(1, Math.ceil(size / partBytes));
}
