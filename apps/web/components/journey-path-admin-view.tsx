import { IntentLink } from "@/components/intent-link";
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
import { inferCategoryTheme } from "@/lib/brand-themes";
import type { JourneyCheckIn } from "@/components/journey-path-composer";
import { PathStatusMenu } from "@/components/path-status-menu";
import { UserAvatar } from "@/components/user-avatar";
import type { JourneyPathStudent } from "@/lib/journey-path/load-journey-path";
import { mentorLevelReviewHref } from "@/lib/journey-path/level-review-url";
import { studentProfileHref } from "@/lib/journey-path/routes";
import { formatDate, nodeKindLabel } from "@/lib/labels";
import {
  calendarStart,
  findUpcomingLevel,
  formatWeekdayDatePt,
} from "@/lib/nodes/level-open";
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

/** Soft accent for kinds that should stand out at a glance. */
function kindAccent(
  kind: NodeKind,
): "practice" | "milestone" | "call" | null {
  if (kind === "practice") return "practice";
  if (kind === "milestone") return "milestone";
  if (kind === "call") return "call";
  return null;
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
  const upcoming = findUpcomingLevel(
    nodes,
    calendarStart(path.start_date, path.created_at),
  );
  const completed = nodes.filter((n) => n.status === "completed").length;
  const total = nodes.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const pathTheme = inferCategoryTheme({ name: path.title });
  const pendingByNode = new Map<string, number>();
  for (const c of checkIns) {
    if (c.status === "pending") {
      pendingByNode.set(c.node_id, (pendingByNode.get(c.node_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {pathTheme ? (
              <CategoryThemeIcon theme={pathTheme} size={22} />
            ) : (
              <Route className="size-3.5" />
            )}
            Percurso
          </p>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <h1 className="w-full min-w-0 truncate text-2xl font-bold tracking-tight sm:w-auto sm:flex-1 sm:overflow-visible sm:whitespace-normal sm:text-3xl">
              {path.title}
            </h1>
            <div className="flex shrink-0 items-center gap-1.5">
              {student ? (
                <IntentLink
                  href={studentProfileHref(
                    student.id,
                    `/studio/journeys/${pathId}`,
                  )}
                  aria-label={`Ver ficha de ${displayName}`}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
                >
                  <UserAvatar
                    name={student.full_name}
                    email={student.email}
                    avatarUrl={student.avatar_url}
                    size="sm"
                    rounded="xl"
                    className="size-6 text-[9px] sm:size-8 sm:text-[10px]"
                  />
                  <span className="max-w-[5.5rem] truncate font-medium sm:max-w-[9rem]">
                    {displayName}
                  </span>
                </IntentLink>
              ) : null}
              <PathStatusMenu
                pathId={pathId}
                studentId={student?.id ?? ""}
                status={path.status}
                className="h-10 w-fit min-w-0 gap-1.5 px-3"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {displayName}
            {path.start_date ? ` · início ${formatDate(path.start_date)}` : ""}
          </p>
        </div>
        {path.goal ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Target className="mt-0.5 size-4 shrink-0" />
            {path.goal}
          </p>
        ) : null}
        <div className="flex w-full items-center gap-3">
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
        <IntentLink
          href={`/studio/journeys/${pathId}/edit`}
          prefetch={null}
          prefetchOnIntent={false}
          aria-label="Editar percurso"
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm transition-colors hover:bg-white/10"
        >
          <Pencil className="size-3.5" />
          Editar
        </IntentLink>
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda sem níveis neste percurso.{" "}
          <IntentLink
            href={`/studio/journeys/${pathId}/edit`}
            className="text-[var(--neuma-coral)] underline-offset-4 hover:underline"
          >
            Adicionar níveis
          </IntentLink>
        </p>
      ) : (
        <ol className="student-path-journey relative w-full list-none pl-0">
          {nodes.map((node, i) => {
            const isUpcoming = upcoming?.index === i;
            const isActive =
              !isUpcoming &&
              (node.status === "active" ||
                (!upcoming &&
                  activeIndex < 0 &&
                  i === 0 &&
                  node.status !== "locked"));
            const isPast =
              !isUpcoming &&
              (node.status === "completed" ||
                (activeIndex >= 0 && i < activeIndex));
            const isFuture =
              !isActive &&
              !isPast &&
              !isUpcoming &&
              (activeIndex < 0
                ? node.status === "locked"
                : i > activeIndex);
            const isLast = i === nodes.length - 1;
            const Icon = kindIcon(node.kind);
            const accent = kindAccent(node.kind);
            const levelNum = i + 1;
            const pendingCount = pendingByNode.get(node.id) ?? 0;
            const levelHref = mentorLevelReviewHref(pathId, node.id);

            const step = (
              <div
                className={cn(
                  "student-path-step relative min-w-0 flex-1",
                  isActive && "student-path-step--active",
                  isUpcoming && "student-path-step--upcoming",
                  isPast && !isActive && "student-path-step--done",
                  isFuture && "student-path-step--locked",
                )}
              >
                {!isFuture &&
                (accent === "practice" || accent === "milestone") ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 w-[3px]",
                      accent === "practice"
                        ? "bg-[color-mix(in_srgb,var(--neuma-lime)_42%,var(--neuma-cream))]"
                        : "bg-[color-mix(in_srgb,var(--neuma-coral)_40%,var(--neuma-cream))]",
                    )}
                  />
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em]",
                        isFuture || !accent
                          ? isActive || isUpcoming
                            ? "text-[#ffffe9]"
                            : "text-muted-foreground"
                          : accent === "practice"
                            ? "text-[color-mix(in_srgb,var(--neuma-lime)_38%,var(--neuma-cream))]"
                            : "text-[color-mix(in_srgb,var(--neuma-coral)_36%,var(--neuma-cream))]",
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
                          : isUpcoming
                            ? "font-heading font-semibold"
                            : "font-heading font-medium",
                        isFuture && "text-muted-foreground",
                      )}
                    >
                      {node.title}
                    </p>
                    {node.due_date && !isFuture && !isUpcoming ? (
                      <p className="text-xs text-muted-foreground">
                        Até {formatDate(node.due_date)}
                      </p>
                    ) : null}
                    {isUpcoming && upcoming ? (
                      <p className="text-xs font-medium text-[var(--neuma-coral)]">
                        O aluno entra na {formatWeekdayDatePt(upcoming.opensOn)}
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
                      "student-path-rail absolute bottom-0 left-[2rem] w-px -translate-x-1/2",
                      isActive
                        ? "top-[calc(0.125rem+3.5rem)]"
                        : isUpcoming
                          ? "top-[calc(0.125rem+3rem)]"
                          : isPast
                            ? "top-[calc(0.125rem+2.75rem)]"
                            : "top-[calc(0.125rem+2.5rem)]",
                      isPast || isActive ? "bg-white/20" : "bg-white/15",
                    )}
                  />
                ) : null}

                <div className="ml-1 flex w-14 shrink-0 flex-col items-center pt-0.5">
                  <span
                    className={cn(
                      "relative z-10 inline-grid shrink-0 place-items-center rounded-full",
                      isActive
                        ? "size-14"
                        : isUpcoming
                          ? "size-12"
                          : isPast
                            ? "size-11"
                            : "size-10",
                    )}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-[var(--neuma-ink)]"
                    />
                    <span
                      className={cn(
                        "student-path-marker relative grid size-full place-items-center rounded-full transition-transform",
                        isActive &&
                          "neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]",
                        isPast &&
                          !isActive &&
                          "neuma-gradient text-white/90 opacity-45",
                        isUpcoming &&
                          "border-2 border-[color-mix(in_oklch,var(--neuma-coral)_55%,white)] bg-white/[0.06] text-[#ffffe9] shadow-[0_0_24px_-8px_color-mix(in_oklch,var(--neuma-coral)_45%,transparent)]",
                        isFuture &&
                          "border-2 border-white/10 bg-white/[0.03] text-muted-foreground/50",
                      )}
                    >
                      {isFuture ? (
                        <Lock className="size-3.5 opacity-70" />
                      ) : (
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            isActive || isUpcoming ? "text-base" : "text-sm",
                          )}
                        >
                          {levelNum}
                        </span>
                      )}
                    </span>
                  </span>
                </div>

                <IntentLink
                  href={levelHref}
                  className={cn(
                    "min-w-0 flex-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50",
                    isFuture && "hover:opacity-90",
                  )}
                >
                  {step}
                </IntentLink>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
