import Link from "next/link";
import {
  Lock,
  Phone,
  Video,
  Dumbbell,
  Flag,
  Play,
  CalendarClock,
} from "lucide-react";

import type { StudentNode } from "@/lib/students/queries";
import { formatDate, nodeKindLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { NodeKind } from "@/lib/types/database.types";

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

export function StudentPathMap({ nodes }: { nodes: StudentNode[] }) {
  const activeIndex = nodes.findIndex((n) => n.status === "active");

  return (
    <ol className="student-path-journey relative mx-auto max-w-lg list-none pl-0">
      {nodes.map((node, i) => {
        const isActive = node.status === "active" || (activeIndex < 0 && i === 0 && node.status !== "locked");
        // Passado = antes do activo (ou completed). Futuro = depois do activo.
        const isPast =
          node.status === "completed" ||
          (activeIndex >= 0 && i < activeIndex);
        const isFuture =
          !isActive &&
          !isPast &&
          (activeIndex < 0 ? node.status === "locked" : i > activeIndex);
        const openable = isActive || isPast;
        const isLast = i === nodes.length - 1;
        const Icon = kindIcon(node.kind);
        const levelNum = i + 1;

        const marker = (
          <span
            className={cn(
              "student-path-marker relative z-10 grid shrink-0 place-items-center rounded-full border-2 transition-transform",
              isActive &&
                "size-14 border-transparent neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]",
              isPast &&
                !isActive &&
                "size-11 border-transparent neuma-gradient text-white/90 opacity-45",
              isFuture &&
                "size-10 border-white/10 bg-white/[0.03] text-muted-foreground/50",
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
        );

        const body = (
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
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em]",
                      isActive
                        ? "text-[var(--neuma-coral)]"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3" />
                    {nodeKindLabel[node.kind]}
                    {node.week_number ? ` · Sem. ${node.week_number}` : null}
                  </span>
                </div>
                <p
                  className={cn(
                    "leading-snug",
                    isActive
                      ? "text-lg font-semibold tracking-tight sm:text-xl"
                      : "font-medium",
                    isFuture && "text-muted-foreground",
                  )}
                >
                  {node.title}
                </p>
                {node.due_date && !isFuture ? (
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3" />
                    Até {formatDate(node.due_date)}
                  </p>
                ) : null}
                {isActive && node.description ? (
                  <p className="line-clamp-2 pt-0.5 text-sm text-muted-foreground">
                    {node.description}
                  </p>
                ) : null}
              </div>
              {isActive ? (
                <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/10 text-xs font-medium text-white sm:size-auto sm:px-3 sm:py-1.5">
                  <Play className="size-3 fill-current" />
                  <span className="hidden sm:inline">Entrar</span>
                </span>
              ) : null}
            </div>
            {isActive ? (
              <p className="mt-3 text-xs font-medium tracking-wide text-[var(--neuma-coral)]">
                Nível actual — toca para abrir
              </p>
            ) : null}
            {isPast && !isActive ? (
              <p className="mt-2 text-xs text-muted-foreground/80">
                {node.status === "completed" ? "Concluído" : "Já disponível"}
              </p>
            ) : null}
            {isFuture ? (
              <p className="mt-2 text-xs text-muted-foreground">Bloqueado</p>
            ) : null}
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

            <div className="flex flex-col items-center pt-0.5">{marker}</div>

            {openable ? (
              <Link
                href={`/path/${node.id}`}
                prefetch
                className="min-w-0 flex-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50"
              >
                {body}
              </Link>
            ) : (
              <div className="min-w-0 flex-1 cursor-not-allowed opacity-90">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
