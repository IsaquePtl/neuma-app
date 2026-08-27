"use server";

import {
  getMentorNavBadge,
  getMentorProposalBadge,
  getSessionUser,
} from "@/lib/auth/session";

/** Badges do mentor — hydrate no cliente após o shell pintar. */
export async function fetchMentorBadgeCounts() {
  const user = await getSessionUser();
  if (!user) return { checkins: 0, proposals: 0 };
  const [checkins, proposals] = await Promise.all([
    getMentorNavBadge(),
    getMentorProposalBadge(),
  ]);
  return { checkins, proposals };
}
