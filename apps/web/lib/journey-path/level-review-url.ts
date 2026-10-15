export function mentorLevelReviewHref(
  pathId: string,
  nodeId: string,
  options?: { checkin?: string },
): string {
  const params = new URLSearchParams();
  if (options?.checkin) params.set("checkin", options.checkin);
  const qs = params.toString();
  return `/studio/journeys/${pathId}/levels/${nodeId}${qs ? `?${qs}` : ""}`;
}

/** Full-page mentor quiz preview (same shell as level review / check-in). */
export function mentorLevelQuizHref(pathId: string, nodeId: string): string {
  return `/studio/journeys/${pathId}/levels/${nodeId}/quiz`;
}
