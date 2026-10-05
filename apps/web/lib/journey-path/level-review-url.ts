export type MentorLevelTab = "feedback" | "nivel";

export function mentorLevelReviewHref(
  pathId: string,
  nodeId: string,
  options?: { checkin?: string; tab?: MentorLevelTab },
): string {
  const params = new URLSearchParams();
  if (options?.checkin) params.set("checkin", options.checkin);
  if (options?.tab && options.tab !== "feedback") {
    params.set("tab", options.tab);
  }
  const qs = params.toString();
  return `/studio/journeys/${pathId}/levels/${nodeId}${qs ? `?${qs}` : ""}`;
}

/** Full-page mentor quiz preview (same shell as level review / check-in). */
export function mentorLevelQuizHref(pathId: string, nodeId: string): string {
  return `/studio/journeys/${pathId}/levels/${nodeId}/quiz`;
}
