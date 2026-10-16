"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Route, Search } from "lucide-react";

import { IntentLink } from "@/components/intent-link";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import type {
  PathPanoramaModel,
  PathPanoramaRow,
  PathPanoramaSegment,
} from "@/lib/calendar/path-panorama-model";
import { cn } from "@/lib/utils";

type PathPanoramaSectionProps = {
  model: PathPanoramaModel;
};

const LANE = 58;
const ROWS_PER_PAGE = 10;

type PanoramaSort = "priority" | "recent" | "longest";

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt");
}

function compareStarted(a: PathPanoramaRow, b: PathPanoramaRow, newestFirst: boolean): number {
  if (a.startedOn === b.startedOn) {
    return a.fullName.localeCompare(b.fullName, "pt");
  }
  if (!a.startedOn) return 1;
  if (!b.startedOn) return -1;
  const olderFirst = a.startedOn < b.startedOn ? -1 : 1;
  return newestFirst ? -olderFirst : olderFirst;
}

function rowMatches(row: PathPanoramaRow, query: string): boolean {
  const haystack = [row.fullName, row.pathTitle, row.email ?? ""].map(fold).join(" ");
  return haystack.includes(query);
}

function trackHeight(lanes: number): number {
  return 8 + lanes * LANE;
}

function levelClass(segment: PathPanoramaSegment, activeKey: string | null): string {
  const missing = segment.needsVideo && !segment.videoReady;
  const shared = segment.shareCount >= 2;
  const hot = Boolean(activeKey && segment.shareKey === activeKey);
  const dim = Boolean(activeKey && segment.shareKey !== activeKey);
  return cn(
    "flex h-full w-full min-w-0 flex-col justify-center gap-0.5 overflow-hidden rounded-lg border px-2 py-1 text-left transition-opacity",
    missing
      ? "border-dashed border-foreground/55 bg-transparent text-foreground"
      : segment.tone === "attention"
        ? "border-transparent bg-foreground text-[#161616]"
        : segment.tone === "quiet"
          ? "border-transparent bg-foreground/[0.06] text-foreground/55"
          : "border-transparent bg-foreground/10 text-foreground",
    shared && !missing && "border-l-2 border-l-foreground/70",
    shared && missing && "border-l-2 border-l-foreground",
    hot && "ring-1 ring-foreground",
    dim && "opacity-35",
  );
}

function levelMeta(segment: PathPanoramaSegment): string | null {
  if (segment.mark === "rever") return "rever";
  if (segment.mark === "sessão") return "sessão";
  if (segment.mark === "quiz") return "quiz";
  if (segment.mark === "prazo") return "prazo";
  if (segment.needsVideo) return segment.videoReady ? "ligar" : "gravar";
  return null;
}

export function PathPanoramaSection({ model }: PathPanoramaSectionProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PanoramaSort>("priority");
  const [page, setPage] = useState(0);
  const weekCount = model.weeks.length;
  const columns = `repeat(${weekCount}, minmax(9.5rem, 1fr))`;
  const orderedRows = useMemo(() => {
    const list = [...model.rows];
    if (sort === "recent") list.sort((a, b) => compareStarted(a, b, true));
    else if (sort === "longest") list.sort((a, b) => compareStarted(a, b, false));
    const q = fold(query.trim());
    if (!q) return list;
    return list
      .map((row, index) => ({ row, index, hit: rowMatches(row, q) ? 0 : 1 }))
      .sort((a, b) => a.hit - b.hit || a.index - b.index)
      .map((item) => item.row);
  }, [model.rows, query, sort]);
  const pageCount = Math.max(1, Math.ceil(orderedRows.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = orderedRows.slice(
    currentPage * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE + ROWS_PER_PAGE,
  );

  return (
    <section
      className="space-y-3"
      aria-labelledby="path-panorama-heading"
      onMouseLeave={() => setActiveKey(null)}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="path-panorama-heading"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <Route className="size-5" /> Panorama
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{model.summary}</p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">{model.spanLabel}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Pesquisar aluno"
            aria-label="Pesquisar aluno"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] pr-3 pl-8 text-sm outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40"
          />
        </label>
        <select
          value={sort}
          aria-label="Ordem dos percursos"
          onChange={(event) => {
            setSort(event.target.value as PanoramaSort);
            setPage(0);
          }}
          className="h-9 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-sm outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40"
        >
          <option value="priority">Prioridade</option>
          <option value="recent">Mais recentes</option>
          <option value="longest">Há mais tempo</option>
        </select>
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
              model.rows.length > 10 && "max-h-[40rem] overflow-y-auto",
            )}
          >
            <div style={{ minWidth: `calc(10.5rem + ${weekCount} * 9.5rem)` }}>
              <div className="sticky top-0 z-20 grid grid-cols-[10.5rem_1fr] bg-[#141414]/95 backdrop-blur-md">
                <div className="sticky left-0 z-30 border-r border-white/10 bg-[#141414]" />
                <div className="grid" style={{ gridTemplateColumns: columns }}>
                  {model.weeks.map((week) => (
                    <div
                      key={week.monday}
                      className={cn(
                        "border-l border-white/[0.05] px-2 pt-2.5 pb-2 first:border-l-0",
                        week.due > 0 && "bg-white/[0.04]",
                      )}
                      title={
                        week.due > 0
                          ? week.due === 1
                            ? "1 gravação por ter pronta nesta semana"
                            : `${week.due} gravações por ter prontas nesta semana`
                          : undefined
                      }
                    >
                      <div
                        className={cn(
                          "text-[11px] leading-none tabular-nums",
                          week.current
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {week.label}
                      </div>
                      <div className="mt-1.5 text-[10px] font-medium leading-none tabular-nums text-foreground/75">
                        {week.due > 0 ? week.due : "\u00a0"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <ol className="m-0 list-none p-0">
                {pageRows.map((row) => {
                  const height = trackHeight(row.lanes);
                  const nameTitle =
                    row.fullName === row.pathTitle
                      ? row.fullName
                      : `${row.fullName} · ${row.pathTitle}`;
                  const pinned =
                    fold(query.trim()).length > 0 && rowMatches(row, fold(query.trim()));
                  return (
                    <li
                      key={row.pathId}
                      className="group grid grid-cols-[10.5rem_1fr] border-t border-white/5"
                    >
                      <IntentLink
                        href={row.href}
                        title={nameTitle}
                        aria-label={`Percurso de ${row.fullName}`}
                        className={cn(
                          "sticky left-0 z-10 flex min-w-0 items-center gap-2 border-r border-white/10 px-2.5 backdrop-blur-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-inset",
                          pinned
                            ? "border-l-2 border-l-[var(--neuma-coral)] bg-[#2a1814]/95 group-hover:bg-[#321c18]"
                            : "bg-[#141414]/95 group-hover:bg-[#1c1c1c]",
                        )}
                      >
                        <UserAvatar
                          name={row.fullName}
                          email={row.email}
                          avatarUrl={row.avatarUrl}
                          size="sm"
                          className="size-7 text-[10px]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs text-foreground/90">
                            {row.name}
                          </span>
                          {row.instrument ? (
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {row.instrument}
                            </span>
                          ) : null}
                        </span>
                      </IntentLink>

                      <div className="relative" style={{ height }}>
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 grid"
                          style={{ gridTemplateColumns: columns }}
                        >
                          {model.weeks.map((week) => (
                            <div
                              key={week.monday}
                              className={cn(
                                "border-l border-white/[0.05] first:border-l-0",
                                week.due > 0 && "bg-white/[0.035]",
                              )}
                            />
                          ))}
                        </div>
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-1 z-[1] w-px bg-foreground/25"
                          style={{ left: `${model.today * 100}%` }}
                        />
                        {row.segments.length === 0 ? (
                          <p className="pointer-events-none absolute inset-0 flex items-center px-3 text-[11px] text-muted-foreground">
                            Sem níveis nestas semanas
                          </p>
                        ) : null}
                        {row.segments.map((segment) => {
                          const left = (segment.start / weekCount) * 100;
                          const width = ((segment.end - segment.start) / weekCount) * 100;
                          const meta = levelMeta(segment);
                          const share =
                            segment.shareCount >= 2 ? `×${segment.shareCount}` : null;
                          return (
                            <IntentLink
                              key={segment.id}
                              href={segment.href}
                              title={segment.label}
                              aria-label={segment.label}
                              onMouseEnter={() =>
                                setActiveKey(segment.shareKey)
                              }
                              onFocus={() => setActiveKey(segment.shareKey)}
                              className="absolute z-[2] flex items-center px-1 outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-inset"
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                top: 4 + segment.lane * LANE,
                                height: LANE - 8,
                              }}
                            >
                              <span className={levelClass(segment, activeKey)}>
                                <span className="line-clamp-2 text-[12px] font-medium leading-tight">
                                  {segment.title}
                                </span>
                                {meta || share ? (
                                  <span className="truncate text-[10px] leading-none opacity-75">
                                    {[meta, share].filter(Boolean).join(" · ")}
                                  </span>
                                ) : null}
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

          {pageCount > 1 ? (
            <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-2.5">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
                className="grid size-9 place-items-center rounded-full text-foreground hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground">
                {currentPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Página seguinte"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
                className="grid size-9 place-items-center rounded-full text-foreground hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          ) : null}

          {model.shares.length > 0 ? (
            <div className="border-t border-white/10 px-3 py-3">
              <p className="text-[11px] font-medium tracking-wide text-foreground/80 uppercase">
                Mesma gravação
              </p>
              <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto">
                {model.shares.map((share) => (
                  <li key={share.key}>
                    <IntentLink
                      href={share.href}
                      onMouseEnter={() => setActiveKey(share.levelKey)}
                      onFocus={() => setActiveKey(share.levelKey)}
                      className={cn(
                        "block rounded-xl px-2 py-1.5 outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-white/25",
                        activeKey === share.levelKey && "bg-white/[0.06]",
                      )}
                    >
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[13px] font-medium">{share.title}</span>
                        {share.instrument ? (
                          <span className="text-[11px] text-muted-foreground">
                            {share.instrument}
                          </span>
                        ) : null}
                        <span className="text-[11px] text-foreground/70">
                          {share.hasVideo ? "vídeo já existe" : "por gravar"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {share.members
                          .map((member) =>
                            share.hasVideo && !member.hasVideo
                              ? `${member.name} · ${member.when} · sem vídeo`
                              : `${member.name} · ${member.when}`,
                          )
                          .join(" · ")}
                      </span>
                    </IntentLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {model.showLegend ? (
            <p className="border-t border-white/10 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
              Tracejado: falta o vídeo · ×N: o mesmo nível noutros alunos, mesmo
              noutra semana · Número na coluna: gravações por ter prontas até aí
            </p>
          ) : null}
        </Card>
      )}
    </section>
  );
}
