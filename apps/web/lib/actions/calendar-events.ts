"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { MentorCalendarEventKind } from "@/lib/types/database.types";

const KINDS = new Set<MentorCalendarEventKind>([
  "reminder",
  "meeting",
  "event",
  "misc",
]);

export async function createMentorCalendarEvent(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim() as MentorCalendarEventKind;
  const startsAtLocal = String(formData.get("starts_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const studentId = String(formData.get("student_id") ?? "").trim() || null;
  const pathId = String(formData.get("path_id") ?? "").trim() || null;
  const nodeId = String(formData.get("node_id") ?? "").trim() || null;
  const endsAtLocal = String(formData.get("ends_at") ?? "").trim();

  if (!title) throw new Error("Indica o nome do evento");
  if (!KINDS.has(kind)) throw new Error("Tipo de evento inválido");
  if (!startsAtLocal) throw new Error("Indica dia e hora");

  const startsAt = new Date(startsAtLocal);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Data/hora inválida");
  const endsAt = endsAtLocal ? new Date(endsAtLocal) : null;
  if (endsAtLocal && endsAt && Number.isNaN(endsAt.getTime())) {
    throw new Error("Fim inválido");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase.from("mentor_calendar_events").insert({
    mentor_id: user.id,
    title,
    kind,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt?.toISOString() ?? null,
    notes,
    student_id: studentId,
    path_id: pathId,
    node_id: nodeId,
    source: "manual",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/studio/calendar");
}

export async function updateMentorCalendarEvent(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim() as MentorCalendarEventKind;
  const startsAtLocal = String(formData.get("starts_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const studentId = String(formData.get("student_id") ?? "").trim() || null;

  if (!id) throw new Error("Evento em falta");
  if (!title) throw new Error("Indica o nome do evento");
  if (!KINDS.has(kind)) throw new Error("Tipo de evento inválido");

  const startsAt = new Date(startsAtLocal);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Data/hora inválida");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("mentor_calendar_events")
    .update({
      title,
      kind,
      starts_at: startsAt.toISOString(),
      notes,
      student_id: studentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("mentor_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/studio/calendar");
}

export async function deleteMentorCalendarEvent(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Evento em falta");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("mentor_calendar_events")
    .delete()
    .eq("id", id)
    .eq("mentor_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/studio/calendar");
}
