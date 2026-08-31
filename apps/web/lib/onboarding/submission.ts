import "server-only";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTallyConfig, isOnboardingTallySubmission } from "@/lib/tally";

function normalizeEmail(email: string | null | undefined) {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

/**
 * Find a non-archived onboarding row for this student (by student_id).
 * Uses the session client so RLS applies.
 */
export async function findLinkedOnboarding(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tally_submissions")
    .select("id")
    .eq("submission_kind", "onboarding")
    .eq("student_id", studentId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function findOrphanOnboardingByEmail(email: string) {
  const admin = createAdminClient();
  const config = getTallyConfig();
  const { data: rows } = await admin
    .from("tally_submissions")
    .select(
      "id, student_id, respondent_email, submission_kind, source_form_id, source_form_name",
    )
    .is("student_id", null)
    .neq("status", "archived")
    .ilike("respondent_email", email)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    rows?.find((row) => isOnboardingTallySubmission(row, config.onboardingFormId)) ??
    null
  );
}

/**
 * Claim an unlinked onboarding submission whose respondent_email matches
 * the logged-in user. Uses service role (RLS only allows student_id = auth.uid()).
 */
export async function claimOnboardingByEmail(params: {
  studentId: string;
  email: string | null | undefined;
}): Promise<string | null> {
  const email = normalizeEmail(params.email);
  if (!email) return null;

  const admin = createAdminClient();

  const orphan = await findOrphanOnboardingByEmail(email);

  if (!orphan?.id) return null;

  const { data: updated, error } = await admin
    .from("tally_submissions")
    .update({
      student_id: params.studentId,
      status: "linked",
      // Prefer the claiming account email over whatever was typed in the form.
      respondent_email: email,
    })
    .eq("id", orphan.id)
    .is("student_id", null)
    .select("id")
    .maybeSingle();

  if (error || !updated?.id) {
    console.warn("[onboarding:claim]", error ?? "no row updated");
    return null;
  }

  revalidatePath("/home");
  revalidatePath("/onboarding");
  revalidatePath(`/studio/students/${params.studentId}`);
  revalidatePath("/studio/journeys/onboardings");
  revalidatePath("/studio/inbox");
  return updated.id;
}

/**
 * Ensure onboarding is linked for this user: existing student_id match,
 * or claim orphan by email. Returns submission id when present.
 */
export async function ensureStudentOnboardingLinked(params: {
  studentId: string;
  email: string | null | undefined;
}): Promise<string | null> {
  const linked = await findLinkedOnboarding(params.studentId);
  if (linked) return linked;
  return claimOnboardingByEmail(params);
}

export async function studentHasOnboardingSubmission(params: {
  studentId: string;
  email: string | null | undefined;
}): Promise<boolean> {
  const id = await ensureStudentOnboardingLinked(params);
  return Boolean(id);
}
