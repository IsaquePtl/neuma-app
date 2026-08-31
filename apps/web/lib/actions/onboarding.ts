"use server";

import { revalidatePath } from "next/cache";

import {
  claimOnboardingByEmail,
  findLinkedOnboarding,
  studentHasOnboardingSubmission,
} from "@/lib/onboarding/submission";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getTallyConfig,
  parseTallyEmbedSubmission,
  resolveTallySubmissionKind,
  type TallyEmbedSubmissionPayload,
} from "@/lib/tally";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Non-blocking status check for logged-in onboarding (claim + link in background). */
export async function getOnboardingSubmissionStatus(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  return studentHasOnboardingSubmission({
    studentId: user.id,
    email: user.email,
  });
}

function revalidateOnboardingPaths(studentId: string) {
  revalidatePath("/home");
  revalidatePath("/onboarding");
  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath("/studio/journeys/onboardings");
  revalidatePath("/studio/inbox");
}

/**
 * Persist onboarding from Tally iframe `FormSubmitted` (includes answers).
 * Does not depend on the Tally webhook — required for localhost and as a
 * reliable fallback when the webhook is delayed or misconfigured.
 * Session user is the binding source of truth (not the hidden field alone).
 */
export async function persistOnboardingFromEmbed(
  embed: TallyEmbedSubmissionPayload,
): Promise<{ ok: boolean; submissionId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, submissionId: null };
  }

  const config = getTallyConfig();
  const parsed = parseTallyEmbedSubmission(embed);
  const formId = parsed.formId ?? config.onboardingFormId;

  if (formId !== config.onboardingFormId) {
    console.warn("[onboarding:embed] unexpected formId", {
      got: parsed.formId,
      expected: config.onboardingFormId,
    });
    return { ok: false, submissionId: null };
  }

  const existing = await findLinkedOnboarding(user.id);
  if (existing) {
    revalidateOnboardingPaths(user.id);
    return { ok: true, submissionId: existing };
  }

  const admin = createAdminClient();
  const responseId = parsed.responseId ?? parsed.submissionId;

  if (responseId) {
    const { data: byResponse } = await admin
      .from("tally_submissions")
      .select("id, student_id, status")
      .eq("submission_kind", "onboarding")
      .eq("source_response_id", responseId)
      .neq("status", "archived")
      .maybeSingle();

    // Session account email is the source of truth for logged-in embed persist.
    // Do not prefer the email typed in the Tally form (may differ from the account).
    const sessionEmail = user.email?.trim().toLowerCase() || null;

    if (byResponse?.id) {
      if (byResponse.student_id === user.id) {
        // Correct display email even if webhook persisted the form-typed one first.
        if (sessionEmail) {
          await admin
            .from("tally_submissions")
            .update({ respondent_email: sessionEmail })
            .eq("id", byResponse.id);
        }
        revalidateOnboardingPaths(user.id);
        return { ok: true, submissionId: byResponse.id };
      }
      if (!byResponse.student_id) {
        const { data: linked } = await admin
          .from("tally_submissions")
          .update({
            student_id: user.id,
            status: "linked",
            ...(sessionEmail ? { respondent_email: sessionEmail } : {}),
          })
          .eq("id", byResponse.id)
          .is("student_id", null)
          .select("id")
          .maybeSingle();
        if (linked?.id) {
          revalidateOnboardingPaths(user.id);
          return { ok: true, submissionId: linked.id };
        }
      }
    }
  }

  const respondentEmail = user.email?.trim().toLowerCase() || null;

  const { data: inserted, error } = await admin
    .from("tally_submissions")
    .insert({
      source_event_id: parsed.eventId,
      source_response_id: responseId,
      source_submission_id: parsed.submissionId ?? responseId,
      source_form_id: formId,
      source_form_name: parsed.formName,
      submission_kind: "onboarding",
      status: "linked",
      respondent_name: parsed.respondentName,
      respondent_email: respondentEmail,
      student_id: user.id,
      notes: parsed.notes,
      answers: parsed.answers,
      payload: parsed.payload,
      created_at: parsed.createdAt ?? undefined,
      processed_at: null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const linked = await findLinkedOnboarding(user.id);
      if (linked) {
        revalidateOnboardingPaths(user.id);
        return { ok: true, submissionId: linked };
      }
      const claimed = await claimOnboardingByEmail({
        studentId: user.id,
        email: respondentEmail,
      });
      return { ok: Boolean(claimed), submissionId: claimed };
    }
    console.error("[onboarding:embed] persist_failed", error);
    return { ok: false, submissionId: null };
  }

  revalidateOnboardingPaths(user.id);
  return { ok: true, submissionId: inserted.id };
}

/**
 * Persist onboarding from the public embed (no login). Webhook may arrive later;
 * this ensures orphan submissions appear in studio for manual linking.
 */
export async function persistPublicOnboardingFromEmbed(
  embed: TallyEmbedSubmissionPayload,
): Promise<{ ok: boolean; submissionId: string | null }> {
  const config = getTallyConfig();
  const parsed = parseTallyEmbedSubmission(embed);
  const formId = parsed.formId ?? config.onboardingFormId;
  const submissionKind = resolveTallySubmissionKind(
    formId,
    parsed.formName,
    config,
  );

  if (submissionKind !== "onboarding") {
    console.warn("[onboarding:public] unexpected form", {
      formId,
      formName: parsed.formName,
      kind: submissionKind,
    });
    return { ok: false, submissionId: null };
  }

  const admin = createAdminClient();
  const responseId = parsed.responseId ?? parsed.submissionId;

  if (responseId) {
    const { data: existing } = await admin
      .from("tally_submissions")
      .select("id, student_id, status")
      .eq("source_response_id", responseId)
      .neq("status", "archived")
      .maybeSingle();

    if (existing?.id) {
      if (existing.student_id) {
        revalidateOnboardingPaths(existing.student_id);
      } else {
        revalidatePath("/studio/journeys/onboardings");
        revalidatePath("/studio/inbox");
      }
      return { ok: true, submissionId: existing.id };
    }
  }

  let trustedStudentId: string | null = null;
  let respondentEmail = parsed.respondentEmail?.trim().toLowerCase() || null;
  if (parsed.respondentEmail) {
    const email = parsed.respondentEmail.trim();
    const { data: matches } = await admin
      .from("profiles")
      .select("id, email")
      .eq("role", "student")
      .ilike("email", email)
      .limit(2);
    if (matches?.length === 1) {
      trustedStudentId = matches[0].id;
      respondentEmail = matches[0].email?.trim().toLowerCase() || respondentEmail;
    }
  }

  const { data: inserted, error } = await admin
    .from("tally_submissions")
    .insert({
      source_event_id:
        parsed.eventId ?? (responseId ? `embed-public:${responseId}` : null),
      source_response_id: responseId,
      source_submission_id: parsed.submissionId ?? responseId,
      source_form_id: formId,
      source_form_name: parsed.formName,
      submission_kind: "onboarding",
      status: trustedStudentId ? "linked" : "pending",
      respondent_name: parsed.respondentName,
      respondent_email: respondentEmail,
      student_id: trustedStudentId,
      notes: parsed.notes,
      answers: parsed.answers,
      payload: parsed.payload,
      created_at: parsed.createdAt ?? undefined,
      processed_at: null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && responseId) {
      const { data: existing } = await admin
        .from("tally_submissions")
        .select("id")
        .eq("source_response_id", responseId)
        .neq("status", "archived")
        .maybeSingle();
      if (existing?.id) {
        return { ok: true, submissionId: existing.id };
      }
    }
    console.error("[onboarding:public] persist_failed", error);
    return { ok: false, submissionId: null };
  }

  if (trustedStudentId) {
    revalidateOnboardingPaths(trustedStudentId);
  } else {
    revalidatePath("/studio/journeys/onboardings");
    revalidatePath("/studio/inbox");
  }

  return { ok: true, submissionId: inserted.id };
}

/**
 * After Tally FormSubmitted: persist from embed payload when provided,
 * otherwise wait briefly for the webhook and claim by email.
 */
export async function confirmOnboardingSubmission(
  embed?: TallyEmbedSubmissionPayload | null,
): Promise<{
  ok: boolean;
  submissionId: string | null;
}> {
  if (embed && (embed.id || (embed.fields && embed.fields.length > 0) || embed.formId)) {
    const persisted = await persistOnboardingFromEmbed(embed);
    if (persisted.ok) return persisted;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, submissionId: null };
  }

  const email = user.email ?? null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const linked = await findLinkedOnboarding(user.id);
    if (linked) {
      revalidateOnboardingPaths(user.id);
      return { ok: true, submissionId: linked };
    }

    const claimed = await claimOnboardingByEmail({
      studentId: user.id,
      email,
    });
    if (claimed) {
      return { ok: true, submissionId: claimed };
    }

    await sleep(1000);
  }

  return { ok: false, submissionId: null };
}
