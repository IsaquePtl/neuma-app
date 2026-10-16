import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCalApiKey } from "@/lib/cal-config";
import type { CalBookingStatus, Json } from "@/lib/types/database.types";

const CAL_API = "https://api.cal.com/v2";
const CAL_API_VERSION = "2024-08-13";

type CalApiBooking = {
  id?: number;
  uid?: string;
  title?: string | null;
  status?: string | null;
  start?: string | null;
  end?: string | null;
  meetingUrl?: string | null;
  location?: string | null;
  eventType?: { slug?: string | null } | null;
  hosts?: Array<{ email?: string | null; name?: string | null }> | null;
  attendees?: Array<{
    email?: string | null;
    name?: string | null;
    timeZone?: string | null;
  }> | null;
};

function mapStatus(raw: string | null | undefined): CalBookingStatus {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("reject")) return "rejected";
  if (s.includes("pending") || s.includes("unconfirmed")) return "pending";
  if (s.includes("reschedule")) return "rescheduled";
  return "accepted";
}

async function fetchCalBookingsPage(
  apiKey: string,
  params: Record<string, string>,
): Promise<CalApiBooking[]> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${CAL_API}/bookings?${qs}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "cal-api-version": CAL_API_VERSION,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`cal_api_${res.status}:${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    data?: CalApiBooking[] | { bookings?: CalApiBooking[] };
  };
  const data = json.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.bookings)) return data.bookings;
  return [];
}

async function fetchRecentCalBookings(apiKey: string): Promise<CalApiBooking[]> {
  const afterStart = new Date();
  afterStart.setDate(afterStart.getDate() - 45);
  const beforeEnd = new Date();
  beforeEnd.setDate(beforeEnd.getDate() + 120);

  const ranges = {
    afterStart: afterStart.toISOString(),
    beforeEnd: beforeEnd.toISOString(),
    take: "100",
  };

  const [upcoming, past, cancelled] = await Promise.all([
    fetchCalBookingsPage(apiKey, { status: "upcoming", ...ranges }),
    fetchCalBookingsPage(apiKey, { status: "past", ...ranges }),
    fetchCalBookingsPage(apiKey, { status: "cancelled", ...ranges }),
  ]);

  const byUid = new Map<string, CalApiBooking>();
  for (const row of [...upcoming, ...past, ...cancelled]) {
    const uid = row.uid?.trim();
    if (!uid) continue;
    byUid.set(uid, row);
  }
  return [...byUid.values()];
}

async function resolveStudentIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string | null,
): Promise<string | null> {
  if (!email) return null;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .ilike("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Puxa marcações da API Cal.com para `cal_bookings`.
 * Soft-fail se a key faltar ou a API falhar (o calendário continua a ler a BD).
 */
export async function syncCalBookingsFromApi(): Promise<{
  ok: boolean;
  upserted: number;
  error?: string;
}> {
  const apiKey = getCalApiKey();
  if (!apiKey) {
    return { ok: false, upserted: 0, error: "missing_api_key" };
  }

  let bookings: CalApiBooking[];
  try {
    bookings = await fetchRecentCalBookings(apiKey);
  } catch (error) {
    console.error("[cal:api-sync] fetch", error);
    return {
      ok: false,
      upserted: 0,
      error: error instanceof Error ? error.message : "fetch_failed",
    };
  }

  if (bookings.length === 0) {
    return { ok: true, upserted: 0 };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  let upserted = 0;

  for (const b of bookings) {
    const uid = b.uid?.trim();
    const start = b.start?.trim();
    const end = b.end?.trim();
    if (!uid || !start || !end) continue;

    const attendee = b.attendees?.[0] ?? null;
    const host = b.hosts?.[0] ?? null;
    const attendeeEmail = attendee?.email?.trim() || null;
    const attendeeName = attendee?.name?.trim() || null;
    const studentId = await resolveStudentIdByEmail(admin, attendeeEmail);
    const meetUrl =
      b.meetingUrl?.trim() ||
      (typeof b.location === "string" && b.location.startsWith("http")
        ? b.location.trim()
        : null);

    const { error } = await admin.from("cal_bookings").upsert(
      {
        cal_booking_uid: uid,
        cal_booking_id: typeof b.id === "number" ? b.id : null,
        trigger_event: "API_SYNC",
        status: mapStatus(b.status),
        title: b.title?.trim() || "Sessão 1:1",
        event_type_slug: b.eventType?.slug?.trim() || null,
        start_time: start,
        end_time: end,
        timezone: attendee?.timeZone?.trim() || null,
        meet_url: meetUrl,
        organizer_email: host?.email?.trim() || null,
        organizer_name: host?.name?.trim() || null,
        attendee_email: attendeeEmail,
        attendee_name: attendeeName,
        student_id: studentId,
        payload: {
          source: "cal_api",
          synced_at: now,
        } as Json,
        updated_at: now,
      },
      { onConflict: "cal_booking_uid" },
    );

    if (error) {
      console.error("[cal:api-sync] upsert", uid, error.message);
      continue;
    }
    upserted += 1;
  }

  return { ok: true, upserted };
}

export type RescheduledCalBooking = {
  uid: string;
  id: number | null;
  title: string | null;
  status: CalBookingStatus;
  start: string;
  end: string;
  meetUrl: string | null;
};

function publicCalError(status: number, body: string) {
  let message = "";
  try {
    const json = JSON.parse(body) as {
      message?: unknown;
      error?: { message?: unknown } | string;
    };
    const raw =
      typeof json.error === "string"
        ? json.error
        : json.error && typeof json.error.message === "string"
          ? json.error.message
          : typeof json.message === "string"
            ? json.message
            : "";
    message = raw.replace(/cal_[A-Za-z0-9_]+/g, "…").trim().slice(0, 180);
  } catch {
    message = "";
  }
  if (message) return `O Cal.com recusou: ${message}`;
  if (status === 404) return "O Cal.com não encontrou esta marcação.";
  if (status === 401 || status === 403) return "O Cal.com recusou o acesso.";
  return "O Cal.com recusou esta hora.";
}

function unwrapBooking(json: unknown): CalApiBooking | null {
  if (!json || typeof json !== "object") return null;
  const root = json as { data?: unknown };
  const data = root.data ?? root;
  if (Array.isArray(data)) {
    return (data[0] as CalApiBooking | undefined) ?? null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as CalApiBooking & {
    booking?: CalApiBooking;
    startTime?: string | null;
    endTime?: string | null;
  };
  if (record.booking?.uid || record.booking?.start) return record.booking;
  if (record.uid || record.start || record.startTime) {
    return {
      ...record,
      start: record.start ?? record.startTime ?? null,
      end: record.end ?? record.endTime ?? null,
    };
  }
  return null;
}

/**
 * POST /v2/bookings/{uid}/reschedule (cal-api-version 2024-08-13).
 * Does not write the database. A non-ok result means Cal.com did not confirm.
 */
export async function rescheduleCalBookingRequest(input: {
  bookingUid: string;
  startIso: string;
  rescheduledBy?: string | null;
  previousEndIso?: string | null;
  previousStartIso?: string | null;
}): Promise<
  { ok: true; booking: RescheduledCalBooking } | { ok: false; error: string }
> {
  const apiKey = getCalApiKey();
  if (!apiKey) return { ok: false, error: "O Cal.com não está configurado." };

  const uid = input.bookingUid.trim();
  const startIso = input.startIso.trim();
  if (!uid || !startIso) {
    return { ok: false, error: "Faltam dados da marcação." };
  }

  const body: {
    start: string;
    reschedulingReason: string;
    rescheduledBy?: string;
  } = {
    start: startIso,
    reschedulingReason: "Reagendado no calendário do estúdio",
  };
  const rescheduledBy = input.rescheduledBy?.trim();
  if (rescheduledBy) body.rescheduledBy = rescheduledBy;

  let res: Response;
  try {
    res = await fetch(
      `${CAL_API}/bookings/${encodeURIComponent(uid)}/reschedule`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "cal-api-version": CAL_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
  } catch {
    return { ok: false, error: "Não foi possível contactar o Cal.com." };
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, error: publicCalError(res.status, text) };

  let booking: CalApiBooking | null = null;
  try {
    booking = unwrapBooking(JSON.parse(text) as unknown);
  } catch {
    booking = null;
  }
  const nextUid = booking?.uid?.trim();
  const nextStart = booking?.start?.trim();
  if (!booking || !nextUid || !nextStart) {
    return {
      ok: false,
      error:
        "O Cal.com respondeu sem a nova marcação. Recarrega o calendário antes de tentar outra vez.",
    };
  }

  let nextEnd = booking.end?.trim() || "";
  if (!nextEnd && input.previousStartIso && input.previousEndIso) {
    const duration =
      new Date(input.previousEndIso).getTime() -
      new Date(input.previousStartIso).getTime();
    if (Number.isFinite(duration) && duration > 0) {
      nextEnd = new Date(new Date(nextStart).getTime() + duration).toISOString();
    }
  }
  if (!nextEnd) {
    return {
      ok: false,
      error:
        "O Cal.com não devolveu a hora de fim. Recarrega o calendário antes de tentar outra vez.",
    };
  }

  const meetUrl =
    booking.meetingUrl?.trim() ||
    (typeof booking.location === "string" && booking.location.startsWith("http")
      ? booking.location.trim()
      : null);

  return {
    ok: true,
    booking: {
      uid: nextUid,
      id: typeof booking.id === "number" ? booking.id : null,
      title: booking.title?.trim() || null,
      status: mapStatus(booking.status),
      start: nextStart,
      end: nextEnd,
      meetUrl,
    },
  };
}
