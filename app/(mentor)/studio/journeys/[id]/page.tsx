import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  JourneyPathComposer,
  type JourneyCheckIn,
  type JourneyLevelFeedback,
} from "@/components/journey-path-composer";
import { UserAvatar } from "@/components/user-avatar";
import {
  mapPath,
  type StudentNode,
} from "@/lib/students/queries";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";

export default async function JourneyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pathRow } = await supabase
    .from("paths")
    .select(
      "*, student:profiles!paths_student_id_fkey(id, full_name, email, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!pathRow) notFound();

  const student = Array.isArray(pathRow.student)
    ? pathRow.student[0]
    : pathRow.student;
  if (!student) notFound();

  const path = mapPath(pathRow);

  const [
    { data: nodes },
    { data: checkIns },
    { data: drafts },
    { data: levelFeedbacks },
    { data: libraryAssets },
    { data: libraryCategories },
    { data: libraryTopics },
  ] = await Promise.all([
    supabase
      .from("nodes")
      .select("*")
      .eq("path_id", path.id)
      .order("order_index", { ascending: true }),
    supabase
      .from("check_ins")
      .select(
        "id, node_id, status, kind, created_at, notes, video_url, feedback:feedbacks(notes, next_steps, video_url, approved)",
      )
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(120),
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

  const categories: PickerCategory[] = (libraryCategories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const topics: PickerTopic[] = (libraryTopics ?? []).map((t) => ({
    id: t.id,
    category_id: t.category_id,
    name: t.name,
  }));
  const assets: PickerAsset[] = (libraryAssets ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    usage: a.usage,
    topic_id: a.topic_id,
    url: a.url,
    body: a.body,
    tags: a.tags,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href={`/studio/students/${student.id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition-colors hover:bg-white/10"
        >
          <UserAvatar
            name={student.full_name}
            email={student.email}
            avatarUrl={student.avatar_url}
            size="sm"
            rounded="xl"
          />
          <span className="font-medium">
            {student.full_name ?? student.email}
          </span>
          <ExternalLink className="size-3.5 text-muted-foreground" />
        </Link>
      </div>

      <JourneyPathComposer
        studentId={student.id}
        studentName={student.full_name ?? student.email ?? "Aluno"}
        path={path}
        nodes={mappedNodes}
        checkIns={journeyCheckIns}
        levelFeedbacks={mappedLevelFeedbacks}
        libraryCategories={categories}
        libraryTopics={topics}
        libraryAssets={assets}
      />
    </div>
  );
}
