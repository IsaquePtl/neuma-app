import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, sendEmail } from "@/lib/email";
import {
  getCalWebhookSecret,
  parseCalWebhook,
  verifyCalSignature,
} from "@/lib/cal";

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
    console.error("[cal:notify]", error);
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-cal-signature-256");
  const secret = getCalWebhookSecret();

  if (!verifyCalSignature({ rawBody, signature, secret })) {
    return NextResponse.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 },
    );
  }

  let parsed: ReturnType<typeof parseCalWebhook>;
  try {
    parsed = parseCalWebhook(rawBody);
  } catch (error) {
    console.error("[cal:parse]", error);
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 },
    );
  }

  // Ignorar triggers que não são bookings de agenda
  // O Cal.com envia vários eventos (ACCEPTED/CONFIRMED/RESCHEDULED/etc.).
  // O que interessa para a UI é: quando houver uma "booking" com start/end,
  // guardar/atualizar `cal_bookings`.
  // Ignoramos apenas eventos que não sejam do domínio de BOOKING_*.
  if (!parsed.triggerEvent.startsWith("BOOKING_")) {
    return NextResponse.json({ ok: true, ignored: parsed.triggerEvent });
  }

  const admin = createAdminClient();

  let studentId: string | null = null;
  if (parsed.attendeeEmail) {
    const { data: student } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .ilike("email", parsed.attendeeEmail)
      .maybeSingle();
    studentId = student?.id ?? null;
  }

  const row = {
    cal_booking_uid: parsed.uid,
    cal_booking_id: parsed.bookingId,
    trigger_event: parsed.triggerEvent,
    status: parsed.status,
    title: parsed.title,
    event_type_slug: parsed.eventTypeSlug,
    start_time: parsed.startTime,
    end_time: parsed.endTime,
    timezone: parsed.timezone,
    meet_url: parsed.meetUrl,
    organizer_email: parsed.organizerEmail,
    organizer_name: parsed.organizerName,
    attendee_email: parsed.attendeeEmail,
    attendee_name: parsed.attendeeName,
    student_id: studentId,
    notes: parsed.notes,
    payload: parsed.payload,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("cal_bookings").upsert(row, {
    onConflict: "cal_booking_uid",
  });

  if (error) {
    console.error("[cal:persist]", error);
    return NextResponse.json(
      { ok: false, error: "persist_failed" },
      { status: 500 },
    );
  }

  revalidatePath("/studio");
  revalidatePath("/session");
  revalidatePath("/path", "layout");
  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
    revalidatePath("/home");
  }

  after(async () => {
    const who =
      parsed.attendeeName ?? parsed.attendeeEmail ?? "alguém";
    const when = new Date(parsed.startTime).toLocaleString("pt-PT", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    if (parsed.triggerEvent === "BOOKING_CREATED") {
      await notifyMentor({
        subject: `Nova marcação: ${who}`,
        html: `<p>${who} marcou ${parsed.title ?? "uma sessão"} para ${when}.</p><p><a href="${appUrl("/studio")}">Abrir Centro de Comando</a></p>`,
      });
    } else if (parsed.triggerEvent === "BOOKING_CANCELLED") {
      await notifyMentor({
        subject: `Marcação cancelada: ${who}`,
        html: `<p>${who} cancelou ${parsed.title ?? "a sessão"} de ${when}.</p><p><a href="${appUrl("/studio")}">Abrir Centro de Comando</a></p>`,
      });
    } else if (parsed.triggerEvent === "BOOKING_RESCHEDULED") {
      await notifyMentor({
        subject: `Marcação reagendada: ${who}`,
        html: `<p>${who} reagendou para ${when}.</p><p><a href="${appUrl("/studio")}">Abrir Centro de Comando</a></p>`,
      });
    }
  });

  return NextResponse.json({
    ok: true,
    uid: parsed.uid,
    status: parsed.status,
    studentLinked: Boolean(studentId),
  });
}
