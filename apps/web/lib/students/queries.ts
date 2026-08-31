import {
  checkInKindLabel,
  checkInLevelTitle,
  ORPHAN_CHECKIN_LABEL,
} from "@/lib/labels";
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
  can_book_sessions: boolean;
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

/** Statuses visible to students (draft paths are mentor-only until published). */
export const STUDENT_VISIBLE_PATH_STATUSES: PathStatus[] = [
  "active",
  "paused",
  "completed",
];

/** Prefer active path; fallback to most recently created. */
export async function loadStudentPath(
  studentId: string,
  opts?: { forStudentApp?: boolean },
) {
  const forStudent = opts?.forStudentApp ?? false;
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

  let latestQuery = supabase
    .from("paths")
    .select("*")
    .eq("student_id", studentId);

  if (forStudent) {
    latestQuery = latestQuery.in("status", STUDENT_VISIBLE_PATH_STATUSES);
  }

  const { data: latest } = await latestQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latest;
}

export async function loadStudentOrThrow(id: string): Promise<StudentProfile> {
  const supabase = await createClient();

  // Guard against garbage segments (e.g. "undefined") so mentors don't get a
  // confusing notFound from a bad link.
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  if (!looksLikeUuid) {
    console.warn("[students] invalid student id segment", id);
    notFound();
  }

  // Keep the critical select aligned with the students list (known-good columns).
  // `can_book_sessions` is optional (migration 0028) — never let it 404 the page.
  const { data: student, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, avatar_url, onboarding_completed, internal_notes, created_at, role",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[students] loadStudentOrThrow failed", {
      id,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    // Infra/schema failures must not look like a missing route.
    throw new Error(
      `Failed to load student ${id}: ${error.message || error.code || "unknown"}`,
    );
  }

  if (!student || student.role !== "student") notFound();

  let canBookSessions = true;
  const { data: bookingFlags, error: bookingErr } = await supabase
    .from("profiles")
    .select("can_book_sessions")
    .eq("id", id)
    .maybeSingle();
  if (bookingErr) {
    console.warn("[students] can_book_sessions unavailable", {
      id,
      message: bookingErr.message,
      code: bookingErr.code,
    });
  } else if (bookingFlags && typeof bookingFlags.can_book_sessions === "boolean") {
    canBookSessions = bookingFlags.can_book_sessions;
  }

  return {
    id: student.id,
    full_name: student.full_name,
    email: student.email,
    avatar_url: student.avatar_url,
    onboarding_completed: student.onboarding_completed,
    can_book_sessions: canBookSessions,
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
    { count: tallyLinked },
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
      .from("tally_submissions")
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
    formResponses: tallyLinked ?? 0,
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
  const pathRow = await loadStudentPath(studentId, { forStudentApp: true });
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

export type StudentMentor = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  instagram: string | null;
  cal_username: string | null;
  whatsapp: string | null;
};

/**
 * Mentor vinculado ao aluno (profiles.mentor_id), com fallback ao
 * created_by do percurso. Multi-mentor: cada aluno vê só o seu.
 */
export async function loadMyMentor(
  studentId?: string,
): Promise<StudentMentor | null> {
  const supabase = await createClient();
  let id = studentId;
  if (!id) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    id = user?.id;
  }
  if (!id) return null;

  const selectCols =
    "id, full_name, email, avatar_url, bio, instagram, cal_username, whatsapp";

  const { data: me } = await supabase
    .from("profiles")
    .select("mentor_id")
    .eq("id", id)
    .maybeSingle();

  if (me?.mentor_id) {
    const { data: mentor } = await supabase
      .from("profiles")
      .select(selectCols)
      .eq("id", me.mentor_id)
      .eq("role", "mentor")
      .maybeSingle();
    if (mentor) return mentor;
  }

  const path = await loadStudentPath(id, { forStudentApp: true });
  if (path?.created_by) {
    const { data: mentor } = await supabase
      .from("profiles")
      .select(selectCols)
      .eq("id", path.created_by)
      .eq("role", "mentor")
      .maybeSingle();
    if (mentor) return mentor;
  }

  return null;
}

/** @deprecated use loadMyMentor */
export async function loadMentorCalUsername() {
  return loadMyMentor();
}

export type MentorHistoryKind =
  | "booking"
  | "check_in"
  | "feedback"
  | "level_feedback"
  | "level_validated"
  | "level_start"
  | "journey_start"
  | "journey_end";

export type MentorHistoryEvent = {
  id: string;
  at: string;
  kind: MentorHistoryKind;
  /** Rótulo curto em PT (ex.: "Sessão", "Feedback"). */
  label: string;
  /** Detalhe opcional (título do nível, estado da marcação…). */
  detail: string | null;
};

const BOOKING_STATUS_PT: Record<string, string> = {
  accepted: "Confirmada",
  pending: "Pendente",
  rescheduled: "Reagendada",
  cancelled: "Cancelada",
  rejected: "Recusada",
};

/**
 * Interações partilhadas entre este aluno e este mentor (só dados reais).
 * Segurança: filtra sempre por studentId + mentorId; RLS reforça no servidor.
 */
export async function loadMentorSharedHistory(
  studentId: string,
  mentorId: string,
): Promise<MentorHistoryEvent[]> {
  const supabase = await createClient();
  const events: MentorHistoryEvent[] = [];

  const pathRow = await loadStudentPath(studentId, { forStudentApp: true });
  const pathId = pathRow?.id ?? null;
  const pathOwnedByMentor = pathRow?.created_by === mentorId;

  const [
    { data: bookingsById },
    { data: profile },
    nodesRes,
    feedbacksRes,
    checkInsRes,
  ] = await Promise.all([
    supabase
      .from("cal_bookings")
      .select("id, title, start_time, status")
      .eq("student_id", studentId)
      .order("start_time", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("email")
      .eq("id", studentId)
      .maybeSingle(),
    pathId
      ? supabase
          .from("nodes")
          .select("id, title, order_index")
          .eq("path_id", pathId)
          .order("order_index", { ascending: true })
      : Promise.resolve(
          { data: [] as { id: string; title: string; order_index: number }[] },
        ),
    supabase
      .from("feedbacks")
      .select(
        "id, approved, created_at, mentor_id, check_in:check_ins!inner(id, student_id, level_label, node_id, node:nodes(title, order_index))",
      )
      .eq("mentor_id", mentorId)
      .eq("check_in.student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("check_ins")
      .select("id, created_at, kind, level_label, node:nodes(title)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const seenBookingIds = new Set<string>();
  for (const b of bookingsById ?? []) {
    seenBookingIds.add(b.id);
    events.push({
      id: `booking:${b.id}`,
      at: b.start_time,
      kind: "booking",
      label: "Sessão",
      detail:
        [b.title?.trim() || null, BOOKING_STATUS_PT[b.status] ?? null]
          .filter(Boolean)
          .join(" · ") || null,
    });
  }

  // Fallback email (webhook pode não ter ligado student_id)
  const email = profile?.email?.trim();
  if (email) {
    const { data: byEmail } = await supabase
      .from("cal_bookings")
      .select("id, title, start_time, status, student_id")
      .ilike("attendee_email", `%${email}%`)
      .order("start_time", { ascending: false })
      .limit(50);
    for (const b of byEmail ?? []) {
      if (seenBookingIds.has(b.id)) continue;
      // Só se for deste aluno (student_id nulo ou igual)
      if (b.student_id && b.student_id !== studentId) continue;
      seenBookingIds.add(b.id);
      events.push({
        id: `booking:${b.id}`,
        at: b.start_time,
        kind: "booking",
        label: "Sessão",
        detail:
          [b.title?.trim() || null, BOOKING_STATUS_PT[b.status] ?? null]
            .filter(Boolean)
            .join(" · ") || null,
      });
    }
  }

  for (const row of checkInsRes.data ?? []) {
    const node = Array.isArray(row.node) ? row.node[0] : row.node;
    const levelTitle = checkInLevelTitle(node?.title, row.level_label);
    const detailParts = [
      levelTitle !== ORPHAN_CHECKIN_LABEL ? levelTitle : null,
      checkInKindLabel[row.kind as CheckInKind],
    ].filter(Boolean);

    events.push({
      id: `check_in:${row.id}`,
      at: row.created_at,
      kind: "check_in",
      label: "Check-in",
      detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    });
  }

  const nodes = nodesRes.data ?? [];
  const sortedNodes = [...nodes].sort((a, b) => a.order_index - b.order_index);
  const nodeIds = sortedNodes.map((n) => n.id);
  const nodeTitleById = new Map(sortedNodes.map((n) => [n.id, n.title]));
  const nodeById = new Map(sortedNodes.map((n) => [n.id, n]));
  const nodeByOrder = new Map(sortedNodes.map((n) => [n.order_index, n]));

  for (const fb of feedbacksRes.data ?? []) {
    const checkIn = Array.isArray(fb.check_in) ? fb.check_in[0] : fb.check_in;
    const node = checkIn
      ? Array.isArray(checkIn.node)
        ? checkIn.node[0]
        : checkIn.node
      : null;
    const levelTitle =
      node?.title?.trim() || checkIn?.level_label?.trim() || null;

    if (fb.approved) {
      events.push({
        id: `validated:${fb.id}`,
        at: fb.created_at,
        kind: "level_validated",
        label: "Nível validado",
        detail: levelTitle,
      });

      const currentNode =
        (checkIn?.node_id ? nodeById.get(checkIn.node_id) : null) ??
        (node?.order_index != null
          ? nodeByOrder.get(node.order_index)
          : undefined);
      const nextNode =
        currentNode != null
          ? nodeByOrder.get(currentNode.order_index + 1)
          : undefined;
      if (pathOwnedByMentor && nextNode) {
        events.push({
          id: `level_start:${nextNode.id}:via:${fb.id}`,
          at: fb.created_at,
          kind: "level_start",
          label: "Novo nível",
          detail: nextNode.title?.trim() || null,
        });
      }
    } else {
      events.push({
        id: `feedback:${fb.id}`,
        at: fb.created_at,
        kind: "feedback",
        label: "Revisão pedida",
        detail: levelTitle,
      });
    }
  }

  if (nodeIds.length > 0) {
    const { data: levelFbs } = await supabase
      .from("level_feedbacks")
      .select("id, created_at, node_id, mentor_id")
      .eq("mentor_id", mentorId)
      .in("node_id", nodeIds)
      .order("created_at", { ascending: false })
      .limit(50);

    for (const lf of levelFbs ?? []) {
      events.push({
        id: `level_feedback:${lf.id}`,
        at: lf.created_at,
        kind: "level_feedback",
        label: "Feedback do nível",
        detail: nodeTitleById.get(lf.node_id)?.trim() || null,
      });
    }
  }

  if (pathRow && pathOwnedByMentor) {
    const journeyStart = pathRow.start_date ?? pathRow.created_at;
    events.push({
      id: `path_start:${pathRow.id}`,
      at: journeyStart,
      kind: "journey_start",
      label: "Início do percurso",
      detail: pathRow.title?.trim() || null,
    });

    const firstNode = sortedNodes[0];
    if (firstNode) {
      events.push({
        id: `level_start:${firstNode.id}`,
        at: journeyStart,
        kind: "level_start",
        label: "Novo nível",
        detail: firstNode.title?.trim() || null,
      });
    }

    if (pathRow.status === "completed") {
      const lastValidation = events
        .filter((event) => event.kind === "level_validated")
        .map((event) => event.at)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      const journeyEnd = pathRow.end_date ?? lastValidation ?? null;
      if (journeyEnd) {
        events.push({
          id: `path_end:${pathRow.id}`,
          at: journeyEnd,
          kind: "journey_end",
          label: "Fim do percurso",
          detail: pathRow.title?.trim() || null,
        });
      }
    }
  }

  events.sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return tb - ta;
  });

  return events;
}

export type StudentUpcomingBooking = {
  id: string;
  cal_booking_uid: string;
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
    .select("id, cal_booking_uid, start_time, end_time, title, meet_url, status")
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

  // Alguns fluxos podem ter o email em `profiles` ainda não sincronizado
  // (ou webhook gravar com outro campo). Tentamos também o email do auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = profile?.email ?? user?.email;
  if (!email) return null;

  const { data: byEmail } = await supabase
    .from("cal_bookings")
    .select("id, cal_booking_uid, start_time, end_time, title, meet_url, status")
    // Usa % para tolerar variações de casing e possíveis espaços.
    .ilike("attendee_email", `%${email.trim()}%`)
    .in("status", ["accepted", "pending", "rescheduled"])
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  return byEmail ?? null;
}
