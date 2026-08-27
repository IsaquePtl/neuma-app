import "server-only";

import crypto from "node:crypto";

import type { Json } from "@/lib/types/database.types";

export type CalBookingStatus =
  | "accepted"
  | "cancelled"
  | "rescheduled"
  | "pending"
  | "rejected";

export type ParsedCalWebhook = {
  triggerEvent: string;
  createdAt: string | null;
  uid: string;
  /** UID do agendamento anterior (só em BOOKING_RESCHEDULED). */
  rescheduleUid: string | null;
  bookingId: number | null;
  status: CalBookingStatus;
  title: string | null;
  eventTypeSlug: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  meetUrl: string | null;
  organizerEmail: string | null;
  organizerName: string | null;
  attendeeEmail: string | null;
  attendeeName: string | null;
  notes: string | null;
  payload: Json;
};

function toJson(value: unknown): Json {
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function statusFromTrigger(
  trigger: string,
  payloadStatus: string | null,
): CalBookingStatus {
  if (trigger === "BOOKING_CANCELLED") return "cancelled";
  if (trigger === "BOOKING_RESCHEDULED") return "rescheduled";
  if (trigger === "BOOKING_REQUESTED") return "pending";
  if (trigger === "BOOKING_REJECTED") return "rejected";
  const s = (payloadStatus ?? "").toUpperCase();
  if (s === "CANCELLED") return "cancelled";
  if (s === "PENDING" || s === "PENDING_CONFIRMATION") return "pending";
  if (s === "REJECTED") return "rejected";
  return "accepted";
}

export function getCalWebhookSecret() {
  return (process.env.CAL_WEBHOOK_SECRET || "").trim();
}

/** HMAC-SHA256 hex do body; header X-Cal-Signature-256. */
export function verifyCalSignature({
  rawBody,
  signature,
  secret,
}: {
  rawBody: string;
  signature: string | null;
  secret: string;
}) {
  if (!secret) {
    // Dev sem secret: aceita (igual ao Tally). Em produção define CAL_WEBHOOK_SECRET.
    console.warn("[cal:webhook] CAL_WEBHOOK_SECRET em falta — a aceitar sem verificar");
    return true;
  }
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const received = signature.replace(/^sha256=/i, "").trim();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseCalWebhook(rawBody: string): ParsedCalWebhook {
  const root = asRecord(JSON.parse(rawBody));
  if (!root) throw new Error("invalid_json");

  const triggerEvent = asString(root.triggerEvent) ?? "UNKNOWN";
  const createdAt = asString(root.createdAt);

  // Maioria dos eventos: { triggerEvent, createdAt, payload }
  // MEETING_* por vezes flat — normalizamos.
  const payload =
    asRecord(root.payload) ??
    (asString(root.uid) || asString(root.startTime) ? root : null);

  if (!payload) throw new Error("missing_payload");

  const uid =
    asString(payload.uid) ??
    asString(payload.bookingUid) ??
    (asNumber(payload.bookingId) != null
      ? `booking-${asNumber(payload.bookingId)}`
      : null);

  if (!uid) throw new Error("missing_uid");

  const startTime = asString(payload.startTime);
  const endTime = asString(payload.endTime);
  // Cancelamentos por vezes vêm sem times — o route trata isso.
  if (
    (!startTime || !endTime) &&
    triggerEvent !== "BOOKING_CANCELLED"
  ) {
    throw new Error("missing_times");
  }

  const organizer = asRecord(payload.organizer);
  const attendees = Array.isArray(payload.attendees)
    ? payload.attendees
    : [];
  const firstAttendee = asRecord(attendees[0]);

  const responses = asRecord(payload.responses);
  const locationResponse = asRecord(responses?.location);
  const notesResponse = asRecord(responses?.notes);

  const meetUrl =
    asString(payload.meetingUrl) ??
    asString(payload.videoCallUrl) ??
    asString(asRecord(payload.metadata)?.videoCallUrl) ??
    asString(locationResponse?.value) ??
    null;

  const notes =
    asString(payload.additionalNotes) ??
    asString(notesResponse?.value) ??
    asString(payload.description) ??
    null;

  const rescheduleUid =
    asString(payload.rescheduleUid) ??
    asString(payload.fromReschedule) ??
    null;

  return {
    triggerEvent,
    createdAt,
    uid,
    rescheduleUid,
    bookingId: asNumber(payload.bookingId) ?? asNumber(payload.id),
    status: statusFromTrigger(triggerEvent, asString(payload.status)),
    title: asString(payload.title) ?? asString(payload.eventTitle),
    eventTypeSlug: asString(payload.type) ?? asString(payload.eventTypeSlug),
    startTime,
    endTime,
    timezone:
      asString(firstAttendee?.timeZone) ??
      asString(organizer?.timeZone) ??
      null,
    meetUrl,
    organizerEmail: asString(organizer?.email),
    organizerName: asString(organizer?.name),
    attendeeEmail: asString(firstAttendee?.email),
    attendeeName:
      asString(firstAttendee?.name) ??
      ([asString(firstAttendee?.firstName), asString(firstAttendee?.lastName)]
        .filter(Boolean)
        .join(" ") || null),
    notes,
    payload: toJson(root) ?? {},
  };
}
