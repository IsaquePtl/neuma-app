"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";

import type { CalendarEvent } from "@/lib/calendar/events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScreenLoader } from "@/components/screen-loader";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const KIND_DOT: Record<CalendarEvent["kind"], string> = {
  session: "bg-[var(--neuma-coral)]",
  due: "bg-[var(--neuma-blue)]",
  path_start: "bg-emerald-400",
  path_end: "bg-amber-400",
  reminder: "bg-violet-400",
  meeting: "bg-sky-400",
  event: "bg-rose-400",
  misc: "bg-zinc-400",
};

const KIND_LABEL: Record<CalendarEvent["kind"], string> = {
  session: "Sessão",
  due: "Prazo",
  path_start: "Início",
  path_end: "Fim",
  reminder: "Lembrete",
  meeting: "Reunião",
  event: "Evento",
  misc: "Diversos",
};

function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  // Monday-first
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];

  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, monthIndex, 1 - (startPad - i));
    cells.push({ date: d, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, monthIndex, day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    cells.push({ date: d, inMonth: false });
  }
  return cells;
}

function eventTarget(e: CalendarEvent) {
  if (e.meetUrl) return { href: e.meetUrl, external: true as const };
  if (e.href) return { href: e.href, external: false as const };
  return null;
}

export function MentorCalendar({
  initialYear,
  initialMonth,
  events,
}: {
  initialYear: number;
  initialMonth: number;
  events: CalendarEvent[];
}) {
  const [cursor, setCursor] = useState(
    () => new Date(initialYear, initialMonth, 1),
  );
  const todayKey = dateKey(new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();
  const [navPending, startTransition] = useTransition();

  useEffect(() => {
    setCursor(new Date(initialYear, initialMonth, 1));
  }, [initialYear, initialMonth]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();

  function goMonth(delta: number) {
    const next = new Date(year, monthIndex + delta, 1);
    setCursor(next);
    setSelected(null);
    startTransition(() => {
      router.push(
        `/studio/calendar?y=${next.getFullYear()}&m=${next.getMonth() + 1}`,
      );
    });
  }

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(
    () => buildCells(year, monthIndex),
    [year, monthIndex],
  );

  const dayEvents = selected ? (byDate.get(selected) ?? []) : [];
  const monthLabel = cursor.toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });
  const selectedLabel = selected
    ? new Date(selected + "T12:00:00").toLocaleDateString("pt-PT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;
  const isToday = selected === todayKey;

  return (
    <div className="flex w-full flex-col gap-2">
      {navPending ? (
        <ScreenLoader className="min-h-[16rem]" />
      ) : (
        <>
      <Card className="w-full space-y-2 p-2.5 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Mês anterior"
            onClick={() => goMonth(-1)}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <h2 className="text-base font-semibold capitalize sm:text-lg">
            {monthLabel}
          </h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Mês seguinte"
            onClick={() => goMonth(1)}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-0.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map(({ date, inMonth }) => {
            const key = dateKey(date);
            const list = byDate.get(key) ?? [];
            const isSelected = key === selected;
            const cellIsToday = key === todayKey;
            return (
              <button
                key={key + String(inMonth)}
                type="button"
                onClick={() =>
                  setSelected((prev) => (prev === key ? null : key))
                }
                className={cn(
                  "flex min-h-[2.5rem] flex-col items-center rounded-lg px-0.5 py-1 text-sm transition-colors sm:min-h-[2.85rem]",
                  inMonth ? "text-foreground" : "text-muted-foreground/40",
                  isSelected
                    ? "bg-white/10 ring-1 ring-white/20"
                    : "hover:bg-white/5",
                  cellIsToday &&
                    !isSelected &&
                    "ring-1 ring-[var(--neuma-coral)]/40",
                )}
              >
                <span className="grid size-6 place-items-center text-xs tabular-nums">
                  {date.getDate()}
                </span>
                {list.length > 0 ? (
                  <span className="mt-0.5 flex max-w-full flex-wrap justify-center gap-0.5">
                    {list.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={cn("size-1.5 rounded-full", KIND_DOT[e.kind])}
                      />
                    ))}
                    {list.length > 3 ? (
                      <span className="text-[9px] text-muted-foreground">
                        +{list.length - 3}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-xs text-muted-foreground">
          {(
            [
              ["session", "Sessão Cal"],
              ["due", "Prazo de bloco"],
              ["path_start", "Início percurso"],
              ["path_end", "Fim percurso"],
              ["reminder", "Lembrete"],
              ["meeting", "Reunião"],
              ["event", "Evento"],
              ["misc", "Diversos"],
            ] as const
          ).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", KIND_DOT[k])} />
              {label}
            </span>
          ))}
        </div>
      </Card>

      {selected && selectedLabel ? (
        <Card className="flex w-full flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
          <div className="min-w-0 shrink-0 sm:border-r sm:border-white/10 sm:pr-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {isToday ? "Hoje" : "Dia"}
            </p>
            <p className="truncate text-sm font-semibold capitalize leading-tight">
              {selectedLabel}
            </p>
          </div>

          {dayEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground sm:text-sm">
              Sem eventos neste dia.
            </p>
          ) : (
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
              {dayEvents.map((e) => {
                const target = eventTarget(e);
                const label = [KIND_LABEL[e.kind], e.meta, e.studentName]
                  .filter(Boolean)
                  .join(" · ");
                const className = cn(
                  "inline-flex max-w-[16rem] shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition-colors",
                  target
                    ? "hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                    : "cursor-default opacity-80",
                );
                const inner = (
                  <>
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        KIND_DOT[e.kind],
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">
                        {e.title}
                      </span>
                      {label ? (
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {label}
                        </span>
                      ) : null}
                    </span>
                    {e.meetUrl ? (
                      <Video className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                  </>
                );

                if (!target) {
                  return (
                    <span key={e.id} className={className}>
                      {inner}
                    </span>
                  );
                }

                if (target.external) {
                  return (
                    <a
                      key={e.id}
                      href={target.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={className}
                    >
                      {inner}
                    </a>
                  );
                }

                return (
                  <Link key={e.id} href={target.href} className={className}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}
        </>
      )}
    </div>
  );
}
