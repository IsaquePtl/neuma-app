import { Route } from "lucide-react";

import { IntentLink } from "@/components/intent-link";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import {
  PANORAMA_WEEK_COUNT,
  type PathPanoramaModel,
  type PathPanoramaSegment,
} from "@/lib/calendar/path-panorama-model";
import { cn } from "@/lib/utils";

type PathPanoramaSectionProps = {
  model: PathPanoramaModel;
};

function trackHeight(lanes: number): number {
  return Math.max(36, lanes * 18 + 12);
}

function barClass(segment: PathPanoramaSegment): string {
  if (segment.tone === "missing") {
    return cn(
      "flex h-4 w-full items-center justify-center overflow-hidden rounded-full border border-dashed px-1 text-[9px] font-medium leading-none text-foreground/80 transition-colors group-hover/seg:border-foreground group-hover/seg:text-foreground",
      segment.needsMentor
        ? "border-foreground/70 bg-foreground/10"
        : "border-foreground/35",
    );
  }
  if (segment.tone === "attention") {
    return "flex h-4 w-full items-center justify-center overflow-hidden rounded-full bg-foreground/90 px-1 text-[9px] font-medium leading-none text-[#161616] transition-colors group-hover/seg:bg-foreground";
  }
  if (segment.tone === "normal") {
    return "h-1.5 w-full rounded-full bg-foreground/35 transition-colors group-hover/seg:bg-foreground/55";
  }
  return "h-1 w-full rounded-full bg-foreground/15 transition-colors group-hover/seg:bg-foreground/30";
}

export function PathPanoramaSection({ model }: PathPanoramaSectionProps) {
  const hasOverlap = model.weeks.some((week) => week.overlap >= 2);

  return (
    <section className="space-y-3" aria-labelledby="path-panorama-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="path-panorama-heading"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Route className="size-5" /> Panorama
        </h2>
        <p className="text-xs text-muted-foreground">{model.spanLabel}</p>
      </div>

      {model.rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhum percurso para acompanhar nas próximas semanas.
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden p-0 py-0">
          <div
            className={cn(
              "overflow-x-auto overscroll-x-contain",
              model.rows.length > 12 && "max-h-[36rem] overflow-y-auto",
            )}
          >
            <div className="min-w-[36rem]">
              <div className="sticky top-0 z-20 grid grid-cols-[7.75rem_1fr] bg-[#141414]/95 backdrop-blur-md">
                <div className="sticky left-0 z-30 border-r border-white/10 bg-[#141414]" />
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${PANORAMA_WEEK_COUNT}, minmax(0, 1fr))`,
                  }}
                >
                  {model.weeks.map((week) => (
                    <div
                      key={week.monday}
                      className={cn(
                        "border-l border-white/[0.05] px-1 pt-2.5 pb-2 text-center first:border-l-0",
                        week.overlap >= 2 && "bg-white/[0.045]",
                      )}
                      title={
                        week.overlap >= 2
                          ? `${week.overlap} alunos precisam de ti nesta semana`
                          : undefined
                      }
                    >
                      <div
                        className={cn(
                          "text-[10px] leading-none tabular-nums",
                          week.current
                            ? "font-medium text-foreground/85"
                            : "text-muted-foreground",
                        )}
                      >
                        {week.label}
                      </div>
                      {hasOverlap ? (
                        <div className="mt-1 text-[10px] font-medium leading-none tabular-nums text-foreground/80">
                          {week.overlap >= 2 ? week.overlap : "\u00a0"}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <ol className="m-0 list-none p-0">
                {model.rows.map((row) => {
                  const height = trackHeight(row.lanes);
                  const nameTitle =
                    row.fullName === row.pathTitle
                      ? row.fullName
                      : `${row.fullName} · ${row.pathTitle}`;
                  return (
                    <li
                      key={row.pathId}
                      className="group grid grid-cols-[7.75rem_1fr] border-t border-white/5"
                    >
                      <IntentLink
                        href={row.href}
                        title={nameTitle}
                        aria-label={`Percurso de ${row.fullName}`}
                        className="sticky left-0 z-10 flex min-w-0 items-center gap-1.5 border-r border-white/10 bg-[#141414]/95 px-2.5 backdrop-blur-md outline-none transition-colors group-hover:bg-[#1c1c1c] focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-inset"
                      >
                        <UserAvatar
                          name={row.fullName}
                          email={row.email}
                          avatarUrl={row.avatarUrl}
                          size="sm"
                          className="size-6 text-[9px]"
                        />
                        <span className="truncate text-[11px] text-foreground/80">
                          {row.name}
                        </span>
                      </IntentLink>

                      <div className="relative" style={{ height }}>
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 grid"
                          style={{
                            gridTemplateColumns: `repeat(${PANORAMA_WEEK_COUNT}, minmax(0, 1fr))`,
                          }}
                        >
                          {model.weeks.map((week) => (
                            <div
                              key={week.monday}
                              className={cn(
                                "border-l border-white/[0.05] first:border-l-0",
                                week.overlap >= 2 && "bg-white/[0.045]",
                              )}
                            />
                          ))}
                        </div>
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-1 z-[1] w-px bg-foreground/25"
                          style={{ left: `${model.today * 100}%` }}
                        />
                        {row.segments.map((segment) => {
                          const left =
                            (segment.start / PANORAMA_WEEK_COUNT) * 100;
                          const width =
                            ((segment.end - segment.start) /
                              PANORAMA_WEEK_COUNT) *
                            100;
                          const laneStyle =
                            row.lanes === 1
                              ? { top: 0, height: "100%" }
                              : {
                                  top: 6 + segment.lane * 18,
                                  height: 18,
                                };
                          return (
                            <IntentLink
                              key={segment.id}
                              href={segment.href}
                              title={segment.label}
                              aria-label={segment.label}
                              className="group/seg absolute z-[2] flex items-center px-[2px] outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-inset"
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                ...laneStyle,
                              }}
                            >
                              <span className={barClass(segment)}>
                                {segment.mark}
                              </span>
                            </IntentLink>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
          {model.showLegend ? (
            <p className="border-t border-white/10 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
              Tracejado: falta gravar · Cheio: precisa de ti · Número: alunos
              na mesma semana
            </p>
          ) : null}
        </Card>
      )}
    </section>
  );
}
