"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";

import type { CalendarEvent } from "@/lib/calendar/events";
import { CalendarItemEditor } from "@/components/calendar-item-editor";
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

function startOfWeek(anchor: Date) {
  const d = new Date(anchor);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d;
}

function buildMonthCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
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

function buildWeekCells(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return { date, inMonth: true };
  });
}

const URGENCY: Record<CalendarEvent["kind"], number> = {
  session: 0,
  due: 1,
  meeting: 2,
  event: 3,
  reminder: 4,
  path_start: 5,
  path_end: 6,
  misc: 7,
};

function compareEvents(a: CalendarEvent, b: CalendarEvent) {
  const rank = URGENCY[a.kind] - URGENCY[b.kind];
  if (rank !== 0) return rank;
  const aIso = a.startsAtIso ?? "";
  const bIso = b.startsAtIso ?? "";
  if (aIso !== bIso) return aIso.localeCompare(bIso);
  return a.title.localeCompare(b.title, "pt");
}

function itemKindLabel(event: CalendarEvent) {
  if (event.kind === "due") {
    if (event.passRule === "quiz") return "Quiz";
    if (event.passRule === "check_in") return "Check-in";
    return "Prazo";
  }
  return KIND_LABEL[event.kind];
}

function whoName(event: CalendarEvent) {
  const name = event.studentName?.trim();
  if (name) return name.split(/\s+/)[0] || name;
  return event.title;
}

function chipText(event: CalendarEvent) {
  const kind = itemKindLabel(event);
  const who = whoName(event);
  const time = event.kind === "session" ? event.meta : null;
  return time ? `${kind} · ${who} ${time}` : `${kind} · ${who}`;
}

export function MentorCalendar({
  initialYear,
  initialMonth,
  events,
  students = [],
  view = "month",
}: {
  initialYear: number;
  initialMonth: number;
  events: CalendarEvent[];
  students?: { id: string; label: string }[];
  view?: "month" | "week";
}) {
  const searchParams = useSearchParams();
  const [cursor, setCursor] = useState(() => {
    if (view === "week") {
      return startOfWeek(new Date(initialYear, initialMonth, new Date().getDate()));
    }
    return new Date(initialYear, initialMonth, 1);
  });
  const todayKey = dateKey(new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();
  const [navPending, startTransition] = useTransition();
  const [viewPending, startViewTransition] = useTransition();

  useEffect(() => {
    if (view === "week") {
      const today = new Date();
      const sameMonth =
        today.getFullYear() === initialYear &&
        today.getMonth() === initialMonth;
      setCursor(
        startOfWeek(
          sameMonth ? today : new Date(initialYear, initialMonth, 1),
        ),
      );
    } else {
      setCursor(new Date(initialYear, initialMonth, 1));
    }
  }, [initialYear, initialMonth, view]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const weekStart = view === "week" ? startOfWeek(cursor) : null;

  function calendarHref(next: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("y", String(next.getFullYear()));
    params.set("m", String(next.getMonth() + 1));
    if (view === "week") params.set("view", "week");
    else params.delete("view");
    return `/studio/calendar?${params.toString()}`;
  }

  function pushView(nextView: "month" | "week") {
    if (nextView === view) return;
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "week") params.set("view", "week");
    else params.delete("view");
    const qs = params.toString();
    startViewTransition(() => {
      router.push(qs ? `/studio/calendar?${qs}` : "/studio/calendar");
    });
  }

  function go(delta: number) {
    if (view === "week") {
      const base = weekStart ?? startOfWeek(cursor);
      const next = new Date(base);
      next.setDate(base.getDate() + delta * 7);
      setCursor(next);
      setSelected(null);
      setEditingId(null);
      startTransition(() => {
        router.push(calendarHref(next));
      });
      return;
    }
    const next = new Date(year, monthIndex + delta, 1);
    setCursor(next);
    setSelected(null);
    setEditingId(null);
    startTransition(() => {
      router.push(calendarHref(next));
    });
  }

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      list.sort(compareEvents);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    if (view === "week" && weekStart) return buildWeekCells(weekStart);
    return buildMonthCells(year, monthIndex);
  }, [view, weekStart, year, monthIndex]);

  const dayEvents = selected ? (byDate.get(selected) ?? []) : [];
  const headerLabel =
    view === "week" && weekStart
      ? (() => {
          const end = new Date(weekStart);
          end.setDate(weekStart.getDate() + 6);
          const sameMonth = weekStart.getMonth() === end.getMonth();
          const startLabel = weekStart.toLocaleDateString("pt-PT", {
            day: "numeric",
            month: sameMonth ? undefined : "short",
          });
          const endLabel = end.toLocaleDateString("pt-PT", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return `${startLabel} – ${endLabel}`;
        })()
      : cursor.toLocaleDateString("pt-PT", {
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
  const editing =
    editingId != null
      ? (events.find((event) => event.id === editingId) ?? null)
      : null;
  const stackLimit = view === "week" ? 4 : 2;

  function toggleDay(key: string) {
    setEditingId(null);
    setSelected((prev) => (prev === key ? null : key));
  }

  function revealDay(key: string) {
    if (selected !== key) setEditingId(null);
    setSelected(key);
  }

  function openItem(event: CalendarEvent) {
    setSelected(event.date);
    setEditingId(event.id);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {navPending ? (
        <ScreenLoader className="min-h-[16rem]" />
      ) : (
        <>
          <Card className="w-full space-y-2 p-2.5 sm:p-3">
            <div className="flex flex-nowrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  aria-label={view === "week" ? "Semana anterior" : "Mês anterior"}
                  onClick={() => go(-1)}
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <h2 className="min-w-0 truncate text-left text-base font-semibold capitalize sm:text-lg">
                  {headerLabel}
                </h2>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  aria-label={view === "week" ? "Semana seguinte" : "Mês seguinte"}
                  onClick={() => go(1)}
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>
              <div
                role="group"
                aria-label="Vista"
                className={cn(
                  "inline-flex h-9 shrink-0 rounded-lg border border-white/10 bg-black/20 p-0.5",
                  viewPending && "opacity-70",
                )}
              >
                {(
                  [
                    ["month", "Mês"],
                    ["week", "Semana"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => pushView(value)}
                    aria-pressed={view === value}
                    className={cn(
                      "rounded-md px-3 text-sm font-medium transition-colors",
                      view === value
                        ? "bg-white/10 text-[#ffffe9]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-0.5">
                  {d}
                </div>
              ))}
            </div>

            <div
              className={cn(
                "grid grid-cols-7 gap-0.5",
                view === "week" && "min-h-[7rem]",
              )}
            >
              {cells.map(({ date, inMonth }) => {
                const key = dateKey(date);
                const list = byDate.get(key) ?? [];
                const shown = list.slice(0, stackLimit);
                const hidden = list.length - shown.length;
                const isSelected = key === selected;
                const cellIsToday = key === todayKey;
                const dayLabel = date.toLocaleDateString("pt-PT", {
                  day: "numeric",
                  month: "long",
                });
                return (
                  <div
                    key={key + String(inMonth)}
                    className={cn(
                      "flex min-w-0 flex-col rounded-lg px-0.5 py-1 text-sm transition-colors",
                      view === "week" ? "min-h-[7.5rem] gap-0.5" : "min-h-[4.6rem]",
                      inMonth ? "text-foreground" : "text-muted-foreground/40",
                      isSelected
                        ? "bg-white/10 ring-1 ring-white/20"
                        : "hover:bg-white/5",
                      cellIsToday &&
                        !isSelected &&
                        "ring-1 ring-[var(--neuma-coral)]/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDay(key)}
                      aria-pressed={isSelected}
                      aria-label={
                        list.length
                          ? `${dayLabel}, ${list.length} itens`
                          : dayLabel
                      }
                      className={cn(
                        "grid place-items-center self-center text-xs tabular-nums",
                        list.length === 0 ? "min-h-10 w-full" : "size-6",
                      )}
                    >
                      {date.getDate()}
                    </button>
                    {shown.length > 0 ? (
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {shown.map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            title={`${chipText(event)} — ${event.title}`}
                            onClick={() => openItem(event)}
                            className={cn(
                              "flex min-w-0 items-center gap-1 rounded-md px-0.5 py-0.5 text-left leading-tight hover:bg-white/10",
                              view === "week" ? "text-[11px]" : "text-[10px]",
                              editingId === event.id && "bg-white/10",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                KIND_DOT[event.kind],
                              )}
                            />
                            <span className="min-w-0 truncate">
                              {chipText(event)}
                            </span>
                          </button>
                        ))}
                        {hidden > 0 ? (
                          <button
                            type="button"
                            onClick={() => revealDay(key)}
                            className="px-0.5 text-left text-[10px] text-muted-foreground hover:text-foreground"
                            aria-label={`Ver mais ${hidden} neste dia`}
                          >
                            +{hidden}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
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
            <Card className="flex w-full flex-col gap-3 px-3 py-3 sm:px-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {isToday ? "Hoje" : "Dia"}
                  </p>
                  <p className="truncate text-sm font-semibold capitalize leading-tight">
                    {selectedLabel}
                  </p>
                </div>
                {dayEvents.length > 0 ? (
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {dayEvents.length === 1
                      ? "1 item"
                      : `${dayEvents.length} itens`}
                  </p>
                ) : null}
              </div>

              {editing ? (
                <CalendarItemEditor
                  key={editing.id}
                  event={editing}
                  students={students}
                  onClose={() => setEditingId(null)}
                />
              ) : null}

              {dayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem eventos neste dia.
                </p>
              ) : (
                <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                  {dayEvents.map((event) => {
                    const detail = [event.title, event.meta, event.studentName]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => openItem(event)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition-colors hover:bg-white/10",
                            editingId === event.id && "bg-white/10 ring-1 ring-white/15",
                          )}
                        >
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              KIND_DOT[event.kind],
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {itemKindLabel(event)} · {whoName(event)}
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {detail}
                            </span>
                          </span>
                          {event.meetUrl ? (
                            <Video className="size-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
