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
