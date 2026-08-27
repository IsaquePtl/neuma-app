import { createClient } from "@/lib/supabase/server";

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
  const student = await loadStudentOrThrow(id);
  const rawPath = await loadStudentPath(id);
  const path = rawPath ? mapPath(rawPath) : null;
  const counts = await loadStudentCounts(id, path?.id ?? null);
  const supabase = await createClient();

  const [{ data: nodes }, { data: checkIns }, { data: drafts }, { data: tallyRows }, { data: readyTemplatesRaw }, { data: libraryAssets }, { data: libraryCategories }, { data: libraryTopics }, { data: unassignedPaths }] =
    await Promise.all([
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
        .select("check_in_id, status")
        .eq("status", "pending_review"),
      supabase
        .from("tally_submissions")
        .select(
          "id, submission_kind, source_form_name, created_at, answers, payload, status",
        )
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("path_templates")
        .select(
          "id, title, description, goal, duration_label, path_template_nodes(count)",
        )
        .eq("status", "ready")
        .order("title", { ascending: true }),
      supabase
        .from("library_assets")
        .select("id, title, kind, usage, topic_id, url, body, tags")
        .eq("content_status", "ready")
        .is("archived_at", null)
        .order("title", { ascending: true }),
      supabase
        .from("library_categories")
        .select("id, name")
        .order("sort_index", { ascending: true }),
      supabase
        .from("library_topics")
        .select("id, category_id, name")
        .order("sort_index", { ascending: true }),
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

  const mappedNodes: StudentNode[] = (nodes ?? []).map((n) => ({
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
  }));

  const mappedCheckIns: StudentCheckIn[] = (checkIns ?? []).map((c) => {
    const node = Array.isArray(c.node) ? c.node[0] : c.node;
    const feedback = Array.isArray(c.feedback) ? c.feedback[0] : c.feedback;
    return {
      id: c.id,
      status: c.status,
      kind: c.kind,
      created_at: c.created_at,
      notes: c.notes,
      video_url: c.video_url,
      ai_summary: c.ai_summary,
      node_title: node?.title ?? null,
      feedback_approved: feedback?.approved ?? null,
      feedback_notes: feedback?.notes ?? null,
      feedback_next_steps: feedback?.next_steps ?? null,
      has_draft: draftCheckIns.has(c.id),
    };
  });

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
      node_count,
    };
  });

  const pickerAssets = (libraryAssets ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    usage: a.usage,
    topic_id: a.topic_id,
    url: a.url,
    tags: a.tags ?? [],
  }));

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
      <StudentPanorama
        student={student}
        path={path}
        nodes={mappedNodes}
        checkIns={mappedCheckIns}
        formBlocks={mergedBlocks}
        pendingCount={counts.pendingCheckIns}
        readyTemplates={readyTemplates}
        libraryCategories={libraryCategories ?? []}
        libraryTopics={libraryTopics ?? []}
        libraryAssets={pickerAssets}
      />
      <RemoveStudentControl student={student} />
    </StudentShell>
  );
}
