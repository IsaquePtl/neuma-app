import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { generateCheckInDraft } from "@/lib/ai/draft-feedback";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, sendEmail } from "@/lib/email";
import { ORPHAN_CHECKIN_LABEL } from "@/lib/labels";
import {
  getTallyConfig,
  parseTallyPayload,
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
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let parsed: ReturnType<typeof parseTallyPayload>;
  try {
    parsed = parseTallyPayload(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!parsed.formId) {
    return NextResponse.json({ ok: false, error: "missing_form_id" }, { status: 400 });
  }

  const submissionKind =
    parsed.formId === config.onboardingFormId
      ? "onboarding"
      : parsed.formId === config.checkinFormId
        ? "checkin"
        : "unknown";

  const admin = createAdminClient();
  const { data: intake, error: intakeError } = await admin
    .from("tally_submissions")
    .insert({
      source_event_id: parsed.eventId,
      source_response_id: parsed.responseId,
      source_submission_id: parsed.submissionId,
      source_form_id: parsed.formId,
      source_form_name: parsed.formName,
      submission_kind: submissionKind,
      status:
        submissionKind === "checkin" && parsed.studentId ? "linked" : "pending",
      respondent_name: parsed.respondentName,
      respondent_email: parsed.respondentEmail,
      student_id: parsed.studentId,
      node_id: parsed.nodeId,
      notes: parsed.notes,
      video_url: parsed.videoUrl,
      answers: parsed.answers,
      payload: parsed.payload,
      created_at: parsed.createdAt ?? undefined,
      processed_at:
        submissionKind === "checkin" && parsed.studentId
          ? new Date().toISOString()
          : null,
    })
    .select("id")
    .single();

  if (intakeError) {
    if (intakeError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[tally:intake]", intakeError);
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }

  revalidatePath("/studio");
  revalidatePath("/studio/inbox");
  revalidatePath("/studio/intake");

  if (submissionKind === "checkin" && parsed.studentId) {
    const checkInKind = parsed.videoUrl ? "video" : "text";
    const { data: checkIn, error: checkInError } = await admin
      .from("check_ins")
      .insert({
        node_id: parsed.nodeId ?? null,
        level_label: parsed.nodeId ? null : ORPHAN_CHECKIN_LABEL,
        student_id: parsed.studentId,
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
