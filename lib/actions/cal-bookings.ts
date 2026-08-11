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
};

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
  let status: CalBookingStatus = payload.isReschedule
    ? "rescheduled"
    : "accepted";
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

  revalidatePath("/path", "layout");
  revalidatePath("/home");
  revalidatePath("/session");
  revalidatePath("/studio");
  revalidatePath("/studio/calendar");
}
