"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CalBookingStatus, Json } from "@/lib/types/database.types";

export type EmbedBookingPayload = {
  uid: string;
  title?: string | null;
  startTime: string;
  endTime: string;
  meetUrl?: string | null;
  status?: string | null;
  isReschedule?: boolean;
  /** UID do agendamento anterior (quando Cal cria um novo no reschedule). */
  previousUid?: string | null;
  attendeeEmail?: string | null;
  attendeeName?: string | null;
};

export type EmbedCancelPayload = {
  uid: string;
};

function revalidateBookingPaths() {
  revalidatePath("/path", "layout");
  revalidatePath("/home");
  revalidatePath("/session");
  revalidatePath("/studio");
  revalidatePath("/studio/calendar");
}

async function resolveStudentId(
  admin: ReturnType<typeof createAdminClient>,
  {
    userId,
    userRole,
    attendeeEmail,
  }: {
    userId: string;
    userRole: string | null;
    attendeeEmail: string | null;
  },
): Promise<{ studentId: string | null; attendeeEmail: string | null }> {
  if (attendeeEmail) {
    const { data: student } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .ilike("email", attendeeEmail)
      .maybeSingle();
    if (student?.id) {
      return { studentId: student.id, attendeeEmail };
    }
  }

  if (userRole === "student") {
    return { studentId: userId, attendeeEmail };
  }

  return { studentId: null, attendeeEmail };
}

/** Persiste marcação vinda do embed Cal (não espera pelo webhook). */
export async function syncCalBookingFromEmbed(payload: EmbedBookingPayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const uid = (payload.uid || "").trim();
  const startTime = (payload.startTime || "").trim();
  const endTime = (payload.endTime || "").trim();
  if (!uid || !startTime || !endTime) {
    throw new Error("Dados de marcacao incompletos");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const statusRaw = (payload.status || "").toUpperCase();
  let status: CalBookingStatus = "accepted";
  if (statusRaw.includes("PENDING")) status = "pending";
  if (statusRaw.includes("CANCEL")) status = "cancelled";

  const payloadEmail = payload.attendeeEmail?.trim() || null;
  const payloadName = payload.attendeeName?.trim() || null;

  const admin = createAdminClient();
  const { studentId, attendeeEmail } = await resolveStudentId(admin, {
    userId: user.id,
    userRole: profile?.role ?? null,
    attendeeEmail:
      payloadEmail ||
      (profile?.role === "student"
        ? (profile.email ?? user.email ?? null)
        : null),
  });

  const attendeeName =
    payloadName ||
    (profile?.role === "student" ? (profile.full_name ?? null) : null);

  const { error } = await admin.from("cal_bookings").upsert(
    {
      cal_booking_uid: uid,
      trigger_event: payload.isReschedule
        ? "BOOKING_RESCHEDULED"
        : "BOOKING_CREATED",
      status,
      title: payload.title?.trim() || "Sessão 1:1",
      start_time: startTime,
      end_time: endTime,
      meet_url: payload.meetUrl?.trim() || null,
      attendee_email: attendeeEmail,
      attendee_name: attendeeName,
      student_id: studentId,
      payload: {
        source: "cal_embed",
        synced_at: new Date().toISOString(),
      } as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cal_booking_uid" },
  );

  if (error) throw new Error(error.message);

  const previousUid = (payload.previousUid || "").trim();
  if (previousUid && previousUid !== uid) {
    let q = admin
      .from("cal_bookings")
      .update({
        status: "cancelled",
        trigger_event: "BOOKING_RESCHEDULED",
        updated_at: new Date().toISOString(),
      })
      .eq("cal_booking_uid", previousUid);
    if (studentId) q = q.eq("student_id", studentId);
    await q;
  }

  revalidateBookingPaths();
}

/** Marca cancelamento vindo do embed Cal. */
export async function cancelCalBookingFromEmbed(payload: EmbedCancelPayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const uid = (payload.uid || "").trim();
  if (!uid) throw new Error("UID em falta");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const cancelPatch = {
    status: "cancelled" as const,
    trigger_event: "BOOKING_CANCELLED",
    updated_at: now,
  };

  let query = admin
    .from("cal_bookings")
    .update(cancelPatch)
    .eq("cal_booking_uid", uid);

  // Aluno: só a própria; mentor: qualquer marcação com esse UID.
  if (profile?.role === "student") {
    query = query.eq("student_id", user.id);
  }

  const { data: updated, error } = await query.select("id");

  if (error) throw new Error(error.message);

  if (!updated?.length) {
    throw new Error("Marcação não encontrada para cancelar");
  }

  revalidateBookingPaths();
}
