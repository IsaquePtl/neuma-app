/** Max check-in / mentor feedback / library video size (R2). */
export const MAX_VIDEO_MB = 500;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export function videoTooLargeMessage(): string {
  return `O vídeo é demasiado grande. Máximo ${MAX_VIDEO_MB} MB.`;
}
