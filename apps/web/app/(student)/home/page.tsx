import Link from "next/link";
import { Suspense } from "react";
import {
  CalendarClock,
  Dumbbell,
  Flag,
  Phone,
  Play,
  Video,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { loadMentorCalUsername, loadMyPathWithNodes } from "@/lib/students/queries";
import { FirstVisitWelcome } from "@/components/first-visit-welcome";
import {
  StudentTodoList,
  type StudentTodoItem,
} from "@/components/student-todo-list";
import { formatDate, nodeKindLabel } from "@/lib/labels";
import { studentHasOnboardingSubmission } from "@/lib/onboarding/submission";
import {
  firstNameFromFullName,
  welcomeGreeting,
} from "@/lib/profile/greeting";
import type { NodeKind, ProfileGender } from "@/lib/types/database.types";

type JoinedNodeWeek = { week_number: number | null };
type JoinedFeedbackNotes = { notes: string | null };
type NormalizedApprovedCheckIn = {
  id: string;
  node: JoinedNodeWeek | null;
  feedback: JoinedFeedbackNotes | null;
};

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

function todoTagLabel(key: string) {
  if (key.startsWith("call:")) return "SESSÃO";
  if (key.startsWith("content:")) return "AULA";
  if (key.startsWith("checkin:")) return "PRÁTICA";
  if (key.startsWith("feedback:")) return "FEEDBACK";
  if (key === "session") return "MENTOR";
  if (key === "path") return "PERCURSO";
  return "TAREFA";
}

/**
 * Mobile/tablet: coluna centrada no ecrã (ligeiramente mais abaixo do centro).
 * Desktop: centrado na coluna principal (ao lado da sidebar).
 */
const HOME_VIEWPORT =
  "neuma-mobile-viewport flex flex-col justify-center gap-5 overflow-hidden overscroll-none pb-5 " +
  "desktop:min-h-0 desktop:flex-1 desktop:justify-center desktop:gap-3 desktop:overflow-visible desktop:pb-4";

export default async function StudentHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { path, nodes } = await loadMyPathWithNodes(user!.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, gender")
    .eq("id", user!.id)
    .single();
  const studentName =
    firstNameFromFullName(profile?.full_name) ??
    profile?.full_name ??
    user?.email ??
    "Aluno";
  const greeting = welcomeGreeting(
    (profile?.gender as ProfileGender | null) ?? null,
  );

  const mentor = await loadMentorCalUsername();
  const mentorName = firstNameFromFullName(mentor?.full_name) ?? "mentor";

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
      (n) =>
        n.status === "active" &&
        (n.kind === "practice" || n.kind === "milestone"),
    ) ??
    nodes.find(
      (n) =>
        n.status !== "completed" &&
        (n.kind === "practice" || n.kind === "milestone"),
    );

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
    const hasOnboarding = await studentHasOnboardingSubmission({
      studentId: user!.id,
      email: user?.email,
    });

    const awaitingTodos: StudentTodoItem[] = [
      ...(hasOnboarding
        ? []
        : [
            {
              key: "onboarding",
              title: "Neuma 1:1 — preencher onboarding",
              href: "/onboarding",
              tag: "ONBOARDING",
            } satisfies StudentTodoItem,
          ]),
      {
        key: "session",
        title: "Check-in & Feedback",
        href: "/session",
        tag: "MENTOR",
      },
      {
        key: "tools",
        title: "Explorar recursos",
        href: "/tools",
        tag: "RECURSOS",
      },
    ];

    return (
      <>
        <Suspense fallback={null}>
          <FirstVisitWelcome />
        </Suspense>
        <div className={HOME_VIEWPORT}>
          <div className="neuma-enter-up shrink-0 space-y-1">
            <h1 className="font-heading text-[1.75rem] leading-tight tracking-tight sm:text-3xl">
              <span className="font-normal">{greeting}, </span>
              <span className="font-bold">{studentName}</span>
            </h1>
          </div>

          <div className="neuma-enter-up neuma-enter-delay-1 min-w-0">
            <StudentTodoList items={awaitingTodos} />
          </div>
        </div>
      </>
    );
  }

  const todos: StudentTodoItem[] = [];

  if (activeContent) {
    const week = weekNumberLabel(activeContent.week_number);
    todos.push({
      key: `content:${activeContent.id}`,
      title: `Ver conteúdo da semana ${week}`,
      href: `/path/${activeContent.id}`,
      tag: todoTagLabel(`content:${activeContent.id}`),
    });
  }

  if (activeCall) {
    const week = weekNumberLabel(activeCall.week_number);
    todos.push({
      key: `call:${activeCall.id}`,
      title: `Agendar call da semana ${week}`,
      href: `/path/${activeCall.id}`,
      tag: todoTagLabel(`call:${activeCall.id}`),
    });
  }

  if (activeCheckin) {
    const week = weekNumberLabel(activeCheckin.week_number);
    todos.push({
      key: `checkin:${activeCheckin.id}`,
      title: `Fazer check-in da semana ${week}`,
      href: `/path/${activeCheckin.id}`,
      tag: todoTagLabel(`checkin:${activeCheckin.id}`),
    });
  }

  const feedbackItem = normalizedCheckIns.find((c) =>
    Boolean(c.feedback?.notes),
  );
  if (feedbackItem) {
    const week = weekNumberLabel(feedbackItem.node?.week_number);
    todos.push({
      key: `feedback:${feedbackItem.id}`,
      title: `Ver feedback do ${mentorName} da semana ${week}`,
      href: `/checkins/${feedbackItem.id}`,
      tag: todoTagLabel(`feedback:${feedbackItem.id}`),
    });
  }

  const fallbackTodos: StudentTodoItem[] = [
    {
      key: "session",
      title: "Agendar chamada",
      href: "/session#agendar",
      tag: todoTagLabel("session"),
    },
    {
      key: "path",
      title: "Abrir percurso",
      href: "/path",
      tag: todoTagLabel("path"),
    },
  ];

  const finalTodos = todos.length > 0 ? todos.slice(0, 6) : fallbackTodos;

  return (
    <>
      <Suspense fallback={null}>
        <FirstVisitWelcome />
      </Suspense>
      <div className={HOME_VIEWPORT}>
      <div className="neuma-enter-up shrink-0 space-y-1">
        <h1 className="font-heading text-[1.75rem] leading-tight tracking-tight sm:text-3xl">
          <span className="font-normal">{greeting}, </span>
          <span className="font-bold">{studentName}</span>
        </h1>
      </div>

      <div className="neuma-enter-up neuma-enter-delay-1 min-w-0">
        <StudentTodoList items={finalTodos} />
      </div>

      <Link
        href={activeNode ? `/path/${activeNode.id}` : "/path"}
        prefetch
        className="neuma-enter-up neuma-enter-delay-2 relative z-[1] block min-w-0 shrink-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50"
      >
        <div className="student-path-step student-path-step--active !p-4 sm:!p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
                  {activeNode ? (
                    kindIconEl(activeNode.kind)
                  ) : (
                    <Video className="size-3" />
                  )}
                  {activeNode ? nodeKindLabel[activeNode.kind] : "Aula"}
                  {activeNode?.week_number
                    ? ` · Sem. ${activeNode.week_number}`
                    : null}
                </span>
              </div>

              <p className="font-heading truncate text-lg font-bold tracking-tight sm:text-xl">
                {activeNode?.title ?? path.title}
              </p>

              {activeNode?.due_date ? (
                <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  Até {formatDate(activeNode.due_date)}
                </p>
              ) : null}
            </div>

            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/10 text-xs font-medium text-white sm:size-auto sm:px-3 sm:py-1.5">
              <Play className="size-3.5 fill-current" />
              <span className="hidden sm:inline">Entrar</span>
            </span>
          </div>
        </div>
      </Link>
    </div>
    </>
  );
}
