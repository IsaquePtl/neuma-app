import { FilePenLine, LayoutTemplate } from "lucide-react";

import { CreatePathButton } from "@/components/create-path-button";
import {
  JourneyPathList,
  LiveJourneyPaths,
  type JourneyPathListItem,
} from "@/components/journey-path-list";
import { PathTemplateList } from "@/components/path-template-list";
import { Card } from "@/components/ui/card";
import {
  pathListSnapshot,
  type PathListSnapshot,
} from "@/lib/journey-path/list-snapshot";
import { createClient } from "@/lib/supabase/server";
import type {
  CheckInStatus,
  NodeKind,
  NodePassRule,
  NodeStatus,
  PathStatus,
  PathTemplateStatus,
} from "@/lib/types/database.types";

type PathNode = {
  id: string;
  title: string;
  status: NodeStatus;
  due_date: string | null;
  order_index: number;
  week_number: number | null;
  kind: NodeKind;
  pass_rule: NodePassRule | null;
};

type PathRow = {
  id: string;
  title: string;
  status: PathStatus;
  student_id: string | null;
  placeholder_name: string | null;
  start_date: string | null;
  created_at: string;
  student:
    | { full_name: string | null; email: string | null; avatar_url: string | null }
    | { full_name: string | null; email: string | null; avatar_url: string | null }[]
    | null;
  nodes: PathNode[] | null;
};

type TemplateRow = {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_label: string | null;
  period_months: number | null;
  status: PathTemplateStatus;
  path_template_nodes: { count?: number }[] | { count?: number } | null;
};

function templateNodeCount(countRaw: TemplateRow["path_template_nodes"]) {
  if (Array.isArray(countRaw)) return countRaw[0]?.count ?? 0;
  return countRaw?.count ?? 0;
}

function listItem(
  path: PathRow,
  snapshot: PathListSnapshot | null,
): JourneyPathListItem {
  const student = Array.isArray(path.student)
    ? (path.student[0] ?? null)
    : path.student;
  const nodes = path.nodes ?? [];
  return {
    id: path.id,
    title: path.title,
    status: path.status,
    studentId: path.student_id,
    studentName: student?.full_name ?? null,
    studentEmail: student?.email ?? null,
    avatarUrl: student?.avatar_url ?? null,
    placeholderName: path.placeholder_name,
    done: nodes.filter((node) => node.status === "completed").length,
    total: nodes.length,
    snapshot,
  };
}

export default async function JourneysListPage() {
  const supabase = await createClient();

  const [
    { data: paths },
    { data: students },
    { data: pendingCheckIns },
    { data: activeCheckInRows, error: checkInError },
    { data: templateRows },
  ] = await Promise.all([
    supabase
      .from("paths")
      .select(
        "id, title, status, student_id, placeholder_name, start_date, created_at, student:profiles!paths_student_id_fkey(full_name, email, avatar_url), nodes(id, title, status, due_date, order_index, week_number, kind, pass_rule)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student")
      .order("full_name", { ascending: true }),
    supabase
      .from("check_ins")
      .select("student_id")
      .eq("status", "pending"),
    supabase
      .from("check_ins")
      .select("node_id, status, created_at, node:nodes!inner(status)")
      .eq("node.status", "active"),
    supabase
      .from("path_templates")
      .select(
        "id, title, description, goal, duration_label, period_months, status, path_template_nodes(count)",
      )
      .neq("status", "archived")
      .order("title", { ascending: true }),
  ]);

  const list = (paths as PathRow[] | null) ?? [];
  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    email: s.email,
  }));

  const draftPaths = list.filter((p) => p.status === "draft");
  const livePaths = list.filter((p) => p.status !== "draft");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const pendingStudents = new Set(
    (pendingCheckIns ?? [])
      .map((row) => row.student_id)
      .filter((id): id is string => Boolean(id)),
  );
  const stuckRank = (path: PathRow) => {
    const overdue = (path.nodes ?? []).some(
      (node) =>
        node.status === "active" &&
        node.due_date != null &&
        node.due_date < today,
    );
    if (overdue) return 0;
    if (path.student_id && pendingStudents.has(path.student_id)) return 1;
    if (path.status === "active") return 2;
    if (path.status === "paused") return 3;
    return 4;
  };
  const sortedLivePaths = [...livePaths].sort((a, b) => {
    const d = stuckRank(a) - stuckRank(b);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title, "pt");
  });
  const sortedDraftPaths = [...draftPaths].sort((a, b) =>
    a.title.localeCompare(b.title, "pt"),
  );

  const checkInsByNode = new Map<
    string,
    { status: CheckInStatus; created_at: string }[]
  >();
  let checkInsLoaded = true;
  if (checkInError) {
    console.error("[journeys] check-ins for path list", checkInError.message);
    checkInsLoaded = false;
  } else {
    for (const row of activeCheckInRows ?? []) {
      if (!row.node_id) continue;
      const bucket = checkInsByNode.get(row.node_id);
      const entry = { status: row.status, created_at: row.created_at };
      if (bucket) bucket.push(entry);
      else checkInsByNode.set(row.node_id, [entry]);
    }
  }

  const liveItems = sortedLivePaths.map((path) =>
    listItem(
      path,
      pathListSnapshot({
        nodes: path.nodes ?? [],
        startDate: path.start_date,
        createdAt: path.created_at,
        checkInsByNode,
        checkInsLoaded,
      }),
    ),
  );
  const draftItems = sortedDraftPaths.map((path) => listItem(path, null));
  const templateItems = ((templateRows as TemplateRow[] | null) ?? [])
    .filter((template) => template.status !== "archived")
    .sort((a, b) => a.title.localeCompare(b.title, "pt"))
    .map((template) => ({
      id: template.id,
      title: template.title,
      description: template.description,
      goal: template.goal,
      duration_label: template.duration_label,
      period_months: template.period_months,
      status: template.status,
      nodeCount: templateNodeCount(template.path_template_nodes),
    }));

  return (
    <div className="space-y-10">
      <LiveJourneyPaths paths={liveItems} students={studentOptions} />

      <section id="drafts" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FilePenLine className="size-5" />
            Rascunhos
            <span className="font-normal text-muted-foreground">
              ({sortedDraftPaths.length})
            </span>
          </h2>
          <CreatePathButton className="h-9 px-3" />
        </div>

        {sortedDraftPaths.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Ainda não há rascunhos. Os percursos do Grok e os que criares aqui
            ficam nesta zona até os activares.
          </Card>
        ) : (
          <JourneyPathList paths={draftItems} students={studentOptions} />
        )}
      </section>

      <section id="templates" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <LayoutTemplate className="size-5" />
            Templates
            <span className="font-normal text-muted-foreground">
              ({templateItems.length})
            </span>
          </h2>
        </div>

        {templateItems.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Ainda não há templates. Os percursos que guardares com o botão
            Template ficam nesta zona.
          </Card>
        ) : (
          <PathTemplateList
            templates={templateItems}
            students={studentOptions}
          />
        )}
      </section>
    </div>
  );
}
