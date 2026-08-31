const JOURNEY_LIST_SEGMENTS = new Set(["checkins", "onboardings"]);

/**
 * Same-app studio back target from `?returnTo=` — blocks open redirects.
 * Allows `/studio` or paths under `/studio/` (not `//…`).
 */
export function safeStudioReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed !== "/studio" && !trimmed.startsWith("/studio/")) return null;
  if (trimmed.startsWith("//") || trimmed.includes("://")) return null;
  return trimmed;
}

/** Student profile href that sends shell back to a studio page. */
export function studentProfileHref(studentId: string, returnTo: string): string {
  const safe = safeStudioReturnTo(returnTo);
  if (!safe) return `/studio/students/${studentId}`;
  return `/studio/students/${studentId}?returnTo=${encodeURIComponent(safe)}`;
}

type JourneyPathMatch = {
  pathId: string;
  kind: "detail" | "edit" | "level";
};

/** Path detail, edit, or level review — not list/checkins/onboardings index pages. */
export function matchJourneyPathPage(
  pathname: string,
): JourneyPathMatch | null {
  const match = pathname.match(
    /^\/studio\/journeys\/([^/]+)(?:\/(edit|levels\/([^/]+)))?$/,
  );
  if (!match) return null;
  const pathId = match[1];
  if (JOURNEY_LIST_SEGMENTS.has(pathId)) return null;
  if (match[2] === "edit") return { pathId, kind: "edit" };
  if (match[3]) return { pathId, kind: "level" };
  return { pathId, kind: "detail" };
}

export function isJourneyPathDetailPage(pathname: string): boolean {
  return matchJourneyPathPage(pathname) !== null;
}

/**
 * Back target for mentor journey path pages:
 * level/edit → path detail → journeys list.
 */
export function journeyPathBackHref(pathname: string): string | null {
  const match = matchJourneyPathPage(pathname);
  if (!match) return null;
  if (match.kind === "detail") return "/studio/journeys";
  return `/studio/journeys/${match.pathId}`;
}
