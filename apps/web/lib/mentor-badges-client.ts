"use client";

import { useEffect, useState } from "react";

/** Disparado no cliente após mutações que alteram o badge do mentor (Percursos / Agent). */
export const MENTOR_BADGES_REFRESH_EVENT = "neuma:mentor-badges-refresh";

export type MentorBadgeCounts = {
  checkins: number;
  onboardings: number;
  proposals: number;
};

const EMPTY_BADGES: MentorBadgeCounts = {
  checkins: 0,
  onboardings: 0,
  proposals: 0,
};

/** Pede ao AppShell para voltar a buscar `fetchMentorBadgeCounts`. */
export function requestMentorBadgesRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MENTOR_BADGES_REFRESH_EVENT));
}

export function useMentorBadgeCounts(enabled = true) {
  const [badges, setBadges] = useState<MentorBadgeCounts>(EMPTY_BADGES);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    function refresh() {
      void import("@/lib/actions/mentor-badges").then(({ fetchMentorBadgeCounts }) =>
        fetchMentorBadgeCounts().then((next) => {
          if (!cancelled) setBadges(next);
        }),
      );
    }

    refresh();
    window.addEventListener(MENTOR_BADGES_REFRESH_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(MENTOR_BADGES_REFRESH_EVENT, refresh);
    };
  }, [enabled]);

  return badges;
}
