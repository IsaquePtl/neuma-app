import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ActionNeededItem = {
  id: string;
  title: string;
  href: string;
  detail: string;
};

export async function loadActionNeeded(): Promise<ActionNeededItem[]> {
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
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
      .select("id, created_at, student:profiles!check_ins_student_id_fkey(full_name)")
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
      title: node.title,
      href: `/studio/journeys/${node.path_id}/levels/${node.id}`,
      detail: `Prazo ${node.due_date} · ${path.title}`,
    });
  }

  const pending: ActionNeededItem[] = (checkIns ?? []).map((row) => {
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    return {
      id: `checkin:${row.id}`,
      title: student?.full_name?.trim() || "Check-in por rever",
      href: `/studio/checkins/${row.id}`,
      detail: "Check-in à espera de feedback",
    };
  });

  const upcoming: ActionNeededItem[] = (sessions ?? []).map((row) => ({
    id: `session:${row.id}`,
    title: row.title?.trim() || row.attendee_name?.trim() || "Sessão",
    href: row.meet_url || (row.student_id ? `/studio/students/${row.student_id}` : "/studio/calendar"),
    detail: `Sessão nas próximas 48h · ${row.start_time}`,
  }));

  const unpaid: ActionNeededItem[] = (invites ?? []).map((row) => ({
    id: `invite:${row.id}`,
    title: row.full_name?.trim() || row.email,
    href: "/studio/finance/one-to-one",
    detail: "Convite 1:1 por pagar",
  }));

  return [...overdue, ...pending, ...upcoming, ...unpaid];
}
