"use client";

import Link from "next/link";
import {
  Lock,
  Pencil,
  Phone,
  Play,
  Route,
  Target,
  Video,
  Dumbbell,
  Flag,
} from "lucide-react";

import { CategoryThemeIcon } from "@/components/category-theme-icon";
import type { JourneyCheckIn } from "@/components/journey-path-composer";
import { UserAvatar } from "@/components/user-avatar";
import type { JourneyPathStudent } from "@/lib/journey-path/load-journey-path";
import { mentorLevelReviewHref } from "@/lib/journey-path/level-review-url";
import { studentProfileHref } from "@/lib/journey-path/routes";
import { formatDate, nodeKindLabel } from "@/lib/labels";
import type { StudentNode, StudentPath } from "@/lib/students/queries";
import type { NodeKind } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

function kindIcon(kind: NodeKind) {
  switch (kind) {
    case "call":
      return Phone;
    case "lesson":
    case "resource":
      return Video;
    case "milestone":
      return Flag;
    default:
      return Dumbbell;
  }
}

export function JourneyPathAdminView({
  pathId,
  displayName,
  student,
  path,
  nodes,
  checkIns,
}: {
  pathId: string;
  displayName: string;
  student: JourneyPathStudent;
  path: StudentPath;
  nodes: StudentNode[];
  checkIns: JourneyCheckIn[];
  levelFeedbacks?: unknown[];
}) {
  const activeIndex = nodes.findIndex((n) => n.status === "active");
  const completed = nodes.filter((n) => n.status === "completed").length;
  const total = nodes.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const pendingByNode = new Map<string, number>();
  for (const c of checkIns) {
    if (c.status === "pending") {
      pendingByNode.set(c.node_id, (pendingByNode.get(c.node_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <CategoryThemeIcon theme={null} name={path.title} size={18} />
              <Route className="size-3.5" /> Percurso
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {path.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {student ? (
              <Link
                href={studentProfileHref(
                  student.id,
                  `/studio/journeys/${pathId}`,
                )}
                aria-label={`Ver ficha de ${displayName}`}
                className="hidden h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm transition-colors hover:bg-white/10 sm:inline-flex"
              >
                <UserAvatar
                  name={student.full_name}
                  email={student.email}
                  avatarUrl={student.avatar_url}
                  size="sm"
                  rounded="xl"
                />
                <span className="font-medium">{displayName}</span>
              </Link>
            ) : null}
            <Link
              href={`/studio/journeys/${pathId}/edit`}
              aria-label="Editar percurso"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm transition-colors hover:bg-white/10"
            >
              <Pencil className="size-3.5" />
              Editar
            </Link>
          </div>
        </div>
        {path.goal ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Target className="mt-0.5 size-4 shrink-0" />
            {path.goal}
          </p>
        ) : null}
        {student ? (
          <Link
            href={studentProfileHref(student.id, `/studio/journeys/${pathId}`)}
            aria-label={`Ver ficha de ${displayName}`}
            className="inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm transition-colors hover:bg-white/10 sm:hidden"
          >
            <UserAvatar
              name={student.full_name}
              email={student.email}
              avatarUrl={student.avatar_url}
              size="sm"
              rounded="xl"
            />
            <span className="font-medium">{displayName}</span>
          </Link>
        ) : null}
        <div className="flex w-full items-center gap-3 pt-1">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[var(--neuma-coral)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda sem níveis neste percurso.{" "}
          <Link
            href={`/studio/journeys/${pathId}/edit`}
            className="text-[var(--neuma-coral)] underline-offset-4 hover:underline"
          >
            Adicionar níveis
          </Link>
        </p>
      ) : (
        <ol className="student-path-journey relative w-full list-none pl-0">
          {nodes.map((node, i) => {
            const isActive =
              node.status === "active" ||
              (activeIndex < 0 && i === 0 && node.status !== "locked");
            const isPast =
              node.status === "completed" ||
              (activeIndex >= 0 && i < activeIndex);
            const isFuture =
              !isActive &&
              !isPast &&
              (activeIndex < 0
                ? node.status === "locked"
                : i > activeIndex);
            const isLast = i === nodes.length - 1;
            const Icon = kindIcon(node.kind);
            const levelNum = i + 1;
            const pendingCount = pendingByNode.get(node.id) ?? 0;
            const levelHref = mentorLevelReviewHref(pathId, node.id);

            const step = (
              <div
                className={cn(
                  "student-path-step min-w-0 flex-1",
                  isActive && "student-path-step--active",
                  isPast && !isActive && "student-path-step--done",
                  isFuture && "student-path-step--locked",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em]",
                        isActive
                          ? "text-[#ffffe9]"
                          : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3" />
                      {nodeKindLabel[node.kind]}
                      {node.week_number ? ` · Sem. ${node.week_number}` : null}
                    </span>
                    <p
                      className={cn(
                        "leading-snug",
                        isActive
                          ? "font-heading text-lg font-bold tracking-tight sm:text-xl"
                          : "font-heading font-medium",
                        isFuture && "text-muted-foreground",
                      )}
                    >
                      {node.title}
                    </p>
                    {node.due_date && !isFuture ? (
                      <p className="text-xs text-muted-foreground">
                        Até {formatDate(node.due_date)}
                      </p>
                    ) : null}
                    {isActive && node.description ? (
                      <p className="line-clamp-2 pt-0.5 text-sm text-muted-foreground">
                        {node.description}
                      </p>
                    ) : null}
                    {pendingCount > 0 ? (
                      <p className="pt-0.5 text-xs text-[var(--neuma-coral)]/85">
                        {pendingCount}{" "}
                        {pendingCount === 1
                          ? "check-in por rever"
                          : "check-ins por rever"}
                      </p>
                    ) : null}
                  </div>
                  {isActive ? (
                    <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white sm:size-auto sm:px-3 sm:py-1.5">
                      <Play className="size-3 fill-current" />
                    </span>
                  ) : null}
                </div>
              </div>
            );

            return (
              <li
                key={node.id}
                className={cn(
                  "relative flex gap-4 sm:gap-5",
                  isActive ? "pb-10" : "pb-8",
                  isLast && "pb-2",
                )}
              >
                {!isLast ? (
                  <span
                    aria-hidden
                    className={cn(
                      "student-path-rail absolute bottom-0 w-px",
                      isPast || isActive ? "bg-white/15" : "bg-white/10",
                    )}
                    style={{
                      top: isActive ? "3.5rem" : "2.75rem",
                      left: isActive ? "1.7rem" : "1.35rem",
                    }}
                  />
                ) : null}

                <div className="flex flex-col items-center pt-0.5">
                  <span
                    className={cn(
                      "student-path-marker relative z-10 grid shrink-0 place-items-center rounded-full transition-transform",
                      isActive &&
                        "size-14 neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]",
                      isPast &&
                        !isActive &&
                        "size-11 neuma-gradient text-white/90 opacity-45",
                      isFuture &&
                        "size-10 border-2 border-white/10 bg-white/[0.03] text-muted-foreground/50",
                    )}
                  >
                    {isFuture ? (
                      <Lock className="size-3.5 opacity-70" />
                    ) : (
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          isActive ? "text-base" : "text-sm",
                        )}
                      >
                        {levelNum}
                      </span>
                    )}
                  </span>
                </div>

                {isFuture ? (
                  step
                ) : (
                  <Link
                    href={levelHref}
                    prefetch
                    className="min-w-0 flex-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50"
                  >
                    {step}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
