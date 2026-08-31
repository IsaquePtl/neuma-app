import { cache } from "react";

import { ensureDefaultMentorForStudent } from "@/lib/auth/default-mentor";
import { createClient } from "@/lib/supabase/server";
import { getTallyConfig, isOnboardingTallySubmission } from "@/lib/tally";

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

/** Check-ins pendentes de revisão (mentor). */
export const getMentorPendingCheckInsCount = cache(async () => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
});

/** Onboardings por tratar (mentor). */
export const getMentorPendingOnboardingsCount = cache(async () => {
  const supabase = await createClient();
  const { onboardingFormId } = getTallyConfig();
  const { data } = await supabase
    .from("tally_submissions")
    .select(
      "id, submission_kind, status, student_id, source_form_id, source_form_name",
    )
    .neq("status", "archived");

  return (
    data?.filter((row) => {
      if (!isOnboardingTallySubmission(row, onboardingFormId)) return false;
      return !row.student_id || row.status === "pending" || row.status === "linked";
    }).length ?? 0
  );
});

/** Badge leve: check-ins pending + onboardings por tratar (mentor). */
export const getMentorNavBadge = cache(async () => {
  const [pendingCheckIns, pendingOnboardings] = await Promise.all([
    getMentorPendingCheckInsCount(),
    getMentorPendingOnboardingsCount(),
  ]);
  return pendingCheckIns + pendingOnboardings;
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
