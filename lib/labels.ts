import type {
  CheckInKind,
  CheckInStatus,
  NodeKind,
  NodeStatus,
  PathStatus,
} from "@/lib/types/database.types";

export const nodeKindLabel: Record<NodeKind, string> = {
  practice: "Pratica",
  call: "Chamada",
  milestone: "Marco",
  resource: "Recurso",
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
