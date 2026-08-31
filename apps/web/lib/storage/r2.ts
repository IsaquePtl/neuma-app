import "server-only";

import {
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  endpoint: string;
};

function getR2Config(): R2Config {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const endpoint = process.env.R2_ENDPOINT;

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
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
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
    ContentType: contentType,
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
    ContentType: contentType,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}
