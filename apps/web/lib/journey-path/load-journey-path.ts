import { createClient } from "@/lib/supabase/server";
import type {
  JourneyCheckIn,
  JourneyLevelFeedback,
} from "@/components/journey-path-composer";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import { mapNode, mapPath, type StudentNode } from "@/lib/students/queries";

export type JourneyPathStudent = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
} | null;

export type JourneyPathPageData = {
  path: ReturnType<typeof mapPath>;
  student: JourneyPathStudent;
  placeholderName: string | null;
  claimEmail: string | null;
  nodes: StudentNode[];
  checkIns: JourneyCheckIn[];
  levelFeedbacks: JourneyLevelFeedback[];
  libraryCategories: PickerCategory[];
  libraryTopics: PickerTopic[];
  libraryAssets: PickerAsset[];
  allStudents: { id: string; full_name: string | null; email: string | null }[];
  displayName: string;
};

export async function loadJourneyPathPageData(
  id: string,
): Promise<JourneyPathPageData | null> {
  const supabase = await createClient();

  const { data: pathRow } = await supabase
    .from("paths")
    .select(
      "*, student:profiles!paths_student_id_fkey(id, full_name, email, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!pathRow) return null;

  const student = Array.isArray(pathRow.student)
    ? pathRow.student[0]
    : pathRow.student;

  const path = mapPath(pathRow);
  const placeholderName =
    (pathRow as { placeholder_name?: string | null }).placeholder_name ?? null;
  const claimEmail =
    (pathRow as { claim_email?: string | null }).claim_email ?? null;

  const [
    { data: nodes },
    { data: checkIns },
    { data: drafts },
    { data: levelFeedbacks },
    { data: libraryAssets },
    { data: libraryCategories },
    { data: libraryTopics },
    { data: allStudents },
  ] = await Promise.all([
    supabase
      .from("nodes")
      .select("*")
      .eq("path_id", path.id)
      .order("order_index", { ascending: true }),
    student
      ? supabase
          .from("check_ins")
          .select(
            "id, node_id, status, kind, created_at, notes, video_url, feedback:feedbacks(notes, next_steps, video_url, approved)",
          )
          .eq("student_id", student.id)
          .order("created_at", { ascending: false })
          .limit(120)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("feedback_drafts")
      .select("id, check_in_id, body_notes, body_next_steps, status")
      .eq("status", "pending_review"),
    supabase
      .from("level_feedbacks")
      .select("id, node_id, notes, video_url, file_url, created_at")
      .order("created_at", { ascending: false }),
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
    !student
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "student")
          .order("full_name")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const nodeIds = new Set((nodes ?? []).map((n) => n.id));
  const draftByCheckIn = new Map(
    (drafts ?? []).map((d) => [
      d.check_in_id,
      {
        id: d.id,
        body_notes: d.body_notes,
        body_next_steps: d.body_next_steps,
      },
    ]),
  );

  const mappedNodes: StudentNode[] = (nodes ?? []).map(mapNode);

  const journeyCheckIns: JourneyCheckIn[] = (checkIns ?? [])
    .filter(
      (c): c is typeof c & { node_id: string } =>
        typeof c.node_id === "string" && nodeIds.has(c.node_id),
    )
    .map((c) => {
      const feedback = Array.isArray(c.feedback) ? c.feedback[0] : c.feedback;
      return {
        id: c.id,
        node_id: c.node_id,
        status: c.status,
        kind: c.kind,
        created_at: c.created_at,
        notes: c.notes,
        video_url: c.video_url,
        feedback: feedback
          ? {
              notes: feedback.notes,
              next_steps: feedback.next_steps,
              video_url: feedback.video_url,
              approved: feedback.approved,
            }
          : null,
        draft: draftByCheckIn.get(c.id) ?? null,
      };
    });

  const mappedLevelFeedbacks: JourneyLevelFeedback[] = (levelFeedbacks ?? [])
    .filter((f) => nodeIds.has(f.node_id))
    .map((f) => ({
      id: f.id,
      node_id: f.node_id,
      notes: f.notes,
      video_url: f.video_url,
      file_url: f.file_url,
      created_at: f.created_at,
    }));

  const displayName =
    student?.full_name ??
    student?.email ??
    placeholderName ??
    "Sem aluno";

  return {
    path,
    student: student ?? null,
    placeholderName,
    claimEmail,
    nodes: mappedNodes,
    checkIns: journeyCheckIns,
    levelFeedbacks: mappedLevelFeedbacks,
    libraryCategories: (libraryCategories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
    })),
    libraryTopics: (libraryTopics ?? []).map((t) => ({
      id: t.id,
      category_id: t.category_id,
      name: t.name,
    })),
    libraryAssets: (libraryAssets ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      kind: a.kind,
      usage: a.usage,
      topic_id: a.topic_id,
      url: a.url,
      body: a.body,
      tags: a.tags,
    })),
    allStudents: allStudents ?? [],
    displayName,
  };
}
