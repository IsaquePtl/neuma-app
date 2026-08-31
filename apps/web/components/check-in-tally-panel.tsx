"use client";

import { CheckInForm } from "@/components/check-in-form";
import {
  ORPHAN_CHECKIN_DESCRIPTION,
  ORPHAN_CHECKIN_HEADING,
  ORPHAN_CHECKIN_LABEL,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Mobile/tablet: bloco mais perto do centro (como Geral).
 * Desktop: fluxo no topo.
 */
const CHECKIN_VIEWPORT =
  "neuma-mobile-viewport relative flex w-full flex-col justify-center gap-5 overflow-y-auto pb-8 " +
  "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4";

export function CheckInTallyPanel({
  nodeId,
  nodeTitle,
  pathTitle,
  levelNumber,
  blockedMessage,
}: {
  formId?: string;
  nodeId?: string | null;
  nodeTitle?: string | null;
  /** Nome do percurso (discreto, abaixo do título do nível). */
  pathTitle?: string | null;
  /** Número do nível no percurso (1-based), como no mapa. */
  levelNumber?: number | null;
  studentId?: string;
  /** When set, hide the form and show this PT message instead. */
  blockedMessage?: string | null;
}) {
  const hasLevel = Boolean(nodeId) && levelNumber != null;
  const isOrphan =
    !nodeId ||
    !nodeTitle?.trim() ||
    nodeTitle.trim() === ORPHAN_CHECKIN_LABEL;
  const title = isOrphan
    ? ORPHAN_CHECKIN_HEADING
    : nodeTitle?.trim() || ORPHAN_CHECKIN_HEADING;
  const blocked = Boolean(blockedMessage?.trim());

  return (
    <div className={CHECKIN_VIEWPORT}>
      <div className="flex w-full flex-col gap-5">
        <header className="shrink-0 space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Check-in
          </p>
          <div className="flex items-start gap-3.5">
            {hasLevel ? (
              <span
                className={cn(
                  "student-path-marker relative grid size-14 shrink-0 place-items-center rounded-full",
                  "neuma-gradient text-base font-semibold tabular-nums text-white",
                  "shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]",
                )}
                aria-hidden
              >
                {levelNumber}
              </span>
            ) : null}
            <div className="min-w-0 space-y-0.5">
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                {title}
              </h1>
              {!isOrphan && pathTitle?.trim() ? (
                <p className="text-sm leading-tight text-muted-foreground/80">
                  {pathTitle.trim()}
                </p>
              ) : null}
              {isOrphan ? (
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  {ORPHAN_CHECKIN_DESCRIPTION}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {blocked ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {blockedMessage}
          </p>
        ) : (
          <CheckInForm nodeId={nodeId} />
        )}
      </div>
    </div>
  );
}
