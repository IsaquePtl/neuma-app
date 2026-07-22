"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Inbox,
  Route,
  Target,
  Trash2,
  ClipboardList,
  StickyNote,
  UserRound,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { PathForm } from "@/components/path-form";
import { NodeDialog } from "@/components/node-dialog";
import {
  CheckInStatusBadge,
  NodeKindBadge,
  NodeStatusBadge,
  PathStatusBadge,
} from "@/components/status-badges";
import { deleteNode, moveNode } from "@/lib/actions/nodes";
import {
  updateStudentNotes,
  updateStudentProfile,
} from "@/lib/actions/students";
import { formatDate, formatDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  CheckInStatus,
  NodeKind,
  NodeStatus,
  PathStatus,
} from "@/lib/types/database.types";

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
  onboarding_completed: boolean;
  internal_notes: string | null;
  created_at: string;
};

type PathData = {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_label: string | null;
  start_date: string | null;
  end_date: string | null;
  status: PathStatus;
};

type NodeData = {
  id: string;
  title: string;
  description: string | null;
  week_number: number | null;
  kind: NodeKind;
  status: NodeStatus;
  due_date: string | null;
  resource_url: string | null;
  order_index: number;
};

type CheckInRow = {
  id: string;
  status: CheckInStatus;
  kind: string;
  created_at: string;
  notes: string | null;
  node_title: string | null;
};

type FormAnswerBlock = {
  id: string;
  form_title: string;
  is_onboarding: boolean;
  created_at: string;
  pairs: { label: string; value: string }[];
};

const TABS = [
  { id: "overview", label: "Visao", icon: UserRound },
  { id: "path", label: "Percurso", icon: Route },
  { id: "checkins", label: "Check-ins", icon: Inbox },
  { id: "forms", label: "Forms", icon: ClipboardList },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function StudentHub({
  student,
  path,
  nodes,
  checkIns,
  formBlocks,
  pendingCount,
}: {
  student: Student;
  path: PathData | null;
  nodes: NodeData[];
  checkIns: CheckInRow[];
  formBlocks: FormAnswerBlock[];
  pendingCount: number;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [pending, startTransition] = useTransition();

  const completed = nodes.filter((n) => n.status === "completed").length;
  const total = nodes.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const active = nodes.find((n) => n.status === "active");
  const initial = (student.full_name ?? student.email ?? "?").slice(0, 1).toUpperCase();

  const stats = useMemo(
    () => [
      { label: "Progresso", value: `${pct}%` },
      { label: "Blocos", value: `${completed}/${total || "—"}` },
      { label: "Por rever", value: String(pendingCount) },
      {
        label: "Onboarding",
        value: student.onboarding_completed ? "Feito" : "Pendente",
      },
    ],
    [pct, completed, total, pendingCount, student.onboarding_completed],
  );

  function saveNotes(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateStudentNotes(fd);
      toast.success("Notas guardadas");
    });
  }

  function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateStudentProfile(fd);
      toast.success("Perfil atualizado");
    });
  }

  return (
    <div className="space-y-5 pb-4">
      <Link
        href="/studio/students"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Alunos
      </Link>

      {/* Hero */}
      <section className="neuma-accent-top overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--neuma-coral)] to-[var(--neuma-blue)] text-2xl font-semibold text-white shadow-lg">
            {initial}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {student.full_name ?? student.email}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {student.email}
            </p>
            <p className="text-xs text-muted-foreground">
              Desde {formatDate(student.created_at)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-black/20 px-3 py-3 text-center ring-1 ring-white/8"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {total > 0 ? (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Percurso</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="neuma-gradient h-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* Tabs */}
      <div className="sticky top-14 z-10 -mx-4 bg-background/80 px-4 py-2 backdrop-blur-xl lg:top-0">
        <div className="flex gap-1 overflow-x-auto rounded-full bg-white/5 p-1 ring-1 ring-white/10">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs font-medium transition-all sm:text-sm",
                  active
                    ? "neuma-gradient text-white shadow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0 sm:size-4" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          {active ? (
            <Card className="space-y-2 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--neuma-coral)]">
                Bloco ativo agora
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold">{active.title}</p>
                <NodeKindBadge kind={active.kind} />
              </div>
              {active.description ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {active.description}
                </p>
              ) : null}
              {active.due_date ? (
                <p className="text-xs text-muted-foreground">
                  Limite: {formatDate(active.due_date)}
                </p>
              ) : null}
            </Card>
          ) : (
            <Card className="p-5 text-sm text-muted-foreground">
              Sem bloco ativo. Define o percurso e ativa o proximo passo.
            </Card>
          )}

          <Card className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <UserRound className="size-4" /> Dados do aluno
            </h2>
            <form onSubmit={saveProfile} className="space-y-3">
              <input type="hidden" name="student_id" value={student.id} />
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  defaultValue={student.full_name ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={student.email ?? ""} disabled />
              </div>
              <Button type="submit" size="sm" disabled={pending}>
                Guardar nome
              </Button>
            </form>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <StickyNote className="size-4" /> Notas privadas
            </h2>
            <p className="text-xs text-muted-foreground">
              So tu ves isto. Observacoes pedagogicas, contexto pessoal, etc.
            </p>
            <form onSubmit={saveNotes} className="space-y-3">
              <input type="hidden" name="student_id" value={student.id} />
              <Textarea
                name="internal_notes"
                rows={5}
                defaultValue={student.internal_notes ?? ""}
                placeholder="Ex: prefere manhas; foco em timing; motivado com jazz..."
              />
              <Button type="submit" size="sm" disabled={pending}>
                Guardar notas
              </Button>
            </form>
          </Card>

          {formBlocks[0] ? (
            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Ultimo diagnostico</h2>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setTab("forms")}
                >
                  Ver tudo
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {formBlocks[0].form_title}
              </p>
              <dl className="space-y-2">
                {formBlocks[0].pairs.slice(0, 4).map((p) => (
                  <div key={p.label}>
                    <dt className="text-xs text-muted-foreground">{p.label}</dt>
                    <dd className="text-sm">{p.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "path" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Percurso</h2>
            <PathForm studentId={student.id} path={path ?? undefined} />
          </div>

          {!path ? (
            <Card className="space-y-3 p-8 text-center">
              <p className="text-muted-foreground">
                Ainda nao ha percurso para este aluno.
              </p>
              <PathForm studentId={student.id} />
            </Card>
          ) : (
            <>
              <Card className="neuma-accent-top space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-xl font-semibold">{path.title}</h3>
                    {path.description ? (
                      <p className="text-sm text-muted-foreground">
                        {path.description}
                      </p>
                    ) : null}
                    {path.goal ? (
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Target className="mt-0.5 size-4 shrink-0" />
                        {path.goal}
                      </p>
                    ) : null}
                  </div>
                  <PathStatusBadge status={path.status} />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {path.duration_label ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarRange className="size-3.5" />
                      {path.duration_label}
                    </span>
                  ) : null}
                  {path.start_date ? (
                    <span>Inicio {formatDate(path.start_date)}</span>
                  ) : null}
                  {path.end_date ? (
                    <span>Fim {formatDate(path.end_date)}</span>
                  ) : null}
                </div>
              </Card>

              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Blocos{" "}
                  <span className="text-muted-foreground">({nodes.length})</span>
                </h3>
                <NodeDialog pathId={path.id} />
              </div>

              {nodes.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  Adiciona o primeiro bloco (semana, pratica, chamada...).
                </Card>
              ) : (
                <ol className="space-y-3">
                  {nodes.map((node, i) => (
                    <li key={node.id}>
                      <Card className="space-y-3 p-4">
                        <div className="flex items-start gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/8 text-sm font-semibold tabular-nums">
                            {node.week_number ?? i + 1}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-medium">{node.title}</p>
                              <NodeStatusBadge status={node.status} />
                              <NodeKindBadge kind={node.kind} />
                            </div>
                            {node.description ? (
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {node.description}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {node.due_date ? (
                                <span>Limite {formatDate(node.due_date)}</span>
                              ) : null}
                              {node.resource_url ? (
                                <a
                                  href={node.resource_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 hover:text-foreground"
                                >
                                  Recurso <ExternalLink className="size-3" />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1 border-t border-white/5 pt-2">
                          <form action={moveNode}>
                            <input type="hidden" name="id" value={node.id} />
                            <input type="hidden" name="path_id" value={path.id} />
                            <input type="hidden" name="direction" value="up" />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              disabled={i === 0}
                              aria-label="Subir"
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
                              aria-label="Descer"
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                          </form>
                          <NodeDialog pathId={path.id} node={node} />
                          <form action={deleteNode}>
                            <input type="hidden" name="id" value={node.id} />
                            <input type="hidden" name="path_id" value={path.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              aria-label="Eliminar"
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
            </>
          )}
        </div>
      ) : null}

      {tab === "checkins" ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Check-ins</h2>
          {checkIns.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Ainda sem check-ins deste aluno.
            </Card>
          ) : (
            checkIns.map((c) => (
              <Link key={c.id} href={`/studio/checkins/${c.id}`}>
                <Card className="mb-3 space-y-2 p-4 transition-colors hover:bg-card/80">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {c.node_title ?? "Bloco"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(c.created_at)}
                      </p>
                    </div>
                    <CheckInStatusBadge status={c.status} />
                  </div>
                  {c.notes ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {c.notes}
                    </p>
                  ) : null}
                </Card>
              </Link>
            ))
          )}
        </div>
      ) : null}

      {tab === "forms" ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Diagnostico e forms</h2>
          {formBlocks.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Sem respostas ainda. Quando o aluno completar o onboarding, aparece
              aqui.
            </Card>
          ) : (
            formBlocks.map((block) => (
              <Card key={block.id} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{block.form_title}</p>
                    {block.is_onboarding ? (
                      <p className="text-xs text-[var(--neuma-coral)]">
                        Onboarding
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(block.created_at)}
                  </p>
                </div>
                <dl className="space-y-3">
                  {block.pairs.map((p) => (
                    <div
                      key={p.label}
                      className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5"
                    >
                      <dt className="text-xs text-muted-foreground">{p.label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm">
                        {p.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
