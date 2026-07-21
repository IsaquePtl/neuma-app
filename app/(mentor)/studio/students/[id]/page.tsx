import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronUp, ChevronDown, Trash2, Target, CalendarRange } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PathForm } from "@/components/path-form";
import { NodeDialog } from "@/components/node-dialog";
import {
  CheckInStatusBadge,
  NodeKindBadge,
  NodeStatusBadge,
  PathStatusBadge,
} from "@/components/status-badges";
import { deleteNode, moveNode } from "@/lib/actions/nodes";
import { formatDate, formatDateTime } from "@/lib/labels";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("profiles")
    .select("id, full_name, email, onboarding_completed")
    .eq("id", id)
    .single();

  if (!student) notFound();

  const { data: path } = await supabase
    .from("paths")
    .select("*")
    .eq("student_id", id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: nodes } = path
    ? await supabase
        .from("nodes")
        .select("*")
        .eq("path_id", path.id)
        .order("order_index", { ascending: true })
    : { data: null };

  const { data: checkIns } = await supabase
    .from("check_ins")
    .select("id, status, kind, created_at, node:nodes(title)")
    .eq("student_id", id)
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <div className="space-y-8">
      <Link
        href="/studio/students"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Alunos
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-full bg-secondary text-lg font-medium">
            {(student.full_name ?? student.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {student.full_name ?? student.email}
            </h1>
            <p className="text-sm text-muted-foreground">{student.email}</p>
          </div>
        </div>
      </header>

      {/* Percurso */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Percurso</h2>
          {path ? (
            <PathForm studentId={id} path={path} />
          ) : (
            <PathForm studentId={id} />
          )}
        </div>

        {!path ? (
          <Card className="p-8 text-center text-muted-foreground">
            Ainda nao ha percurso. Cria um para comecar a planificar o trabalho
            deste aluno.
          </Card>
        ) : (
          <Card className="neuma-accent-top space-y-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{path.title}</h3>
                {path.goal ? (
                  <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                    <Target className="mt-0.5 size-4 shrink-0" />
                    {path.goal}
                  </p>
                ) : null}
              </div>
              <PathStatusBadge status={path.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {path.duration_label ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange className="size-4" /> {path.duration_label}
                </span>
              ) : null}
              {path.start_date ? (
                <span>Inicio: {formatDate(path.start_date)}</span>
              ) : null}
              {path.end_date ? (
                <span>Fim: {formatDate(path.end_date)}</span>
              ) : null}
            </div>
          </Card>
        )}
      </section>

      {/* Blocos / timeline */}
      {path ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Blocos do percurso{" "}
              <span className="text-muted-foreground">
                ({nodes?.length ?? 0})
              </span>
            </h2>
            <NodeDialog pathId={path.id} />
          </div>

          {!nodes || nodes.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Sem blocos ainda. Adiciona semanas/blocos para desenhar o percurso
              (ex: Semana 1, Semana 2...).
            </Card>
          ) : (
            <ol className="space-y-3">
              {nodes.map((node, i) => (
                <li key={node.id}>
                  <Card className="flex items-start gap-4 p-4">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full border text-sm font-medium tabular-nums">
                      {node.week_number ?? i + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{node.title}</p>
                        <NodeStatusBadge status={node.status} />
                        <NodeKindBadge kind={node.kind} />
                      </div>
                      {node.description ? (
                        <p className="text-sm text-muted-foreground">
                          {node.description}
                        </p>
                      ) : null}
                      {node.due_date ? (
                        <p className="text-xs text-muted-foreground">
                          Data limite: {formatDate(node.due_date)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <form action={moveNode}>
                        <input type="hidden" name="id" value={node.id} />
                        <input type="hidden" name="path_id" value={path.id} />
                        <input type="hidden" name="direction" value="up" />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          disabled={i === 0}
                          aria-label="Mover para cima"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                      </form>
                      <form action={moveNode}>
                        <input type="hidden" name="id" value={node.id} />
                        <input type="hidden" name="path_id" value={path.id} />
                        <input type="hidden" name="direction" value="down" />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          disabled={i === nodes.length - 1}
                          aria-label="Mover para baixo"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </form>
                      <NodeDialog
                        pathId={path.id}
                        node={{
                          id: node.id,
                          title: node.title,
                          description: node.description,
                          week_number: node.week_number,
                          kind: node.kind,
                          status: node.status,
                          due_date: node.due_date,
                        }}
                      />
                      <form action={deleteNode}>
                        <input type="hidden" name="id" value={node.id} />
                        <input type="hidden" name="path_id" value={path.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar bloco"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      {/* Check-ins do aluno */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Check-ins recentes</h2>
        {!checkIns || checkIns.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Este aluno ainda nao submeteu check-ins.
          </Card>
        ) : (
          <div className="grid gap-3">
            {checkIns.map((c) => {
              const node = Array.isArray(c.node) ? c.node[0] : c.node;
              return (
                <Link key={c.id} href={`/studio/checkins/${c.id}`}>
                  <Card className="flex items-center justify-between p-4 transition-colors hover:bg-card/80">
                    <div>
                      <p className="font-medium">{node?.title ?? "Bloco"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(c.created_at)}
                      </p>
                    </div>
                    <CheckInStatusBadge status={c.status} />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
