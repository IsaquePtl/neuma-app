import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type {
  CheckInKind,
  CheckInStatus,
  NodeKind,
  NodeStatus,
  PathStatus,
} from "@/lib/types/database.types";

export type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  internal_notes: string | null;
  created_at: string;
};

export type StudentPath = {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_label: string | null;
  start_date: string | null;
  end_date: string | null;
  status: PathStatus;
};

export type StudentNode = {
  id: string;
  title: string;
  description: string | null;
  week_number: number | null;
  kind: NodeKind;
  status: NodeStatus;
  due_date: string | null;
  resource_url: string | null;
  content_body: string | null;
  order_index: number;
};

export type StudentCheckIn = {
  id: string;
  status: CheckInStatus;
  kind: CheckInKind;
  created_at: string;
  notes: string | null;
  video_url: string | null;
  ai_summary: string | null;
  node_title: string | null;
  feedback_approved: boolean | null;
  feedback_notes: string | null;
  feedback_next_steps: string | null;
  has_draft: boolean;
};

export type StudentFormBlock = {
  id: string;
  form_id: string;
  form_title: string;
  form_description: string | null;
  is_onboarding: boolean;
  created_at: string;
  pairs: { label: string; value: string }[];
};

export type StudentCounts = {
  pendingCheckIns: number;
  revisionCheckIns: number;
  totalCheckIns: number;
  formResponses: number;
  completedNodes: number;
  totalNodes: number;
  overdueNodes: number;
};

/** Prefer active path; fallback to most recently created. */
export async function loadStudentPath(studentId: string) {
  const supabase = await createClient();

  const { data: active } = await supabase
    .from("paths")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active) return active;

  const { data: latest } = await supabase
    .from("paths")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latest;
}

export async function loadStudentOrThrow(id: string): Promise<StudentProfile> {
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, avatar_url, onboarding_completed, internal_notes, created_at, role",
    )
    .eq("id", id)
    .single();

  if (!student || student.role !== "student") notFound();

  return {
    id: student.id,
    full_name: student.full_name,
    email: student.email,
    avatar_url: student.avatar_url,
    onboarding_completed: student.onboarding_completed,
    internal_notes: student.internal_notes,
    created_at: student.created_at,
  };
}

export async function loadStudentCounts(
  studentId: string,
  pathId: string | null,
): Promise<StudentCounts> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: pendingCheckIns },
    { count: revisionCheckIns },
    { count: totalCheckIns },
    { count: formResponses },
    nodesRes,
  ] = await Promise.all([
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "pending"),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "needs_revision"),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId),
    supabase
      .from("form_responses")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId),
    pathId
      ? supabase
          .from("nodes")
          .select("id, status, due_date")
          .eq("path_id", pathId)
      : Promise.resolve({ data: [] as { id: string; status: string; due_date: string | null }[] }),
  ]);

  const nodes = nodesRes.data ?? [];
  const completedNodes = nodes.filter((n) => n.status === "completed").length;
  const overdueNodes = nodes.filter(
    (n) =>
      n.status !== "completed" &&
      n.due_date != null &&
      n.due_date < today,
  ).length;

  return {
    pendingCheckIns: pendingCheckIns ?? 0,
    revisionCheckIns: revisionCheckIns ?? 0,
    totalCheckIns: totalCheckIns ?? 0,
    formResponses: formResponses ?? 0,
    completedNodes,
    totalNodes: nodes.length,
    overdueNodes,
  };
}

export function mapPath(path: NonNullable<Awaited<ReturnType<typeof loadStudentPath>>>): StudentPath {
  return {
    id: path.id,
    title: path.title,
    description: path.description,
    goal: path.goal,
    duration_label: path.duration_label,
    start_date: path.start_date,
    end_date: path.end_date,
    status: path.status,
  };
}

export function mapNode(n: {
  id: string;
  title: string;
  description: string | null;
  week_number: number | null;
  kind: NodeKind;
  status: NodeStatus;
  due_date: string | null;
  resource_url: string | null;
  content_body: string | null;
  order_index: number;
}): StudentNode {
  return {
    id: n.id,
    title: n.title,
    description: n.description,
    week_number: n.week_number,
    kind: n.kind,
    status: n.status,
    due_date: n.due_date,
    resource_url: n.resource_url,
    content_body: n.content_body ?? null,
    order_index: n.order_index,
  };
}

/** Path activo (ou último) + nodes ordenados — para o próprio aluno. */
export async function loadMyPathWithNodes(studentId: string): Promise<{
  path: StudentPath | null;
  nodes: StudentNode[];
}> {
  const pathRow = await loadStudentPath(studentId);
  if (!pathRow) return { path: null, nodes: [] };

  const supabase = await createClient();
  const { data: nodes } = await supabase
    .from("nodes")
    .select(
      "id, title, description, week_number, kind, status, due_date, resource_url, content_body, order_index",
    )
    .eq("path_id", pathRow.id)
    .order("order_index", { ascending: true });

  return {
    path: mapPath(pathRow),
    nodes: (nodes ?? []).map(mapNode),
  };
}

export async function loadMentorCalUsername() {
  const supabase = await createClient();
  const { data: mentor } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url, cal_username")
    .eq("role", "mentor")
    .limit(1)
    .maybeSingle();
  return mentor;
}

export type StudentUpcomingBooking = {
  id: string;
  start_time: string;
  end_time: string;
  title: string | null;
  meet_url: string | null;
  status: string;
};

/** Próxima marcação Cal.com do aluno (aceite / pendente / reagendada). */
export async function loadMyUpcomingBooking(
  studentId: string,
): Promise<StudentUpcomingBooking | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("cal_bookings")
    .select("id, start_time, end_time, title, meet_url, status")
    .eq("student_id", studentId)
    .in("status", ["accepted", "pending", "rescheduled"])
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data) return data;

  // Fallback: match por email (webhook pode não ter ligado student_id)
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", studentId)
    .maybeSingle();

  if (!profile?.email) return null;

  const { data: byEmail } = await supabase
    .from("cal_bookings")
    .select("id, start_time, end_time, title, meet_url, status")
    .ilike("attendee_email", profile.email)
    .in("status", ["accepted", "pending", "rescheduled"])
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  return byEmail ?? null;
}
