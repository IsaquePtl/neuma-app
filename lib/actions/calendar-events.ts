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

  if (!title) throw new Error("Indica o nome do evento");
  if (!KINDS.has(kind)) throw new Error("Tipo de evento inválido");
  if (!startsAtLocal) throw new Error("Indica dia e hora");

  const startsAt = new Date(startsAtLocal);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Data/hora inválida");

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
    notes,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/studio/calendar");
}
