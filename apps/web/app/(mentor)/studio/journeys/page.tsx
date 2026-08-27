import Link from "next/link";
import { ArrowRight, Route } from "lucide-react";

import { CreatePathButton } from "@/components/create-path-button";
import { PathTemplateRowActions } from "@/components/path-template-row-actions";
import { createClient } from "@/lib/supabase/server";
import { PathStatusBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";
import { Card } from "@/components/ui/card";
import { pathStatusLabel, pathTemplateStatusLabel } from "@/lib/labels";
import type { NodeStatus, PathStatus } from "@/lib/types/database.types";

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

function currentNode(
  nodes: { id: string; title: string; status: NodeStatus; order_index: number }[],
) {
  const sorted = [...nodes].sort((a, b) => a.order_index - b.order_index);
  return (
    sorted.find((n) => n.status === "active") ??
    sorted.filter((n) => n.status === "completed").at(-1) ??
    sorted[0] ??
    null
  );
}

export default async function JourneysListPage() {
  const supabase = await createClient();

  const [{ data: paths }, { data: templates }, { data: students }] =
    await Promise.all([
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
    ]);

  const list = (paths as PathRow[] | null) ?? [];
  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    email: s.email,
  }));

  // Prefer active first, then by title
  const sorted = [...list].sort((a, b) => {
    const rank = (s: PathStatus) =>
      s === "active" ? 0 : s === "draft" ? 1 : s === "paused" ? 2 : 3;
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title, "pt");
  });

  return (
    <div className="space-y-10">
      <section id="templates" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Route className="size-5" /> Templates de percurso
            <span className="text-muted-foreground">
              ({templates?.length ?? 0})
            </span>
          </h2>
          <CreatePathButton className="h-9 px-3" />
        </div>

        {(templates ?? []).length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Cria um template com N níveis e liga recursos da biblioteca. Depois
            vincula a um aluno.
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Percursos dos alunos{" "}
          <span className="font-normal text-muted-foreground">
            ({sorted.length})
          </span>
        </h2>

        {sorted.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Ainda não há percursos aplicados. Cria um template acima e vincula a
            um aluno, ou aplica a partir da ficha do aluno.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem_2rem] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground desktop:grid">
              <span>Percurso</span>
              <span>Aluno</span>
              <span>Nível atual</span>
              <span>Estado</span>
              <span />
            </div>
            <div className="divide-y divide-white/5">
              {sorted.map((p) => {
                const student = Array.isArray(p.student)
                  ? p.student[0]
                  : p.student;
                const nodes = p.nodes ?? [];
                const current = currentNode(nodes);
                const done = nodes.filter((n) => n.status === "completed").length;
                const studentLabel =
                  student?.full_name ??
                  student?.email ??
                  (p.placeholder_name
                    ? `${p.placeholder_name} (sem conta)`
                    : "Sem aluno");
                return (
                  <Link
                    key={p.id}
                    href={`/studio/journeys/${p.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] desktop:grid desktop:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem_2rem]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground desktop:hidden">
                        {studentLabel}
                        {current ? ` · ${current.title}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {done}/{nodes.length} níveis
                      </p>
                    </div>
                    <div className="hidden min-w-0 items-center gap-2 desktop:flex">
                      <UserAvatar
                        name={student?.full_name ?? p.placeholder_name}
                        email={student?.email}
                        avatarUrl={student?.avatar_url}
                        size="sm"
                        rounded="xl"
                      />
                      <p className="truncate text-sm text-muted-foreground">
                        {studentLabel}
                      </p>
                    </div>
                    <p className="hidden truncate text-sm text-muted-foreground desktop:block">
                      {current?.title ?? "—"}
                    </p>
                    <div className="hidden desktop:block">
                      <PathStatusBadge status={p.status} />
                    </div>
                    <span className="sr-only">{pathStatusLabel[p.status]}</span>
                    <ArrowRight className="size-4 shrink-0 justify-self-end text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
