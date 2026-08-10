import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CalendarEventKind =
  | "session"
  | "due"
  | "path_start"
  | "path_end"
  | "reminder"
  | "meeting"
  | "event"
  | "misc";

export type CalendarEvent = {
  id: string;
  /** YYYY-MM-DD (local calendar day) */
  date: string;
  endDate?: string | null;
  kind: CalendarEventKind;
  title: string;
  studentName?: string | null;
  studentId?: string | null;
  href?: string | null;
  meetUrl?: string | null;
  meta?: string | null;
};

function toDateKey(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthBounds(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  // Buffer ±7 days for week spill
  const from = new Date(start);
  from.setDate(from.getDate() - 7);
  const to = new Date(end);
  to.setDate(to.getDate() + 7);
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    fromDate: toDateKey(from),
    toDate: toDateKey(to),
  };
}

export async function loadCalendarEvents(year: number, monthIndex: number) {
  const supabase = await createClient();
  const { fromIso, toIso, fromDate, toDate } = monthBounds(year, monthIndex);

  const [
    { data: bookings },
    { data: nodes },
    { data: paths },
    { data: manual },
  ] = await Promise.all([
    supabase
      .from("cal_bookings")
      .select(
        "id, start_time, end_time, title, attendee_name, attendee_email, meet_url, status, student_id",
      )
      .in("status", ["accepted", "pending", "rescheduled"])
      .gte("start_time", fromIso)
      .lte("start_time", toIso)
      .order("start_time", { ascending: true }),
    supabase
      .from("nodes")
      .select(
        "id, title, due_date, status, kind, path:paths(id, title, student_id, student:profiles!paths_student_id_fkey(full_name, email))",
      )
      .not("due_date", "is", null)
      .gte("due_date", fromDate)
      .lte("due_date", toDate),
    supabase
      .from("paths")
      .select(
        "id, title, start_date, end_date, status, student_id, student:profiles!paths_student_id_fkey(full_name, email)",
      )
      .or(
        `and(start_date.gte.${fromDate},start_date.lte.${toDate}),and(end_date.gte.${fromDate},end_date.lte.${toDate})`,
      ),
    supabase
      .from("mentor_calendar_events")
      .select("id, title, kind, starts_at, notes")
      .gte("starts_at", fromIso)
      .lte("starts_at", toIso)
      .order("starts_at", { ascending: true }),
  ]);

  const events: CalendarEvent[] = [];

  for (const b of bookings ?? []) {
    const date = toDateKey(b.start_time);
    if (!date) continue;
    const when = new Date(b.start_time).toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    events.push({
      id: `session-${b.id}`,
      date,
      endDate: b.end_time ? toDateKey(b.end_time) : null,
      kind: "session",
      title: b.title ?? "Sessão 1:1",
      studentName: b.attendee_name ?? b.attendee_email,
      studentId: b.student_id,
      href: b.student_id ? `/studio/students/${b.student_id}` : null,
      meetUrl: b.meet_url,
      meta: when,
    });
  }

  for (const n of nodes ?? []) {
    if (!n.due_date) continue;
    const path = Array.isArray(n.path) ? n.path[0] : n.path;
    const student = path
      ? Array.isArray(path.student)
        ? path.student[0]
        : path.student
      : null;
    events.push({
      id: `due-${n.id}`,
      date: n.due_date,
      kind: "due",
      title: n.title,
      studentName: student?.full_name ?? student?.email ?? null,
      studentId: path?.student_id ?? null,
      href: path?.id ? `/studio/journeys/${path.id}` : null,
      meta: `Prazo · ${n.status}`,
    });
  }

  for (const p of paths ?? []) {
    const student = Array.isArray(p.student) ? p.student[0] : p.student;
    const name = student?.full_name ?? student?.email ?? null;
    if (p.start_date && p.start_date >= fromDate && p.start_date <= toDate) {
      events.push({
        id: `path-start-${p.id}`,
        date: p.start_date,
        kind: "path_start",
        title: p.title,
        studentName: name,
        studentId: p.student_id,
        href: `/studio/journeys/${p.id}`,
        meta: "Início do percurso",
      });
    }
    if (p.end_date && p.end_date >= fromDate && p.end_date <= toDate) {
      events.push({
        id: `path-end-${p.id}`,
        date: p.end_date,
        kind: "path_end",
        title: p.title,
        studentName: name,
        studentId: p.student_id,
        href: `/studio/journeys/${p.id}`,
        meta: "Fim previsto do percurso",
      });
    }
  }

  for (const m of manual ?? []) {
    const date = toDateKey(m.starts_at);
    if (!date) continue;
    const when = new Date(m.starts_at).toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const kindLabel =
      m.kind === "reminder"
        ? "Lembrete"
        : m.kind === "meeting"
          ? "Reunião"
          : m.kind === "misc"
            ? "Diversos"
            : "Evento";
    events.push({
      id: `manual-${m.id}`,
      date,
      kind: m.kind,
      title: m.title,
      meta: `${kindLabel} · ${when}`,
      href: null,
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.meta ?? "").localeCompare(b.meta ?? "");
  });

  return events;
}

export async function loadUpcomingSessions(limit = 7) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("cal_bookings")
    .select(
      "id, start_time, title, attendee_name, attendee_email, meet_url, student_id",
    )
    .in("status", ["accepted", "pending", "rescheduled"])
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(limit);
  return data ?? [];
}
