"use client";

/** Disparado após marcar feedback como visto (Continuar / Próximo nível). */
export const STUDENT_BADGES_REFRESH_EVENT = "neuma:student-badges-refresh";

export function requestStudentBadgesRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STUDENT_BADGES_REFRESH_EVENT));
}
