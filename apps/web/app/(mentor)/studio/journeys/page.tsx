import { FilePenLine } from "lucide-react";

import { CreatePathButton } from "@/components/create-path-button";
import {
  JourneyPathList,
  LiveJourneyPaths,
  type JourneyPathListItem,
} from "@/components/journey-path-list";
import { Card } from "@/components/ui/card";
import { pathListSnapshot } from "@/lib/journey-path/list-snapshot";
import { createClient } from "@/lib/supabase/server";
import type {
  CheckInStatus,
  NodeKind,
  NodePassRule,
  NodeStatus,
  PathStatus,
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

function listItem(path: PathRow, snapshot: string | null): JourneyPathListItem {
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

  const activeNodeIds = [
    ...new Set(
      sortedLivePaths.flatMap((path) =>
        (path.nodes ?? [])
          .filter((node) => node.status === "active")
          .map((node) => node.id),
      ),
    ),
  ];

  const checkInsByNode = new Map<
    string,
    { status: CheckInStatus; created_at: string }[]
  >();
  let checkInsLoaded = true;
  if (activeNodeIds.length > 0) {
    const { data: checkInRows, error: checkInError } = await supabase
      .from("check_ins")
      .select("node_id, status, created_at")
      .in("node_id", activeNodeIds);
    if (checkInError) {
      console.error("[journeys] check-ins for path list", checkInError.message);
      checkInsLoaded = false;
    } else {
      for (const row of checkInRows ?? []) {
        if (!row.node_id) continue;
        const bucket = checkInsByNode.get(row.node_id);
        const entry = { status: row.status, created_at: row.created_at };
        if (bucket) bucket.push(entry);
        else checkInsByNode.set(row.node_id, [entry]);
      }
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
    </div>
  );
}
