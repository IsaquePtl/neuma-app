import Link from "next/link";
import { Suspense } from "react";
import {
  CalendarClock,
  Dumbbell,
  Flag,
  Phone,
  Video,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCheckInAllowance } from "@/lib/checkins/allowance";
import {
  feedbackHrefForItem,
  loadStudentUnviewedFeedback,
} from "@/lib/feedbacks/student";
import { loadMentorCalUsername, loadMyPathWithNodes } from "@/lib/students/queries";
import { FirstVisitWelcome } from "@/components/first-visit-welcome";
import { ActiveLevelFeedbackCta } from "@/components/active-level-feedback-cta";
import { PathPausedCard } from "@/components/path-paused-card";
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

  // Only the single active level is visible to students — never locked future nodes.
  const activeNode = nodes.find((n) => n.status === "active") ?? null;

  const activeCall = activeNode?.kind === "call" ? activeNode : null;
  const activeContent =
    activeNode &&
    (activeNode.kind === "lesson" || activeNode.kind === "resource")
      ? activeNode
      : null;
  const activeCheckin =
    activeNode &&
    (activeNode.kind === "practice" || activeNode.kind === "milestone")
      ? activeNode
      : null;

  const unviewedFeedback = path
    ? await loadStudentUnviewedFeedback(supabase, user!.id, nodes)
    : { count: 0, items: [], unviewedByNodeId: new Map<string, number>() };
  const activeNodeUnviewedCount = activeNode
    ? (unviewedFeedback.unviewedByNodeId.get(activeNode.id) ?? 0)
    : 0;

  const isPathPaused = path?.status === "paused";

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
              title: "Onboarding",
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

  if (!isPathPaused) {
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
      const allowance = await getCheckInAllowance(
        supabase,
        activeCheckin.id,
        user!.id,
      );
      if (allowance.allowed) {
        const week = weekNumberLabel(activeCheckin.week_number);
        todos.push({
          key: `checkin:${activeCheckin.id}`,
          title: `Fazer check-in da semana ${week}`,
          href: `/path/${activeCheckin.id}`,
          tag: todoTagLabel(`checkin:${activeCheckin.id}`),
        });
      }
    }
  }

  const feedbackItem = unviewedFeedback.items[0];
  if (feedbackItem) {
    const week = weekNumberLabel(feedbackItem.weekNumber);
    todos.push({
      key: `feedback:${feedbackItem.referenceId}`,
      title: `Ver feedback do ${mentorName} da semana ${week}`,
      href: feedbackHrefForItem(feedbackItem),
      tag: todoTagLabel(`feedback:${feedbackItem.referenceId}`),
    });
  }

  const fallbackTodos: StudentTodoItem[] = [
    {
      key: "session",
      title: "Agendar chamada",
      href: "/session#agendar",
      tag: todoTagLabel("session"),
    },
    ...(isPathPaused
      ? []
      : [
          {
            key: "path",
            title: "Abrir percurso",
            href: "/path",
            tag: todoTagLabel("path"),
          } satisfies StudentTodoItem,
        ]),
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

      {isPathPaused ? (
        <Link
          href="/path"
          prefetch
          className="neuma-enter-up neuma-enter-delay-2 relative z-[1] block min-w-0 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50"
        >
          <PathPausedCard compact />
        </Link>
      ) : (
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
                {activeNodeUnviewedCount > 0 ? (
                  <p className="text-sm font-medium text-[var(--neuma-coral)]">
                    Tens feedback novo do mentor
                  </p>
                ) : null}
              </div>

              <ActiveLevelFeedbackCta
                hasUnviewedFeedback={activeNodeUnviewedCount > 0}
                unviewedCount={activeNodeUnviewedCount}
              />
            </div>
          </div>
        </Link>
      )}
    </div>
    </>
  );
}
