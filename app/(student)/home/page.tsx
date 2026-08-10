import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Dumbbell,
  Flag,
  Phone,
  Play,
  Video,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { loadMentorCalUsername, loadMyPathWithNodes } from "@/lib/students/queries";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/labels";
import type { NodeKind } from "@/lib/types/database.types";

type TodoItem = { title: string; href: string; key: string };

type JoinedNodeWeek = { week_number: number | null };
type JoinedFeedbackNotes = { notes: string | null };
type NormalizedApprovedCheckIn = {
  id: string;
  node: JoinedNodeWeek | null;
  feedback: JoinedFeedbackNotes | null;
};

function upperFirstWord(fullName: string | null | undefined) {
  const v = (fullName ?? "").trim();
  if (!v) return null;
  return v.split(/\s+/)[0] ?? null;
}

function weekNumberLabel(week: number | null | undefined) {
  return week == null ? "—" : `${week}`;
}

function kindIconEl(kind: NodeKind) {
  switch (kind) {
    case "call":
      return <Phone className="size-3" />;
    case "lesson":
    case "resource":
      return <Video className="size-3" />;
    case "milestone":
      return <Flag className="size-3" />;
    default:
      return <Dumbbell className="size-3" />;
  }
}

function kindLabelTitle(kind: NodeKind) {
  // Mantém exatamente o casing do `StudentPathMap`
  switch (kind) {
    case "call":
      return "Chamada";
    case "lesson":
    case "resource":
      return "Aula";
    case "milestone":
      return "Marco";
    default:
      return "Prática";
  }
}

function todoTagLabel(key: string) {
  if (key.startsWith("call:")) return "CHAMADA";
  if (key.startsWith("content:")) return "CONTEÚDO";
  if (key.startsWith("checkin:")) return "CHECK-IN";
  if (key.startsWith("feedback:")) return "FEEDBACK";
  if (key === "session") return "1:1";
  if (key === "path") return "PERCURSO";
  return "TAREFA";
}

export default async function StudentHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { path, nodes } = await loadMyPathWithNodes(user!.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();
  const studentName = profile?.full_name ?? user?.email ?? "Aluno";

  const mentor = await loadMentorCalUsername();
  const mentorName = upperFirstWord(mentor?.full_name) ?? "mentor";

  const activeNode =
    nodes.find((n) => n.status === "active") ??
    nodes.find((n) => n.status !== "completed") ??
    nodes[0];

  const activeCall =
    nodes.find((n) => n.status === "active" && n.kind === "call") ??
    nodes.find((n) => n.status !== "completed" && n.kind === "call");
  const activeContent =
    nodes.find(
      (n) =>
        n.status === "active" && (n.kind === "lesson" || n.kind === "resource"),
    ) ??
    nodes.find(
      (n) =>
        n.status !== "completed" &&
        (n.kind === "lesson" || n.kind === "resource"),
    );
  const activeCheckin =
    nodes.find(
      (n) => n.status === "active" && (n.kind === "practice" || n.kind === "milestone"),
    ) ??
    nodes.find(
      (n) =>
        n.status !== "completed" &&
        (n.kind === "practice" || n.kind === "milestone"),
    );

  // Apenas “feedback pronto” (status approved) para compor notificações.
  const { data: approvedCheckIns } = await supabase
    .from("check_ins")
    .select(
      "id,status,node:nodes(week_number),feedback:feedbacks(notes,approved)",
    )
    .eq("student_id", user!.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(5);

  const normalizedCheckIns: NormalizedApprovedCheckIn[] = (approvedCheckIns ??
    []).map((c: unknown) => {
    const cc = c as {
      id: string;
      node: JoinedNodeWeek | JoinedNodeWeek[] | null;
      feedback: JoinedFeedbackNotes | JoinedFeedbackNotes[] | null;
    };
    const node = Array.isArray(cc.node) ? cc.node[0] : cc.node;
    const feedback = Array.isArray(cc.feedback) ? cc.feedback[0] : cc.feedback;
    return {
      id: cc.id,
      node: node ?? null,
      feedback: feedback ?? null,
    };
  });

  if (!path) {
    return (
      <div className="space-y-6 pb-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Geral
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Bem vindo, {studentName}
          </h1>
        </div>

        <Card className="neuma-accent-top space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            O que tens a fazer
          </p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/session#agenda"
                className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-card/80"
              >
                Agendar 1:1 com o mentor
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </li>
            <li>
              <Link
                href="/path"
                className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-card/80"
              >
                Abrir percurso
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </li>
          </ul>
        </Card>

        <Link href="/path" className="block">
          <Card className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              PERCURSO . SEM. —
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-base font-semibold">
                Ainda sem percurso
              </p>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-6 pb-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Geral
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Bem vindo, {studentName}
        </h1>
      </div>

      {/*
        Card minimalista de notificações/tarefas.
        Mantemos a lista pequena e orientada para ações imediatas.
      */}
      {(() => {
        const todos: TodoItem[] = [];

        if (activeContent) {
          const week = weekNumberLabel(activeContent.week_number);
          todos.push({
            key: `content:${activeContent.id}`,
            title: `Ver conteúdo da semana ${week}`,
            href: `/path/${activeContent.id}`,
          });
        }

        if (activeCall) {
          const week = weekNumberLabel(activeCall.week_number);
          todos.push({
            key: `call:${activeCall.id}`,
            title: `Agendar call da semana ${week}`,
            href: `/path/${activeCall.id}`,
          });
        }

        if (activeCheckin) {
          const week = weekNumberLabel(activeCheckin.week_number);
          todos.push({
            key: `checkin:${activeCheckin.id}`,
            title: `Fazer check-in da semana ${week}`,
            href: `/path/${activeCheckin.id}`,
          });
        }

        const feedbackItem = normalizedCheckIns.find((c) => Boolean(c.feedback?.notes));
        if (feedbackItem) {
          const week = weekNumberLabel(feedbackItem.node?.week_number);
          todos.push({
            key: `feedback:${feedbackItem.id}`,
            title: `Ver feedback do ${mentorName} da semana ${week}`,
            href: `/checkins/${feedbackItem.id}`,
          });
        }

        const fallbackTodos: TodoItem[] = [
          {
            key: "session",
            title: "Agendar chamada",
            href: "/session#agenda",
          },
          {
            key: "path",
            title: "Abrir percurso",
            href: "/path",
          },
        ];

        const finalTodos = todos.length > 0 ? todos.slice(0, 6) : fallbackTodos;

        return (
          <Card className="neuma-accent-top flex h-[28rem] flex-col space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:h-[30rem] sm:p-6">
            <p className="shrink-0 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              O que tens a fazer
            </p>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {finalTodos.map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--neuma-coral)]">
                          {todoTagLabel(t.key)}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold tracking-tight">
                          {t.title}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        );
      })()}

      {/* Só o card do nível activo — sem marker. Empurrado para baixo. */}
      <div className="mt-auto pt-10 sm:pt-14">
        <Link
          href={activeNode ? `/path/${activeNode.id}` : "/path"}
          prefetch
          className="block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50"
        >
          <div className="student-path-step student-path-step--active">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
                    {activeNode ? kindIconEl(activeNode.kind) : (
                      <Video className="size-3" />
                    )}
                    {activeNode ? kindLabelTitle(activeNode.kind) : "Aula"}
                    {activeNode?.week_number
                      ? ` · Sem. ${activeNode.week_number}`
                      : null}
                  </span>
                </div>

                <p className="text-lg font-semibold tracking-tight sm:text-xl">
                  {activeNode?.title ?? path.title}
                </p>

                {activeNode?.due_date ? (
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3" />
                    Até {formatDate(activeNode.due_date)}
                  </p>
                ) : null}
              </div>

              <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/10 text-xs font-medium text-white sm:size-auto sm:px-3 sm:py-1.5">
                <Play className="size-3 fill-current" />
                <span className="hidden sm:inline">Entrar</span>
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
