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
