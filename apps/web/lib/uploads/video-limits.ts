/**
 * Limites da app (não do R2). Upload da biblioteca vai por URL assinada
 * directo ao bucket — o Next não recebe o ficheiro.
 *
 * Check-ins / feedback: 500 MB (telemóvel, redes móveis).
 * Biblioteca (mentor): 5 GB (aulas longas em MOV; R2 multipart até ~5 TiB).
 */
export const MAX_VIDEO_MB = 500;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export const MAX_LIBRARY_FILE_MB = 5120;
export const MAX_LIBRARY_FILE_BYTES = MAX_LIBRARY_FILE_MB * 1024 * 1024;

/**
 * Multipart: partes 16 MiB. Limiar 50 MB — abaixo do teto ~100 MB do
 * proxy Cloudflare (Free/Pro → HTTP 413 num PUT único).
 */
export const R2_MULTIPART_PART_BYTES = 16 * 1024 * 1024;
export const R2_MULTIPART_THRESHOLD_BYTES = 50 * 1024 * 1024;

export function videoTooLargeMessage(maxMb: number = MAX_VIDEO_MB): string {
  return `O vídeo é demasiado grande. Máximo ${maxMb} MB.`;
}

export function libraryFileTooLargeMessage(): string {
  return videoTooLargeMessage(MAX_LIBRARY_FILE_MB);
}
