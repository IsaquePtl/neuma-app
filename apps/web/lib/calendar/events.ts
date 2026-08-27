import "server-only";

import { createClient } from "@/lib/supabase/server";

/** App calendar day / display timezone */
export const APP_TIMEZONE = "Europe/Lisbon";

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
  /** YYYY-MM-DD (calendar day in APP_TIMEZONE) */
  date: string;
  endDate?: string | null;
  kind: CalendarEventKind;
  title: string;
  studentName?: string | null;
  studentId?: string | null;
  href?: string | null;
  meetUrl?: string | null;
  meta?: string | null;
  /** Raw mentor_calendar_events.id when editable */
  editableEventId?: string | null;
  startsAtIso?: string | null;
  notes?: string | null;
  pathId?: string | null;
  nodeId?: string | null;
  nodeTitle?: string | null;
};

function toDateKey(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function toTimeLabel(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-PT", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
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
      .select(
        "id, title, kind, starts_at, notes, student_id, path_id, node_id, student:profiles!mentor_calendar_events_student_id_fkey(full_name, email)",
      )
      .gte("starts_at", fromIso)
      .lte("starts_at", toIso)
      .order("starts_at", { ascending: true }),
  ]);

  const events: CalendarEvent[] = [];

  for (const b of bookings ?? []) {
    const date = toDateKey(b.start_time);
    if (!date) continue;
    const when = toTimeLabel(b.start_time);
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
      startsAtIso: b.start_time,
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
    const when = toTimeLabel(m.starts_at);
    const kindLabel =
      m.kind === "reminder"
        ? "Lembrete"
        : m.kind === "meeting"
          ? "Reunião"
          : m.kind === "misc"
            ? "Diversos"
            : "Evento";
    const student = Array.isArray(m.student) ? m.student[0] : m.student;
    events.push({
      id: `manual-${m.id}`,
      date,
      kind: m.kind,
      title: m.title,
      studentName: student?.full_name ?? student?.email ?? null,
      studentId: m.student_id,
      meta: `${kindLabel} · ${when}`,
      href: m.student_id ? `/studio/students/${m.student_id}` : null,
      editableEventId: m.id,
      startsAtIso: m.starts_at,
      notes: m.notes,
      pathId: m.path_id,
      nodeId: m.node_id,
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const aIso = a.startsAtIso ?? "";
    const bIso = b.startsAtIso ?? "";
    if (aIso && bIso && aIso !== bIso) return aIso.localeCompare(bIso);
    return (a.meta ?? "").localeCompare(b.meta ?? "");
  });

  return events;
}

/** Events for the current calendar day in APP_TIMEZONE (Europe/Lisbon). */
export async function loadTodayEvents(): Promise<CalendarEvent[]> {
  const todayKey = toDateKey(new Date());
  if (!todayKey) return [];
  const year = Number(todayKey.slice(0, 4));
  const monthIndex = Number(todayKey.slice(5, 7)) - 1;
  const events = await loadCalendarEvents(year, monthIndex);
  return events.filter((e) => e.date === todayKey);
}

export type UpcomingSession = {
  id: string;
  start_time: string;
  title: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  meet_url: string | null;
  student_id: string | null;
  levelTitle: string | null;
  levelTheme: string | null;
};

export async function loadUpcomingSessions(limit = 7): Promise<UpcomingSession[]> {
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

  const rows = data ?? [];
  const studentIds = [
    ...new Set(rows.map((r) => r.student_id).filter(Boolean)),
  ] as string[];

  const levelByStudent = new Map<
    string,
    { title: string; theme: string | null }
  >();

  if (studentIds.length) {
    const { data: paths } = await supabase
      .from("paths")
      .select(
        "id, student_id, nodes(id, title, status, order_index, kind)",
      )
      .in("student_id", studentIds)
      .eq("status", "active");

    for (const p of paths ?? []) {
      if (!p.student_id) continue;
      const nodes = Array.isArray(p.nodes) ? p.nodes : [];
      const sorted = [...nodes].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
      );
      const active =
        sorted.find((n) => n.status === "active") ?? sorted[0] ?? null;
      if (active) {
        levelByStudent.set(p.student_id, {
          title: active.title,
          theme: active.kind ?? null,
        });
      }
    }
  }

  return rows.map((b) => {
    const level = b.student_id ? levelByStudent.get(b.student_id) : null;
    return {
      ...b,
      levelTitle: level?.title ?? null,
      levelTheme: level?.theme ?? null,
    };
  });
}
