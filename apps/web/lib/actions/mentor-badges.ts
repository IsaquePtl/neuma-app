"use server";

import {
  getMentorPendingCheckInsCount,
  getMentorPendingOnboardingsCount,
  getMentorProposalBadge,
  getSessionUser,
} from "@/lib/auth/session";

/** Badges do mentor — hydrate no cliente após o shell pintar. */
export async function fetchMentorBadgeCounts() {
  const user = await getSessionUser();
  if (!user) return { checkins: 0, onboardings: 0, proposals: 0 };
  const [checkins, onboardings, proposals] = await Promise.all([
    getMentorPendingCheckInsCount(),
    getMentorPendingOnboardingsCount(),
    getMentorProposalBadge(),
  ]);
  return { checkins, onboardings, proposals };
}
