import { createClient } from "@/lib/supabase/server";
import { playableVideoUrl } from "@/lib/storage/playable-video";

import { OneToOneCourtesyCard } from "@/components/one-to-one-courtesy-card";
import { StudentPanorama } from "@/components/student-panorama";
import { StudentShell } from "@/components/student-shell";
import { ClaimUnassignedToStudent } from "@/components/claim-unassigned-to-student";
import { RemoveStudentControl } from "@/components/remove-student-control";
import {
  formatTallyAnswerText,
  resolveTallyAnswers,
} from "@/components/tally-answers";
import {
  loadStudentCounts,
  loadStudentOrThrow,
  loadStudentPath,
  mapNode,
  mapPath,
  type StudentCheckIn,
  type StudentFormBlock,
  type StudentNode,
} from "@/lib/students/queries";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [student, rawPath] = await Promise.all([
    loadStudentOrThrow(id),
    loadStudentPath(id),
  ]);
  const path = rawPath ? mapPath(rawPath) : null;
  const supabase = await createClient();

  const [
    counts,
    { data: accessFlags },
    { data: nodes },
    { data: checkIns },
    { data: drafts },
    { data: tallyRows },
    { data: readyTemplatesRaw },
    { data: unassignedPaths },
  ] = await Promise.all([
    loadStudentCounts(id, path?.id ?? null),
    supabase
      .from("profiles")
      .select("is_one_to_one, one_to_one_access_until, billing_exempt")
      .eq("id", id)
      .maybeSingle(),
      path
        ? supabase
            .from("nodes")
            .select("*")
            .eq("path_id", path.id)
            .order("order_index", { ascending: true })
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("check_ins")
        .select(
          "id, status, kind, created_at, notes, video_url, ai_summary, node:nodes(title), feedback:feedbacks(approved, notes, next_steps)",
        )
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("feedback_drafts")
        .select("check_in_id, status, check_in:check_ins!inner(student_id)")
        .eq("status", "pending_review")
        .eq("check_in.student_id", id),
      supabase
        .from("tally_submissions")
        .select(
          "id, submission_kind, source_form_name, created_at, answers, payload, status",
        )
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(40),
      path
        ? Promise.resolve({ data: [] as never[] })
        : supabase
            .from("path_templates")
            .select(
              "id, title, description, goal, duration_label, period_months, path_template_nodes(count)",
            )
            .eq("status", "ready")
            .order("title", { ascending: true }),
      !path
        ? supabase
            .from("paths")
            .select("id, title, placeholder_name, claim_email")
            .is("student_id", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const checkInIdsForDrafts = (checkIns ?? []).map((c) => c.id);
  const draftCheckIns = new Set(
    (drafts ?? [])
      .filter((d) => checkInIdsForDrafts.includes(d.check_in_id))
      .map((d) => d.check_in_id),
  );

  const mappedNodes: StudentNode[] = (nodes ?? []).map(mapNode);

  const mappedCheckIns: StudentCheckIn[] = await Promise.all(
    (checkIns ?? []).map(async (c) => {
      const node = Array.isArray(c.node) ? c.node[0] : c.node;
      const feedback = Array.isArray(c.feedback) ? c.feedback[0] : c.feedback;
      return {
        id: c.id,
        status: c.status,
        kind: c.kind,
        created_at: c.created_at,
        notes: c.notes,
        video_url: await playableVideoUrl(c.video_url),
        ai_summary: c.ai_summary,
        node_title: node?.title ?? null,
        feedback_approved: feedback?.approved ?? null,
        feedback_notes: feedback?.notes ?? null,
        feedback_next_steps: feedback?.next_steps ?? null,
        has_draft: draftCheckIns.has(c.id),
      };
    }),
  );

  const tallyBlocks: StudentFormBlock[] = (tallyRows ?? []).map((row) => {
    const answers = resolveTallyAnswers(row.answers, row.payload);
    return {
      id: row.id,
      form_id: row.id,
      form_title: row.source_form_name ?? "Submissão",
      form_description: null,
      is_onboarding: row.submission_kind === "onboarding",
      created_at: row.created_at,
      pairs: answers.map((answer) => ({
        label: answer.label ?? answer.key ?? "Campo",
        value: formatTallyAnswerText(answer),
      })),
    };
  });

  const mergedBlocks = [...tallyBlocks].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const readyTemplates = (readyTemplatesRaw ?? []).map((t) => {
    const countRaw = t.path_template_nodes;
    const node_count = Array.isArray(countRaw)
      ? (countRaw[0] as { count?: number })?.count ?? 0
      : ((countRaw as { count?: number } | null)?.count ?? 0);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      goal: t.goal,
      duration_label: t.duration_label,
      period_months: t.period_months,
      node_count,
    };
  });

  const nextDue = mappedNodes.find(
    (node) => node.status === "active" && node.due_date,
  );

  return (
    <StudentShell
      student={student}
      counts={counts}
      pathTitle={path?.title}
      pathStatus={path?.status}
    >
      {!path && (unassignedPaths?.length ?? 0) > 0 ? (
        <ClaimUnassignedToStudent
          studentId={id}
          paths={unassignedPaths ?? []}
        />
      ) : null}
      <p className="text-sm text-muted-foreground">
        {accessFlags?.is_one_to_one
          ? `Acesso 1:1${accessFlags.one_to_one_access_until ? ` até ${accessFlags.one_to_one_access_until.slice(0, 10)}` : ""}`
          : accessFlags?.billing_exempt
            ? "Acesso isento"
            : "Sem cortesia 1:1"}
        {counts.pendingCheckIns > 0
          ? ` · ${counts.pendingCheckIns} check-in${counts.pendingCheckIns === 1 ? "" : "s"} pendente${counts.pendingCheckIns === 1 ? "" : "s"}`
          : ""}
        {nextDue?.due_date ? ` · próximo prazo ${nextDue.due_date}` : ""}
      </p>
      <OneToOneCourtesyCard
        profileId={id}
        isOneToOne={accessFlags?.is_one_to_one ?? false}
        accessUntil={accessFlags?.one_to_one_access_until ?? null}
      />
      <StudentPanorama
        student={student}
        path={path}
        nodes={mappedNodes}
        checkIns={mappedCheckIns}
        formBlocks={mergedBlocks}
        pendingCount={counts.pendingCheckIns}
        readyTemplates={readyTemplates}
      />
      <RemoveStudentControl student={student} />
    </StudentShell>
  );
}
