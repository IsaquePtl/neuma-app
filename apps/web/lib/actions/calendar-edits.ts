"use server";

import { revalidatePath } from "next/cache";

import { planAnchoredDueDate } from "@/lib/calendar/due-plan";
import { lisbonLocalToUtcIso } from "@/lib/calendar/lisbon";
import { rescheduleCalBookingRequest } from "@/lib/cal-api-sync";
import { resegmentPath } from "@/lib/nodes/schedule-server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database.types";

type EditResult = { ok: true } | { ok: false; error: string };

async function mentorClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null as null, email: null, error: "Não autenticado." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") {
    return { supabase, user: null as null, email: null, error: "Sem permissão." };
  }
  return { supabase, user, email: profile.email ?? user.email ?? null, error: null };
}

function revalidateSchedule(pathId: string | null, studentId: string | null) {
  revalidatePath("/studio/calendar");
  revalidatePath("/studio");
  revalidatePath("/home");
  revalidatePath("/path", "layout");
  revalidatePath("/session");
  if (pathId) {
    revalidatePath(`/studio/journeys/${pathId}`);
    revalidatePath(`/studio/journeys/${pathId}/edit`);
    revalidatePath("/studio/journeys");
  }
  if (studentId) revalidatePath(`/studio/students/${studentId}`);
}

export async function saveCalendarNodeDueDate(input: {
  nodeId: string;
  pathId: string;
  dueDate: string;
}): Promise<EditResult> {
  const { supabase, error: authError } = await mentorClient();
  if (authError) return { ok: false, error: authError };

  const nodeId = input.nodeId.trim();
  const pathId = input.pathId.trim();
  const picked = input.dueDate.trim();
  if (!nodeId || !pathId || !/^\d{4}-\d{2}-\d{2}$/.test(picked)) {
    return { ok: false, error: "Data inválida." };
  }

  const { data: node, error: nodeError } = await supabase
    .from("nodes")
    .select(
      "id, due_date, week_number, duration_weeks, extended_weeks, path:paths!inner(id, start_date, student_id)",
    )
    .eq("id", nodeId)
    .eq("path_id", pathId)
    .maybeSingle();
  if (nodeError || !node) {
    return { ok: false, error: "Nível não encontrado." };
  }

  const path = Array.isArray(node.path) ? node.path[0] : node.path;
  const studentId = path?.student_id ?? null;
  const anchored = Boolean(
    path?.start_date && node.week_number != null && node.week_number >= 1,
  );

  if (!anchored || !path?.start_date || node.week_number == null) {
    if (node.due_date === picked) return { ok: true };
    const { data: updated, error } = await supabase
      .from("nodes")
      .update({ due_date: picked })
      .eq("id", nodeId)
      .eq("path_id", pathId)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      return { ok: false, error: "Não foi possível atualizar o prazo." };
    }
    revalidateSchedule(pathId, studentId);
    return { ok: true };
  }

  const plan = planAnchoredDueDate({
    startDate: path.start_date,
    weekNumber: node.week_number,
    durationWeeks: node.duration_weeks ?? 1,
    extendedWeeks: node.extended_weeks ?? 0,
    pickedDate: picked,
  });
  if (!plan.ok) return plan;

  const sameWeeks =
    plan.durationWeeks === (node.duration_weeks ?? 1) &&
    plan.extendedWeeks === (node.extended_weeks ?? 0);
  if (sameWeeks && node.due_date === plan.dueDate) return { ok: true };

  const { data: updated, error } = await supabase
    .from("nodes")
    .update({
      duration_weeks: plan.durationWeeks,
      extended_weeks: plan.extendedWeeks,
    })
    .eq("id", nodeId)
    .eq("path_id", pathId)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return { ok: false, error: "Não foi possível atualizar o prazo." };
  }

  try {
    await resegmentPath(supabase, pathId);
  } catch (err) {
    revalidateSchedule(pathId, studentId);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "O prazo mudou, mas o resto do percurso não acompanhou.",
    };
  }

  revalidateSchedule(pathId, studentId);
  return { ok: true };
}

export async function saveCalendarSessionTime(input: {
  bookingUid: string;
  startsAtLocal: string;
}): Promise<EditResult> {
  const { supabase, email, error: authError } = await mentorClient();
  if (authError) return { ok: false, error: authError };

  const bookingUid = input.bookingUid.trim();
  const startIso = lisbonLocalToUtcIso(input.startsAtLocal);
  if (!bookingUid || !startIso) {
    return { ok: false, error: "Data/hora inválida." };
  }

  const { data: existing, error: loadError } = await supabase
    .from("cal_bookings")
    .select(
      "id, cal_booking_uid, status, title, event_type_slug, start_time, end_time, timezone, meet_url, organizer_email, organizer_name, attendee_email, attendee_name, student_id, notes",
    )
    .eq("cal_booking_uid", bookingUid)
    .maybeSingle();
  if (loadError || !existing) {
    return { ok: false, error: "Marcação não encontrada." };
  }
  if (existing.status === "cancelled" || existing.status === "rejected") {
    return { ok: false, error: "Esta marcação já não está activa." };
  }

  const current = new Date(existing.start_time).getTime();
  const next = new Date(startIso).getTime();
  if (Number.isFinite(current) && Math.abs(current - next) < 60_000) {
    return { ok: true };
  }

  const remote = await rescheduleCalBookingRequest({
    bookingUid,
    startIso,
    rescheduledBy: existing.organizer_email || email,
    previousStartIso: existing.start_time,
    previousEndIso: existing.end_time,
  });
  if (!remote.ok) return remote;

  const now = new Date().toISOString();
  const booking = remote.booking;
  const { error: upsertError } = await supabase.from("cal_bookings").upsert(
    {
      cal_booking_uid: booking.uid,
      cal_booking_id: booking.id,
      trigger_event: "BOOKING_RESCHEDULED",
      status: booking.status,
      title: booking.title || existing.title,
      event_type_slug: existing.event_type_slug,
      start_time: booking.start,
      end_time: booking.end,
      timezone: existing.timezone,
      meet_url: booking.meetUrl ?? existing.meet_url,
      organizer_email: existing.organizer_email,
      organizer_name: existing.organizer_name,
      attendee_email: existing.attendee_email,
      attendee_name: existing.attendee_name,
      student_id: existing.student_id,
      notes: existing.notes,
      payload: {
        source: "cal_api_reschedule",
        previous_uid: existing.cal_booking_uid,
        synced_at: now,
      } as Json,
      updated_at: now,
    },
    { onConflict: "cal_booking_uid" },
  );
  if (upsertError) {
    return {
      ok: false,
      error:
        "A hora mudou no Cal.com, mas não ficou gravada aqui. Recarrega o calendário.",
    };
  }

  if (booking.uid !== existing.cal_booking_uid) {
    const { error: cancelError } = await supabase
      .from("cal_bookings")
      .update({
        status: "cancelled",
        trigger_event: "BOOKING_RESCHEDULED",
        updated_at: now,
      })
      .eq("cal_booking_uid", existing.cal_booking_uid);
    if (cancelError) {
      return {
        ok: false,
        error:
          "A nova hora ficou gravada, mas a marcação anterior ainda aparece. Recarrega o calendário.",
      };
    }
  }

  revalidateSchedule(null, existing.student_id);
  return { ok: true };
}
