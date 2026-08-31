import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { generateCheckInDraft } from "@/lib/ai/draft-feedback";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, sendEmail } from "@/lib/email";
import { ORPHAN_CHECKIN_LABEL } from "@/lib/labels";
import {
  getTallyConfig,
  parseTallyPayload,
  resolveTallySubmissionKind,
  verifyTallySignature,
} from "@/lib/tally";

async function notifyMentor({
  subject,
  html,
}: {
  subject: string;
  html: string;
}) {
  try {
    const admin = createAdminClient();
    const { data: mentor } = await admin
      .from("profiles")
      .select("email")
      .eq("role", "mentor")
      .limit(1)
      .maybeSingle();

    if (mentor?.email) {
      await sendEmail({ to: mentor.email, subject, html });
    }
  } catch (error) {
    console.error("[tally:notify]", error);
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("tally-signature");
  const config = getTallyConfig();

  if (
    !verifyTallySignature({
      rawBody,
      signature,
      secrets: config.webhookSecrets,
    })
  ) {
    console.error("[tally:webhook] invalid_signature", {
      hasSignature: Boolean(signature),
      secretsConfigured: config.webhookSecrets.length,
      bodyBytes: rawBody.length,
    });
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let parsed: ReturnType<typeof parseTallyPayload>;
  try {
    parsed = parseTallyPayload(rawBody);
  } catch (error) {
    console.error("[tally:webhook] invalid_json", error);
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!parsed.formId) {
    console.error("[tally:webhook] missing_form_id", {
      eventId: parsed.eventId,
      formName: parsed.formName,
    });
    return NextResponse.json({ ok: false, error: "missing_form_id" }, { status: 400 });
  }

  const submissionKind = resolveTallySubmissionKind(
    parsed.formId,
    parsed.formName,
    config,
  );

  if (submissionKind === "unknown") {
    // Still persist — mentor can triage in studio/inbox — but surface misconfig.
    console.warn("[tally:webhook] unknown formId (persisting as unknown)", {
      formId: parsed.formId,
      expectedOnboarding: config.onboardingFormId,
      expectedCheckin: config.checkinFormId,
      formName: parsed.formName,
      eventId: parsed.eventId,
    });
  } else {
    console.info("[tally:webhook] accepted", {
      kind: submissionKind,
      formId: parsed.formId,
      eventId: parsed.eventId,
      responseId: parsed.responseId,
      hasStudentId: Boolean(parsed.studentId),
      hasEmail: Boolean(parsed.respondentEmail),
    });
  }

  const admin = createAdminClient();

  // Embed path may already have persisted this response (source_response_id).
  // Skip a second row when the webhook arrives later (or after localhost).
  if (parsed.responseId && submissionKind === "onboarding") {
    const { data: existingByResponse } = await admin
      .from("tally_submissions")
      .select("id, student_id, status")
      .eq("source_response_id", parsed.responseId)
      .eq("submission_kind", "onboarding")
      .neq("status", "archived")
      .maybeSingle();

    if (existingByResponse?.id) {
      console.info("[tally:webhook] duplicate response ignored", {
        responseId: parsed.responseId,
        intakeId: existingByResponse.id,
        studentId: existingByResponse.student_id,
      });
      if (existingByResponse.student_id) {
        revalidatePath("/home");
        revalidatePath("/onboarding");
      }
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  // Hidden-field student_id is not cryptographic proof — only trust it when it
  // matches an existing student profile. Residual risk: anyone who knows a
  // profile UUID can still attach a Tally submission to that account.
  let trustedStudentId: string | null = null;
  let trustedProfileEmail: string | null = null;
  if (parsed.studentId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, email")
      .eq("id", parsed.studentId)
      .maybeSingle();
    if (!profile?.id) {
      console.warn("[tally:webhook] ignoring unknown student_id", parsed.studentId);
    } else if (profile.role !== "student") {
      // Never attach onboarding/check-in to a mentor (or other) profile —
      // mentor admin "Abrir ficha" would 404 on /studio/students/[mentorId].
      console.warn(
        "[tally:webhook] ignoring non-student student_id",
        parsed.studentId,
        profile.role,
      );
    } else {
      trustedStudentId = profile.id;
      trustedProfileEmail = profile.email?.trim().toLowerCase() || null;
    }
  }

  // Onboarding without hidden student_id: auto-link by respondent email when
  // exactly one student profile matches (covers public form + field mismatch).
  if (
    !trustedStudentId &&
    submissionKind === "onboarding" &&
    parsed.respondentEmail
  ) {
    const email = parsed.respondentEmail.trim();
    const { data: matches } = await admin
      .from("profiles")
      .select("id, email")
      .eq("role", "student")
      .ilike("email", email)
      .limit(2);
    if (matches?.length === 1) {
      trustedStudentId = matches[0].id;
      trustedProfileEmail = matches[0].email?.trim().toLowerCase() || null;
    }
  }

  // Prefer account/profile email when we trust a student; form email only as
  // fallback (public/orphan onboarding without a matched profile).
  const respondentEmail =
    (submissionKind === "onboarding" && trustedStudentId
      ? trustedProfileEmail || parsed.respondentEmail?.trim().toLowerCase() || null
      : parsed.respondentEmail?.trim().toLowerCase() || null) ?? null;

  // Onboarding com student_id: auto-vincula (status linked) mas fica à espera
  // de confirmação do mentor — não marca onboarding_completed aqui.
  const linkedOnboarding =
    submissionKind === "onboarding" && Boolean(trustedStudentId);
  const autoLinkedCheckin =
    submissionKind === "checkin" && Boolean(trustedStudentId);
  const { data: intake, error: intakeError } = await admin
    .from("tally_submissions")
    .insert({
      source_event_id: parsed.eventId,
      source_response_id: parsed.responseId,
      source_submission_id: parsed.submissionId,
      source_form_id: parsed.formId,
      source_form_name: parsed.formName,
      submission_kind: submissionKind,
      status: autoLinkedCheckin || linkedOnboarding ? "linked" : "pending",
      respondent_name: parsed.respondentName,
      respondent_email: respondentEmail,
      student_id: trustedStudentId,
      node_id: parsed.nodeId,
      notes: parsed.notes,
      video_url: parsed.videoUrl,
      answers: parsed.answers,
      payload: parsed.payload,
      created_at: parsed.createdAt ?? undefined,
      // Check-in auto-ligado: processado. Onboarding: só após confirmar no studio.
      processed_at: autoLinkedCheckin ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (intakeError) {
    if (intakeError.code === "23505") {
      console.info("[tally:webhook] duplicate event ignored", {
        eventId: parsed.eventId,
        formId: parsed.formId,
      });
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[tally:intake]", intakeError);
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }

  console.info("[tally:webhook] persisted", {
    intakeId: intake.id,
    kind: submissionKind,
    studentId: trustedStudentId,
    status: autoLinkedCheckin || linkedOnboarding ? "linked" : "pending",
  });

  if (linkedOnboarding && trustedStudentId) {
    revalidatePath("/home");
    revalidatePath("/onboarding");
    revalidatePath(`/studio/students/${trustedStudentId}`);
  }

  revalidatePath("/studio");
  revalidatePath("/studio/inbox");
  revalidatePath("/studio/intake");
  revalidatePath("/studio/journeys/onboardings");

  if (submissionKind === "checkin" && trustedStudentId) {
    const checkInKind = parsed.videoUrl ? "video" : "text";
    const { data: checkIn, error: checkInError } = await admin
      .from("check_ins")
      .insert({
        node_id: parsed.nodeId ?? null,
        level_label: parsed.nodeId ? null : ORPHAN_CHECKIN_LABEL,
        student_id: trustedStudentId,
        kind: checkInKind,
        video_url: parsed.videoUrl,
        notes: parsed.notes,
        status: "pending",
        created_at: parsed.createdAt ?? undefined,
      })
      .select("id")
      .single();

    if (checkInError || !checkIn) {
      console.error("[tally:checkin]", checkInError);
      await admin
        .from("tally_submissions")
        .update({ status: "failed", processed_at: new Date().toISOString() })
        .eq("id", intake.id);

      after(async () => {
        await notifyMentor({
          subject: `Check-in Tally por ligar: ${parsed.respondentName ?? parsed.respondentEmail ?? "aluno"}`,
          html: `<p>Chegou um check-in do Tally mas nao foi possivel liga-lo automaticamente.</p><p><a href="${appUrl("/studio/inbox")}">Abrir inbox na Neuma</a></p>`,
        });
      });

      return NextResponse.json({ ok: true, linked: false });
    }

    await admin
      .from("tally_submissions")
      .update({
        check_in_id: checkIn.id,
        status: "linked",
        processed_at: new Date().toISOString(),
      })
      .eq("id", intake.id);

    revalidatePath("/studio/checkins");
    revalidatePath("/studio/inbox");
    revalidatePath(`/studio/checkins/${checkIn.id}`);

    after(async () => {
      await generateCheckInDraft(checkIn.id);
      await notifyMentor({
        subject: `Novo check-in de ${parsed.respondentName ?? parsed.respondentEmail ?? "aluno"}`,
        html: `<p>Entrou um novo check-in via Tally e ja esta pronto para revisao.</p><p><a href="${appUrl(`/studio/checkins/${checkIn.id}`)}">Abrir check-in na Neuma</a></p>`,
      });
    });

    return NextResponse.json({ ok: true, linked: true, checkInId: checkIn.id });
  }

  after(async () => {
    const title =
      submissionKind === "onboarding"
        ? `Novo onboarding: ${parsed.respondentName ?? parsed.respondentEmail ?? "resposta nova"}`
        : `Nova submissao Tally: ${parsed.respondentName ?? parsed.respondentEmail ?? "resposta nova"}`;
    await notifyMentor({
      subject: title,
      html: `<p>Chegou uma nova submissao do Tally.</p><p><a href="${appUrl("/studio/inbox#forms")}">Abrir inbox na Neuma</a></p>`,
    });
  });

  return NextResponse.json({ ok: true, linked: false });
}
