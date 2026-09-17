import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "../types/database.types";
import {
  addWeeksToDate,
  resolvePathSchedule,
  segmentNodeTimeline,
  weeksBetweenDates,
} from "../path-period";
import { defaultPassRule } from "../nodes/pass-rule";
import {
  ANA_EMAIL,
  ANA_NAME,
  ANA_PASSWORD,
  QA_TEMPLATE_TITLE,
} from "./curriculum";
import { upsertQaCompleteTemplate } from "./upsert-template";

export type QaApplyClient = SupabaseClient<Database>;

export type QaApplyResult = {
  studentId: string;
  templateId: string;
  pathId: string;
  nodeCount: number;
  reused: boolean;
  firstNodeId: string | null;
};

function nextMondayIso(from = new Date()): string {
  const d = new Date(from);
  const day = d.getDay();
  const add = day === 1 ? 0 : (8 - day) % 7 || 0;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

async function findAuthUserId(
  supabase: QaApplyClient,
  email: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profile?.id) return profile.id;

  for (let page = 1; page <= 20; page += 1) {
    const { data } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function ensureAnaRibeiroStudent(
  supabase: QaApplyClient,
  mentorId: string | null,
): Promise<string> {
  let userId = await findAuthUserId(supabase, ANA_EMAIL);

  if (!userId) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: ANA_EMAIL,
      password: ANA_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ANA_NAME },
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "Falha a criar a Ana Ribeiro");
    }
    userId = created.user.id;
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: ANA_EMAIL,
      full_name: ANA_NAME,
      role: "student",
      onboarding_completed: true,
      billing_exempt: true,
      can_book_sessions: true,
      mentor_id: mentorId,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  return userId;
}

async function deletePathWithCheckIns(
  supabase: QaApplyClient,
  pathId: string,
) {
  const { data: nodes } = await supabase
    .from("nodes")
    .select("id")
    .eq("path_id", pathId);
  const ids = (nodes ?? []).map((n) => n.id);
  if (ids.length) {
    await supabase.from("check_ins").delete().in("node_id", ids);
  }
  const { error } = await supabase.from("paths").delete().eq("id", pathId);
  if (error) throw new Error(error.message);
}

export async function applyQaPathToAna(
  supabase: QaApplyClient,
  opts?: { mentorId?: string | null; reset?: boolean },
): Promise<QaApplyResult> {
  const mentorId = opts?.mentorId ?? null;
  const studentId = await ensureAnaRibeiroStudent(supabase, mentorId);
  const seeded = await upsertQaCompleteTemplate(supabase, mentorId);

  const { data: existing } = await supabase
    .from("paths")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("source_template_id", seeded.templateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && !opts?.reset) {
    const { data: nodes } = await supabase
      .from("nodes")
      .select("id, status, order_index")
      .eq("path_id", existing.id)
      .order("order_index", { ascending: true });

    const hasActive = (nodes ?? []).some((n) => n.status === "active");
    const first = nodes?.[0];
    if (!hasActive && first && first.status !== "completed") {
      await supabase
        .from("nodes")
        .update({ status: "active" })
        .eq("id", first.id);
    }
    if (existing.status !== "active" && existing.status !== "completed") {
      await supabase
        .from("paths")
        .update({ status: "active" })
        .eq("id", existing.id);
    }

    return {
      studentId,
      templateId: seeded.templateId,
      pathId: existing.id,
      nodeCount: nodes?.length ?? 0,
      reused: true,
      firstNodeId: (nodes ?? []).find((n) => n.status === "active")?.id ?? first?.id ?? null,
    };
  }

  if (existing && opts?.reset) {
    await deletePathWithCheckIns(supabase, existing.id);
  }

  const schedule = resolvePathSchedule({
    startDate: nextMondayIso(),
    periodMonths: 3,
    durationLabel: "3 meses",
    endDate: null,
  });

  const { data: path, error: pathErr } = await supabase
    .from("paths")
    .insert({
      student_id: studentId,
      created_by: mentorId,
      title: QA_TEMPLATE_TITLE,
      description:
        "Percurso QA da Ana Ribeiro. Não é um path beta de Eduardo/Márcio/Bernardo.",
      goal: "Cobrir todos os gates do produto com stubs.",
      duration_label: schedule.durationLabel,
      start_date: schedule.startDate,
      end_date: schedule.endDate,
      status: "active",
      source_template_id: seeded.templateId,
    })
    .select("id")
    .single();
  if (pathErr || !path) {
    throw new Error(pathErr?.message ?? "Falha a criar o percurso QA");
  }

  const { data: rawNodes, error: tnErr } = await supabase
    .from("path_template_nodes")
    .select(
      "order_index, title, description, kind, week_number, duration_weeks, default_resource_url, library_asset_id, check_in_kind, phase_key, node_code, pass_rule, pass_score, quiz_questions, library_assets(url, body)",
    )
    .eq("template_id", seeded.templateId)
    .order("order_index", { ascending: true });
  if (tnErr) throw new Error(tnErr.message);

  const ordered = [...(rawNodes ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  const totalWeeks =
    schedule.startDate && schedule.endDate
      ? weeksBetweenDates(schedule.startDate, schedule.endDate)
      : ordered.reduce((sum, n) => sum + (n.duration_weeks && n.duration_weeks >= 1 ? n.duration_weeks : 1), 0);
  const segments = segmentNodeTimeline(
    ordered.length,
    Math.max(totalWeeks, 1),
    ordered.map((n) => n.duration_weeks),
  );

  const rows = ordered.map((n, i) => {
    const asset = Array.isArray(n.library_assets)
      ? n.library_assets[0]
      : n.library_assets;
    const segment = segments[i];
    const week_number = segment?.week_number ?? n.week_number;
    const due_date =
      schedule.startDate && segment
        ? addWeeksToDate(
            schedule.startDate,
            segment.week_number + segment.duration_weeks - 1,
          )
        : null;
    return {
      path_id: path.id,
      title: n.title,
      description: n.description,
      kind: n.kind,
      week_number,
      duration_weeks: segment?.duration_weeks ?? n.duration_weeks ?? 1,
      due_date,
      order_index: i,
      status: (i === 0 ? "active" : "locked") as "active" | "locked",
      resource_url: asset?.url ?? n.default_resource_url ?? null,
      content_body: asset?.body ?? null,
      check_in_kind: n.check_in_kind ?? (n.kind === "practice" ? "video" : null),
      pass_rule: n.pass_rule ?? defaultPassRule(n.kind),
      pass_score: n.pass_score,
      phase_key: n.phase_key ?? null,
      node_code: n.node_code ?? null,
    };
  });

  const { data: inserted, error: nErr } = await supabase
    .from("nodes")
    .insert(rows)
    .select("id, order_index");
  if (nErr) throw new Error(nErr.message);

  const quizRows: Array<{
    node_id: string;
    order_index: number;
    prompt: string;
    options: Json;
    correct_option_id: string;
  }> = [];
  for (const created of inserted ?? []) {
    const src = ordered[created.order_index];
    const questions = Array.isArray(src?.quiz_questions)
      ? src.quiz_questions
      : [];
    questions.forEach((q, qi) => {
      if (!q || typeof q !== "object" || Array.isArray(q)) return;
      const rec = q as Record<string, unknown>;
      const prompt = String(rec.prompt ?? "").trim();
      const options = rec.options;
      const correct = String(rec.correct_option_id ?? "");
      if (!prompt || !Array.isArray(options) || options.length < 2 || !correct) {
        return;
      }
      quizRows.push({
        node_id: created.id,
        order_index: qi,
        prompt,
        options: options as Json,
        correct_option_id: correct,
      });
    });
  }
  if (quizRows.length) {
    const { error: qErr } = await supabase
      .from("node_quiz_questions")
      .insert(quizRows);
    if (qErr) throw new Error(qErr.message);
  }

  const first = (inserted ?? []).find((n) => n.order_index === 0);

  return {
    studentId,
    templateId: seeded.templateId,
    pathId: path.id,
    nodeCount: inserted?.length ?? 0,
    reused: false,
    firstNodeId: first?.id ?? null,
  };
}
