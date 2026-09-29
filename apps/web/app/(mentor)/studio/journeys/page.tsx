import Link from "next/link";
import { FilePenLine } from "lucide-react";

import { CreatePathButton } from "@/components/create-path-button";
import { JourneyPathRowActions } from "@/components/journey-path-row-actions";
import { createClient } from "@/lib/supabase/server";
import { PathStatusBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";
import { Card } from "@/components/ui/card";
import type { NodeStatus, PathStatus } from "@/lib/types/database.types";

const journeyTableGridClass =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_2.5rem] desktop:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(14rem,auto)] gap-0";
const journeyColPercurso = "min-w-0 pr-3";
const journeyColAluno = "min-w-0 pl-3";
const journeyColActions = "pl-3";

type PathRow = {
  id: string;
  title: string;
  status: PathStatus;
  student_id: string | null;
  placeholder_name: string | null;
  student:
    | { full_name: string | null; email: string | null; avatar_url: string | null }
    | { full_name: string | null; email: string | null; avatar_url: string | null }[]
    | null;
  nodes: {
    id: string;
    title: string;
    status: NodeStatus;
    order_index: number;
    due_date: string | null;
  }[] | null;
};

function PathList({
  paths,
  students,
}: {
  paths: PathRow[];
  students: { id: string; full_name: string | null; email: string | null }[];
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="divide-y divide-white/[0.03]">
        {paths.map((p) => {
          const student = Array.isArray(p.student) ? p.student[0] : p.student;
          const nodes = p.nodes ?? [];
          const done = nodes.filter((n) => n.status === "completed").length;
          const studentLabel =
            student?.full_name ??
            student?.email ??
            (p.placeholder_name
              ? `${p.placeholder_name} (sem conta)`
              : "Sem aluno");
          return (
            <div
              key={p.id}
              className={`${journeyTableGridClass} items-center px-4 py-3 transition-colors hover:bg-white/[0.04]`}
            >
              <Link
                href={`/studio/journeys/${p.id}`}
                className={`${journeyColPercurso} transition-colors hover:text-foreground/90`}
              >
                <p className="truncate font-medium leading-snug">{p.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <PathStatusBadge status={p.status} />
                  <p className="text-xs text-muted-foreground">
                    {done}/{nodes.length} níveis
                  </p>
                </div>
              </Link>
              <div className={`flex items-center gap-2 ${journeyColAluno}`}>
                <UserAvatar
                  className="shrink-0"
                  name={student?.full_name ?? p.placeholder_name}
                  email={student?.email}
                  avatarUrl={student?.avatar_url}
                  size="sm"
                  rounded="xl"
                />
                <p className="min-w-0 flex-1 truncate text-xs leading-tight text-muted-foreground desktop:text-sm">
                  {studentLabel}
                </p>
              </div>
              <div className={journeyColActions}>
                <JourneyPathRowActions
                  path={{
                    id: p.id,
                    title: p.title,
                    student_id: p.student_id,
                  }}
                  students={students}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
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
        "id, title, status, student_id, placeholder_name, created_at, student:profiles!paths_student_id_fkey(full_name, email, avatar_url), nodes(id, title, status, order_index, due_date)",
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

  return (
    <div className="space-y-10">
      <section id="paths" className="scroll-mt-24 space-y-4">
        <h2 className="text-lg font-semibold">
          Percursos{" "}
          <span className="font-normal text-muted-foreground">
            ({sortedLivePaths.length})
          </span>
        </h2>

        {sortedLivePaths.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Ainda não há percursos activos. Quando activares um rascunho, ele
            aparece aqui.
          </Card>
        ) : (
          <PathList paths={sortedLivePaths} students={studentOptions} />
        )}
      </section>

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
          <PathList paths={sortedDraftPaths} students={studentOptions} />
        )}
      </section>
    </div>
  );
}
