import "server-only";

import { createClient } from "@/lib/supabase/server";
import { APP_TIMEZONE } from "@/lib/calendar/events";

export type ActionNeededKind =
  | "session"
  | "checkin"
  | "overdue"
  | "invite";

export type ActionNeededItem = {
  id: string;
  kind: ActionNeededKind;
  title: string;
  href: string;
  detail: string;
  /** Optional external target (ex.: Meet). */
  external?: boolean;
};

function formatSessionWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-PT", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function loadActionNeeded(): Promise<ActionNeededItem[]> {
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const soon = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const [{ data: nodes }, { data: checkIns }, { data: sessions }, { data: invites }] =
    await Promise.all([
      supabase
        .from("nodes")
        .select("id, title, due_date, path_id, path:paths(id, title, status)")
        .eq("status", "active")
        .not("due_date", "is", null)
        .lt("due_date", today)
        .limit(20),
      supabase
        .from("check_ins")
        .select(
          "id, created_at, student:profiles!check_ins_student_id_fkey(full_name)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(20),
      supabase
        .from("cal_bookings")
        .select("id, title, start_time, attendee_name, student_id, meet_url")
        .in("status", ["accepted", "pending", "rescheduled"])
        .gte("start_time", new Date().toISOString())
        .lte("start_time", soon)
        .order("start_time", { ascending: true })
        .limit(20),
      supabase
        .from("one_to_one_invites")
        .select("id, email, full_name, status")
        .in("status", ["pending", "sent"])
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

  const overdue: ActionNeededItem[] = [];
  for (const node of nodes ?? []) {
    const path = Array.isArray(node.path) ? node.path[0] : node.path;
    if (!path || path.status !== "active" || !node.path_id) continue;
    overdue.push({
      id: `due:${node.id}`,
      kind: "overdue",
      title: node.title,
      href: `/studio/journeys/${node.path_id}/levels/${node.id}`,
      detail: `Prazo ${node.due_date} · ${path.title}`,
    });
  }

  const pending: ActionNeededItem[] = (checkIns ?? []).map((row) => {
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    return {
      id: `checkin:${row.id}`,
      kind: "checkin" as const,
      title: student?.full_name?.trim() || "Check-in por rever",
      href: `/studio/checkins/${row.id}`,
      detail: "À espera de feedback",
    };
  });

  const upcoming: ActionNeededItem[] = (sessions ?? []).map((row) => {
    const who = row.attendee_name?.trim();
    const title = who
      ? `Sessão com ${who}`
      : row.title?.trim() || "Sessão 1:1";
    const meet = row.meet_url?.trim();
    return {
      id: `session:${row.id}`,
      kind: "session" as const,
      title,
      href:
        meet ||
        (row.student_id
          ? `/studio/students/${row.student_id}`
          : "/studio/calendar"),
      detail: `Nas próximas 48h · ${formatSessionWhen(row.start_time)}`,
      external: Boolean(meet),
    };
  });

  const unpaid: ActionNeededItem[] = (invites ?? []).map((row) => ({
    id: `invite:${row.id}`,
    kind: "invite" as const,
    title: row.full_name?.trim() || row.email,
    href: "/studio/finance/one-to-one",
    detail: "Convite 1:1 por pagar",
  }));

  return [...upcoming, ...pending, ...overdue, ...unpaid];
}
