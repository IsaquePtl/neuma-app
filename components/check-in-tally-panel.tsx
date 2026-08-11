"use client";

import { useEffect, useState } from "react";

import { ScreenLoader } from "@/components/screen-loader";
import { TallyEmbed } from "@/components/tally-embed";
import { ORPHAN_CHECKIN_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Mobile/tablet: bloco mais perto do centro (como Geral).
 * Desktop: fluxo no topo.
 */
const CHECKIN_VIEWPORT =
  "neuma-mobile-viewport relative mx-auto flex max-w-2xl flex-col justify-center gap-5 overflow-y-auto pb-8 " +
  "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4";

export function CheckInTallyPanel({
  formId,
  nodeId,
  nodeTitle,
  levelNumber,
  studentId,
}: {
  formId: string;
  nodeId?: string | null;
  nodeTitle?: string | null;
  /** Número do nível no percurso (1-based), como no mapa. */
  levelNumber?: number | null;
  studentId: string;
}) {
  const [ready, setReady] = useState(false);
  const title = nodeTitle?.trim() || ORPHAN_CHECKIN_LABEL;

  // Fallback se o iframe não disparar onLoad
  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setReady(true), 10000);
    return () => window.clearTimeout(t);
  }, [ready]);

  return (
    <div className={CHECKIN_VIEWPORT}>
      {/* Já na posição final (centrado); só fica invisível até o Tally carregar */}
      <div
        className={cn("flex w-full flex-col gap-5", !ready && "invisible")}
        aria-hidden={!ready}
      >
        <header className="shrink-0 space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Check-in
          </p>
          <div className="flex items-center gap-3.5">
            {levelNumber != null ? (
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
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
          </div>
        </header>

        <TallyEmbed
          formId={formId}
          title={`Check-in · ${title}`}
          height={500}
          params={{
            student_id: studentId,
            node_id: nodeId ?? undefined,
            source: "neuma",
          }}
          onReady={() => setReady(true)}
        />
      </div>

      {!ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <ScreenLoader className="min-h-0" />
        </div>
      ) : null}
    </div>
  );
}
