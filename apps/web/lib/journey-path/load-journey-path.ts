import { calendarStart, dueLevelToOpen, earlyActiveLevel } from "@/lib/nodes/level-open";
import { reconcileLevelSchedule } from "@/lib/nodes/open-due-level";
import { createClient } from "@/lib/supabase/server";
import { playableVideoUrl } from "@/lib/storage/playable-video";
import type {
  JourneyCheckIn,
  JourneyLevelFeedback,
} from "@/components/journey-path-composer";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import {
  attachLibraryPosters,
  mapNode,
  mapPath,
  type StudentNode,
} from "@/lib/students/queries";

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
  opts?: { includeCatalog?: boolean; scope?: "view" | "edit" | "full" },
): Promise<JourneyPathPageData | null> {
  const scope = opts?.scope ?? "full";
  const includeCatalog = opts?.includeCatalog ?? false;
  const supabase = await createClient();

  const [{ data: pathRow }, { data: checkIns }] = await Promise.all([
    supabase
      .from("paths")
      .select(
        "*, student:profiles!paths_student_id_fkey(id, full_name, email, avatar_url), nodes(*)",
      )
      .eq("id", id)
      .maybeSingle(),
    scope === "edit"
      ? Promise.resolve({ data: [] as never[] })
      : scope === "view"
        ? supabase
            .from("check_ins")
            .select("id, node_id, status, kind, created_at, node:nodes!inner(path_id)")
            .eq("status", "pending")
            .eq("node.path_id", id)
        : supabase
            .from("check_ins")
            .select(
              "id, node_id, status, kind, created_at, notes, video_url, feedback:feedbacks(notes, next_steps, video_url, approved), node:nodes!inner(path_id)",
            )
            .eq("node.path_id", id)
            .order("created_at", { ascending: false })
            .limit(120),
  ]);

  if (!pathRow) return null;

  const student = Array.isArray(pathRow.student)
    ? pathRow.student[0]
    : pathRow.student;

  const path = mapPath(pathRow);
  const placeholderName =
    (pathRow as { placeholder_name?: string | null }).placeholder_name ?? null;
  const claimEmail =
    (pathRow as { claim_email?: string | null }).claim_email ?? null;
  const nodes = (
    (pathRow as { nodes?: Parameters<typeof mapNode>[0][] }).nodes ?? []
  )
    .slice()
    .sort((a, b) => a.order_index - b.order_index);

  const [
    { data: libraryAssets },
    { data: libraryCategories },
    { data: libraryTopics },
    { data: allStudents },
  ] = await Promise.all([
    includeCatalog
      ? supabase
          .from("library_assets")
          .select("id, title, kind, usage, topic_id, url, body, tags")
          .eq("content_status", "ready")
          .is("archived_at", null)
          .order("title", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    includeCatalog
      ? supabase
          .from("library_categories")
          .select("id, name")
          .order("sort_index", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    includeCatalog
      ? supabase
          .from("library_topics")
          .select("id, category_id, name")
          .order("sort_index", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    !student
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "student")
          .order("full_name")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const nodeIdList = (nodes ?? []).map((n) => n.id);
  const checkInIdList = (checkIns ?? [])
    .map((c) => c.id)
    .filter((checkInId): checkInId is string => Boolean(checkInId));

  const draftsPromise =
    scope === "full" && checkInIdList.length > 0
      ? supabase
          .from("feedback_drafts")
          .select("id, check_in_id, body_notes, body_next_steps, status")
          .eq("status", "pending_review")
          .in("check_in_id", checkInIdList)
      : Promise.resolve({ data: [] as never[] });
  const levelFeedbacksPromise =
    scope === "full" && nodeIdList.length > 0
      ? supabase
          .from("level_feedbacks")
          .select("id, node_id, notes, video_url, file_url, created_at")
          .in("node_id", nodeIdList)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] });

  const nodeIds = new Set(nodeIdList);

  const mapped = (nodes ?? []).map(mapNode);
  const scheduleStart = calendarStart(path.start_date, path.created_at);
  if (
    path.status === "active" &&
    (earlyActiveLevel(mapped, scheduleStart) ||
      dueLevelToOpen(mapped, scheduleStart, path.status))
  ) {
    await reconcileLevelSchedule(supabase, mapped, {
      id: path.id,
      status: path.status,
      startDate: scheduleStart,
    });
  }

  const [mappedNodes, { data: drafts }, { data: levelFeedbacks }] =
    await Promise.all([
      // Vista e edição não mostram a capa. O URL do ficheiro já fica
      // no nível quando o item da biblioteca é guardado.
      scope === "full"
        ? attachLibraryPosters(supabase, mapped)
        : Promise.resolve(
            mapped.map((node) => ({ ...node, poster_url: null })),
          ),
      draftsPromise,
      levelFeedbacksPromise,
    ]);

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

  const visibleCheckIns = (checkIns ?? []).filter(
    (c): c is typeof c & { node_id: string } =>
      typeof c.node_id === "string" && nodeIds.has(c.node_id),
  );

  const journeyCheckIns: JourneyCheckIn[] =
    scope === "full"
      ? await Promise.all(
          visibleCheckIns.map(async (c) => {
            const row = c as typeof c & {
              notes?: string | null;
              video_url?: string | null;
              feedback?:
                | {
                    notes: string | null;
                    next_steps: string | null;
                    video_url: string | null;
                    approved: boolean;
                  }
                | {
                    notes: string | null;
                    next_steps: string | null;
                    video_url: string | null;
                    approved: boolean;
                  }[]
                | null;
            };
            const feedback = Array.isArray(row.feedback)
              ? row.feedback[0]
              : row.feedback;
            const [videoUrl, feedbackVideoUrl] = await Promise.all([
              playableVideoUrl(row.video_url),
              playableVideoUrl(feedback?.video_url),
            ]);
            return {
              id: c.id,
              node_id: c.node_id,
              status: c.status,
              kind: c.kind,
              created_at: c.created_at,
              notes: row.notes ?? null,
              video_url: videoUrl,
              feedback: feedback
                ? {
                    notes: feedback.notes,
                    next_steps: feedback.next_steps,
                    video_url: feedbackVideoUrl,
                    approved: feedback.approved,
                  }
                : null,
              draft: draftByCheckIn.get(c.id) ?? null,
            };
          }),
        )
      : visibleCheckIns.map((c) => ({
          id: c.id,
          node_id: c.node_id,
          status: c.status,
          kind: c.kind,
          created_at: c.created_at,
          notes: null,
          video_url: null,
          feedback: null,
          draft: null,
        }));

  const mappedLevelFeedbacks: JourneyLevelFeedback[] =
    scope === "full"
      ? await Promise.all(
          (levelFeedbacks ?? [])
            .filter((f) => nodeIds.has(f.node_id))
            .map(async (f) => ({
              id: f.id,
              node_id: f.node_id,
              notes: f.notes,
              video_url: await playableVideoUrl(f.video_url),
              file_url: await playableVideoUrl(f.file_url),
              created_at: f.created_at,
            })),
        )
      : [];

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
