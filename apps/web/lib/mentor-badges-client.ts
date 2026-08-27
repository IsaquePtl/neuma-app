/** Disparado no cliente após mutações que alteram o badge do mentor (Percursos / Agent). */
export const MENTOR_BADGES_REFRESH_EVENT = "neuma:mentor-badges-refresh";

/** Pede ao AppShell para voltar a buscar `fetchMentorBadgeCounts`. */
export function requestMentorBadgesRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MENTOR_BADGES_REFRESH_EVENT));
}
