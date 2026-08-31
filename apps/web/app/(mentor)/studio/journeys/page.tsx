import Link from "next/link";
import { ArrowRight, Bot, Route } from "lucide-react";

import { CreatePathButton } from "@/components/create-path-button";
import { JourneyPathRowActions } from "@/components/journey-path-row-actions";
import { LibraryAgentNeedsYou } from "@/components/library-agent-needs";
import { PathTemplateRowActions } from "@/components/path-template-row-actions";
import {
  isAgentPathPending,
  shellsForPathNodes,
} from "@/lib/agent-path-gaps";
import { purgeOrphanedAgentShells } from "@/lib/actions/agent-library";
import { createClient } from "@/lib/supabase/server";
import { PathStatusBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";
import { Card } from "@/components/ui/card";
import { pathStatusLabel, pathTemplateStatusLabel } from "@/lib/labels";
import { isAgentEmptyShell } from "@/lib/library-ready";
import type {
  LibraryAssetKind,
  LibraryAssetUsage,
  NodeStatus,
  PathStatus,
} from "@/lib/types/database.types";

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
  nodes: { id: string; title: string; status: NodeStatus; order_index: number }[] | null;
};

export default async function JourneysListPage() {
  await purgeOrphanedAgentShells();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: paths },
    { data: templates },
    { data: students },
    { data: agentProposals },
    { data: shellAssets },
    { data: categories },
    { data: libraryTopics },
  ] = await Promise.all([
    supabase
      .from("paths")
      .select(
        "id, title, status, student_id, placeholder_name, created_at, student:profiles!paths_student_id_fkey(full_name, email, avatar_url), nodes(id, title, status, order_index)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("path_templates")
      .select(
        "id, title, description, goal, duration_label, suggested_node_count, status, created_at, path_template_nodes(count)",
      )
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student")
      .order("full_name", { ascending: true }),
    supabase
      .from("agent_proposals")
      .select("id, target_id, kind, status")
      .eq("mentor_id", user!.id)
      .eq("kind", "path_draft")
      .eq("status", "applied")
      .not("target_id", "is", null),
    supabase
      .from("library_assets")
      .select(
        "id, title, summary, kind, usage, topic_id, body, url, storage_path, tags, duration_label, content_status, created_by_agent, archived_at",
      )
      .eq("created_by_agent", true)
      .in("content_status", ["empty", "drafting"])
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("library_categories")
      .select("id, name")
      .order("sort_index", { ascending: true }),
    supabase
      .from("library_topics")
      .select("id, category_id, name")
      .order("sort_index", { ascending: true }),
  ]);

  const list = (paths as PathRow[] | null) ?? [];
  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    email: s.email,
  }));

  const agentPathIds = new Set(
    (agentProposals ?? [])
      .map((p) => p.target_id)
      .filter((id): id is string => Boolean(id)),
  );
  const emptyShells = (shellAssets ?? []).filter(isAgentEmptyShell);

  const agentPaths = list.filter((p) => {
    if (!agentPathIds.has(p.id)) return false;
    const gaps = shellsForPathNodes(emptyShells, p.nodes ?? []);
    return isAgentPathPending(p, true, gaps.length);
  });

  const studentPaths = list.filter((p) => !agentPaths.some((a) => a.id === p.id));

  const sortedStudentPaths = [...studentPaths].sort((a, b) => {
    const rank = (s: PathStatus) =>
      s === "active" ? 0 : s === "draft" ? 1 : s === "paused" ? 2 : 3;
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title, "pt");
  });

  const pickerCategories = categories ?? [];
  const pickerTopics = libraryTopics ?? [];

  return (
    <div className="space-y-10">
      <section id="paths" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Percursos{" "}
            <span className="font-normal text-muted-foreground">
              ({sortedStudentPaths.length})
            </span>
          </h2>
          <CreatePathButton className="h-9 px-3" />
        </div>

        {sortedStudentPaths.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Ainda não há percursos. Cria um percurso e vincula a um aluno, ou
            aplica a partir da ficha do aluno.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-white/[0.03]">
                {sortedStudentPaths.map((p) => {
                const student = Array.isArray(p.student)
                  ? p.student[0]
                  : p.student;
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
                      <p className="truncate font-medium leading-snug">
                        {p.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <PathStatusBadge status={p.status} />
                        <p className="text-xs text-muted-foreground">
                          {done}/{nodes.length} níveis
                        </p>
                      </div>
                    </Link>
                    <div
                      className={`flex items-center gap-2 ${journeyColAluno}`}
                    >
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
                        students={studentOptions}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>

      <section id="agent-paths" className="scroll-mt-24 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bot className="size-5" />
          Percursos do Agent
          <span className="font-normal text-muted-foreground">
            ({agentPaths.length})
          </span>
        </h2>

        {agentPaths.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Sem percursos pendentes do Agent. Novos rascunhos aparecem aqui após
            aprovação no inbox.
          </Card>
        ) : (
          <div className="space-y-4">
            {agentPaths.map((p) => {
              const gaps = shellsForPathNodes(emptyShells, p.nodes ?? []);
              return (
                <div key={p.id} className="space-y-3">
                  <Card className="overflow-hidden p-0">
                    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <Link
                        href={`/studio/journeys/${p.id}`}
                        className="min-w-0 flex-1"
                      >
                        <p className="truncate font-medium">{p.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {pathStatusLabel[p.status]}
                          {p.placeholder_name
                            ? ` · ${p.placeholder_name}`
                            : ""}
                          {gaps.length > 0
                            ? ` · ${gaps.length} casca${gaps.length === 1 ? "" : "s"} por preencher`
                            : ""}
                        </p>
                      </Link>
                      <div className="flex items-center gap-2">
                        <JourneyPathRowActions
                          path={{
                            id: p.id,
                            title: p.title,
                            student_id: p.student_id,
                          }}
                          students={studentOptions}
                        />
                        <Link
                          href={`/studio/journeys/${p.id}`}
                          className="inline-flex shrink-0 items-center text-muted-foreground hover:text-foreground"
                          aria-label="Abrir percurso"
                        >
                          <ArrowRight className="size-4" />
                        </Link>
                      </div>
                    </div>
                  </Card>
                  {gaps.length > 0 ? (
                    <LibraryAgentNeedsYou
                      topics={[]}
                      assets={gaps.map((a) => ({
                        id: a.id,
                        title: a.title,
                        summary: a.summary,
                        usage: a.usage as LibraryAssetUsage,
                        kind: a.kind as LibraryAssetKind,
                        topic_id: a.topic_id,
                        body: a.body,
                        url: a.url,
                        storage_path: a.storage_path,
                        tags: a.tags ?? [],
                        duration_label: a.duration_label,
                      }))}
                      categories={pickerCategories}
                      libraryTopics={pickerTopics}
                      pathId={p.id}
                      pathTitle={p.title}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section id="templates" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Route className="size-5" /> Templates
            <span className="text-muted-foreground">
              ({templates?.length ?? 0})
            </span>
          </h2>
        </div>

        {(templates ?? []).length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Guarda um percurso existente como template (botão Template) ou
            edita templates aqui quando existirem.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-white/5">
              {(templates ?? []).map((t) => {
                const countRaw = t.path_template_nodes;
                const count = Array.isArray(countRaw)
                  ? (countRaw[0] as { count?: number })?.count ?? 0
                  : ((countRaw as { count?: number } | null)?.count ?? 0);
                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {pathTemplateStatusLabel[t.status]} · {count} níveis
                        {t.duration_label ? ` · ${t.duration_label}` : ""}
                      </p>
                    </div>
                    <PathTemplateRowActions
                      template={{
                        id: t.id,
                        title: t.title,
                        description: t.description,
                        goal: t.goal,
                        duration_label: t.duration_label,
                      }}
                      students={studentOptions}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
