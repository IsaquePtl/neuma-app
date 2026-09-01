"use server";

import { getStudentNavBadge, getSessionUser } from "@/lib/auth/session";

/** Badge do aluno (Mentor tab) — hydrate no cliente após marcar feedback como visto. */
export async function fetchStudentNavBadge() {
  const user = await getSessionUser();
  if (!user) return 0;
  return getStudentNavBadge(user.id);
}
