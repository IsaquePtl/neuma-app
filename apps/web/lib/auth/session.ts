import { cache } from "react";

import { ensureDefaultMentorForStudent } from "@/lib/auth/default-mentor";
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
      "id, role, full_name, email, avatar_url, onboarding_completed, internal_notes, created_at, mentor_id",
    )
    .eq("id", user.id)
    .single();

  // Rede de segurança: aluno sem mentor (ex. conta antiga / race no signup).
  if (data?.role === "student" && !data.mentor_id) {
    await ensureDefaultMentorForStudent(data.id);
  }

  return data;
});

/** Badge leve: check-ins pending + onboardings por tratar (mentor). */
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
        .in("status", ["pending", "linked"]),
    ]);
  return (pendingCheckIns ?? 0) + (pendingOnboardings ?? 0);
});

/** Badge: propostas do Agent à espera de validação. */
export const getMentorProposalBadge = cache(async () => {
  const user = await getSessionUser();
  if (!user) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("agent_proposals")
    .select("id", { count: "exact", head: true })
    .eq("mentor_id", user.id)
    .eq("status", "pending");
  return count ?? 0;
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
