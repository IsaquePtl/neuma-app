import type {
  CheckInKind,
  CheckInStatus,
  LibraryAssetKind,
  LibraryAssetUsage,
  MentorCalendarEventKind,
  NodeKind,
  NodeStatus,
  PathStatus,
  PathTemplateStatus,
} from "@/lib/types/database.types";

export const nodeKindLabel: Record<NodeKind, string> = {
  practice: "Prática",
  call: "Sessão",
  milestone: "Check-point",
  lesson: "Aula",
  resource: "Aula",
};

/** Hints curtos para o editor do mentor. */
export const nodeKindHint: Record<NodeKind, string> = {
  practice: "Prática — texto, vídeo e ficheiros de qualquer tipo",
  call: "Sessão — foco no Meet/Cal.com; texto e anexo só como apoio",
  milestone: "Check-point — quiz de escolha múltipla + material de apoio",
  lesson: "Aula — vídeo em destaque; texto e anexos abaixo",
  resource: "Aula (legado)",
};

export const nodeStatusLabel: Record<NodeStatus, string> = {
  locked: "Bloqueado",
  active: "Ativo",
  completed: "Concluido",
};

export const pathStatusLabel: Record<PathStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluido",
  paused: "Em pausa",
};

export const pathTemplateStatusLabel: Record<PathTemplateStatus, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  archived: "Arquivado",
};

export const libraryAssetKindLabel: Record<LibraryAssetKind, string> = {
  video: "Vídeo",
  text: "Texto",
  image: "Imagem",
  file: "Ficheiro",
  link: "Link",
};

export const libraryAssetUsageLabel: Record<LibraryAssetUsage, string> = {
  lesson: "Aula",
  practice: "Prática",
};

export const checkInStatusLabel: Record<CheckInStatus, string> = {
  pending: "Por rever",
  approved: "Aprovado",
  needs_revision: "A rever",
};

export const checkInKindLabel: Record<CheckInKind, string> = {
  video: "Video",
  text: "Texto",
  call: "Chamada",
};

/** Label curto em BD / listagens para check-in sem nível no percurso. */
export const ORPHAN_CHECKIN_LABEL = "Sem nível associado";

/** Título e texto de apoio na UI de check-in sem nível (tom da Geral). */
export const ORPHAN_CHECKIN_HEADING = "Ainda sem nível activo";
export const ORPHAN_CHECKIN_DESCRIPTION =
  "O teu percurso já existe, mas ainda não há um nível activo. Podes enviar o check-in na mesma.";

export function checkInLevelTitle(
  nodeTitle: string | null | undefined,
  levelLabel: string | null | undefined,
): string {
  return nodeTitle?.trim() || levelLabel?.trim() || ORPHAN_CHECKIN_LABEL;
}

export const mentorCalendarEventKindLabel: Record<
  MentorCalendarEventKind,
  string
> = {
  reminder: "Lembrete",
  meeting: "Reunião",
  event: "Evento",
  misc: "Diversos",
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Ha quanto tempo, em PT curto: "2 d", "5 h", "agora". */
export function formatWaiting(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (minutes < 60) return minutes < 2 ? "agora" : `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} d`;
  return `${Math.round(days / 7)} sem`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
