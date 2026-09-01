"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  claimOnboardingByEmail,
  findLinkedOnboarding,
  studentHasOnboardingSubmission,
} from "@/lib/onboarding/submission";
import {
  ONBOARDING_FORM_ID,
  ONBOARDING_FORM_NAME,
  ONBOARDING_FIELDS,
  onboardingAnswerFields,
  resolveOnboardingLabel,
  type OnboardingFieldDef,
} from "@/lib/onboarding/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database.types";
import {
  getTallyConfig,
  parseTallyEmbedSubmission,
  resolveTallySubmissionKind,
  type TallyAnswer,
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

function normalizeEmail(email: string | null | undefined) {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

function fieldValue(
  values: Record<string, string>,
  field: OnboardingFieldDef,
): Json {
  const raw = values[field.tallyKey]?.trim() ?? "";
  if (!raw) return null;

  if (field.type === "INPUT_NUMBER" || field.type === "LINEAR_SCALE") {
    const num = Number(raw);
    return Number.isFinite(num) ? num : raw;
  }

  return raw;
}

function buildNativeOnboardingAnswers(
  values: Record<string, string>,
  nome: string,
  studentId?: string | null,
): TallyAnswer[] {
  const answers: TallyAnswer[] = onboardingAnswerFields().map((field) => ({
    key: field.tallyKey,
    label: field.dynamicNome
      ? resolveOnboardingLabel(field.label, nome)
      : field.label,
    type: field.type,
    value: fieldValue(values, field),
    options: field.options?.length
      ? field.options.map((option) => ({
          id: option.id,
          text: option.text,
        }))
      : null,
  }));

  if (studentId) {
    answers.push({
      key: ONBOARDING_FIELDS.studentId.tallyKey,
      label: ONBOARDING_FIELDS.studentId.label,
      type: ONBOARDING_FIELDS.studentId.type,
      value: studentId,
      options: null,
    });
  }

  return answers;
}

function buildNativeOnboardingPayload(params: {
  responseId: string;
  answers: TallyAnswer[];
  studentId?: string | null;
}) {
  const fields = params.answers.map((answer) => ({
    key: answer.key,
    label: answer.label,
    type: answer.type,
    value: answer.value,
    options: answer.options ?? undefined,
  }));

  return {
    eventId: `native:${params.responseId}`,
    eventType: "FORM_RESPONSE",
    createdAt: new Date().toISOString(),
    data: {
      responseId: params.responseId,
      submissionId: params.responseId,
      formId: ONBOARDING_FORM_ID,
      formName: ONBOARDING_FORM_NAME,
      createdAt: new Date().toISOString(),
      fields,
      ...(params.studentId ? { student_id: params.studentId } : {}),
    },
  };
}

export async function submitOnboarding(
  values: Record<string, string>,
): Promise<{
  ok: boolean;
  alreadySubmitted?: boolean;
  submissionId?: string | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nome = values[ONBOARDING_FIELDS.name.tallyKey]?.trim() ?? "";
  if (!nome) {
    return { ok: false, error: "Indica o teu nome." };
  }

  for (const field of onboardingAnswerFields()) {
    if (field.required === false) continue;
    const value = values[field.tallyKey]?.trim() ?? "";
    if (!value) {
      return {
        ok: false,
        error: `Preenche «${field.label.split("\n")[0]}».`,
      };
    }
  }

  if (user) {
    const existing = await findLinkedOnboarding(user.id);
    if (existing) {
      revalidateOnboardingPaths(user.id);
      return { ok: true, alreadySubmitted: true, submissionId: existing };
    }
  }

  const sessionEmail = normalizeEmail(user?.email);
  const formEmail = normalizeEmail(values[ONBOARDING_FIELDS.email.tallyKey]);
  const respondentEmail = sessionEmail ?? formEmail;
  if (!respondentEmail) {
    return { ok: false, error: "Indica o teu email." };
  }

  const answers = buildNativeOnboardingAnswers(values, nome, user?.id ?? null);
  const responseId = crypto.randomUUID();
  const payload = buildNativeOnboardingPayload({
    responseId,
    answers,
    studentId: user?.id ?? null,
  });

  const admin = createAdminClient();
  let trustedStudentId: string | null = user?.id ?? null;
  let trustedProfileEmail: string | null = sessionEmail;

  if (!trustedStudentId && respondentEmail) {
    const { data: matches } = await admin
      .from("profiles")
      .select("id, email, role")
      .eq("role", "student")
      .ilike("email", respondentEmail)
      .limit(2);

    if (matches?.length === 1) {
      trustedStudentId = matches[0].id;
      trustedProfileEmail =
        normalizeEmail(matches[0].email) ?? respondentEmail;
    }
  }

  const { data: inserted, error } = await admin
    .from("tally_submissions")
    .insert({
      source: "native",
      source_event_id: `native:${responseId}`,
      source_response_id: responseId,
      source_submission_id: responseId,
      source_form_id: ONBOARDING_FORM_ID,
      source_form_name: ONBOARDING_FORM_NAME,
      submission_kind: "onboarding",
      status: trustedStudentId ? "linked" : "pending",
      respondent_name: nome,
      respondent_email: trustedProfileEmail ?? respondentEmail,
      student_id: trustedStudentId,
      notes: null,
      answers,
      payload,
      processed_at: null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && user) {
      const linked = await findLinkedOnboarding(user.id);
      if (linked) {
        revalidateOnboardingPaths(user.id);
        return { ok: true, alreadySubmitted: true, submissionId: linked };
      }
      const claimed = await claimOnboardingByEmail({
        studentId: user.id,
        email: respondentEmail,
      });
      if (claimed) {
        return { ok: true, submissionId: claimed };
      }
    }
    console.error("[onboarding:native] persist_failed", error);
    return { ok: false, error: "Não foi possível guardar o onboarding." };
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
