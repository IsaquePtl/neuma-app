import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/** Deduplica getUser() no mesmo request RSC. */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Perfil do user autenticado — cacheado por request. */
export const getCurrentProfile = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, role, full_name, email, avatar_url, onboarding_completed, internal_notes, created_at",
    )
    .eq("id", user.id)
    .single();

  return data;
});

/** Badge leve: check-ins pending + onboardings pending (mentor). */
export const getMentorNavBadge = cache(async () => {
  const supabase = await createClient();
  const [{ count: pendingCheckIns }, { count: pendingOnboardings }] =
    await Promise.all([
      supabase
        .from("check_ins")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("tally_submissions")
        .select("id", { count: "exact", head: true })
        .eq("submission_kind", "onboarding")
        .eq("status", "pending"),
    ]);
  return (pendingCheckIns ?? 0) + (pendingOnboardings ?? 0);
});

/** @deprecated use getMentorNavBadge */
export const getMentorPendingCheckIns = getMentorNavBadge;

/** Badge leve: so needs_revision do aluno (sem waterfall de feedbacks). */
export const getStudentNavBadge = cache(async (studentId: string) => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "needs_revision");
  return count ?? 0;
});
