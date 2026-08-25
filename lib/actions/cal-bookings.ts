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
    .select("email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const statusRaw = (payload.status || "").toUpperCase();
  let status: CalBookingStatus = "accepted";
  if (statusRaw.includes("PENDING")) status = "pending";
  if (statusRaw.includes("CANCEL")) status = "cancelled";

  const admin = createAdminClient();
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
      attendee_email: profile?.email ?? user.email ?? null,
      attendee_name: profile?.full_name ?? null,
      student_id: user.id,
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
    await admin
      .from("cal_bookings")
      .update({
        status: "cancelled",
        trigger_event: "BOOKING_RESCHEDULED",
        updated_at: new Date().toISOString(),
      })
      .eq("cal_booking_uid", previousUid)
      .eq("student_id", user.id);
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

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const cancelPatch = {
    status: "cancelled" as const,
    trigger_event: "BOOKING_CANCELLED",
    updated_at: now,
  };

  // Preferência: UID + aluno
  let { data: updated, error } = await admin
    .from("cal_bookings")
    .update(cancelPatch)
    .eq("cal_booking_uid", uid)
    .eq("student_id", user.id)
    .select("id");

  if (error) throw new Error(error.message);

  // Fallback: só UID (row sem student_id)
  if (!updated?.length) {
    const retry = await admin
      .from("cal_bookings")
      .update({ ...cancelPatch, student_id: user.id })
      .eq("cal_booking_uid", uid)
      .select("id");
    if (retry.error) throw new Error(retry.error.message);
    updated = retry.data;
  }

  if (!updated?.length) {
    throw new Error("Marcação não encontrada para cancelar");
  }

  revalidateBookingPaths();
}
