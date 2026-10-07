/**
 * Limites da app (não do R2). Upload da biblioteca vai por URL assinada
 * directo ao bucket — o Next não recebe o ficheiro.
 *
 * Check-ins / feedback: 500 MB (telemóvel, redes móveis).
 * Biblioteca (mentor): 2 GB (aulas longas em MOV).
 */
export const MAX_VIDEO_MB = 500;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export const MAX_LIBRARY_FILE_MB = 2048;
export const MAX_LIBRARY_FILE_BYTES = MAX_LIBRARY_FILE_MB * 1024 * 1024;

export function videoTooLargeMessage(maxMb: number = MAX_VIDEO_MB): string {
  return `O vídeo é demasiado grande. Máximo ${maxMb} MB.`;
}

export function libraryFileTooLargeMessage(): string {
  return videoTooLargeMessage(MAX_LIBRARY_FILE_MB);
}
