"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, Layers, Plus, Trash2 } from "lucide-react";

import { DatePicker } from "@/components/ui/date-picker";
import { WeekStepper } from "@/components/week-stepper";
import { phaseKeyLabel } from "@/lib/labels";
import {
  nextPhaseKey,
  normalizePhaseKey,
  type PhaseRange,
} from "@/lib/nodes/phases";
import type { NodeStatus } from "@/lib/types/database.types";
import { formatShortDatePt } from "@/lib/path-period";
import { cn } from "@/lib/utils";

export type CalendarLevel = {
  id: string;
  title: string;
  /** 1-based level number. */
  number: number;
  weeks: number;
  extendedWeeks: number;
  status: NodeStatus;
  phaseKey: string | null;
  isPhaseCheckpoint: boolean;
};

const PHASE_TONES = [
  "var(--neuma-blue)",
  "var(--neuma-lime)",
  "var(--neuma-coral)",
  "var(--neuma-orange)",
  "#a78bfa",
  "#22d3ee",
];

function phaseTone(index: number) {
  return `color-mix(in oklch, ${PHASE_TONES[index % PHASE_TONES.length]} 70%, white)`;
}

function rangeLabel(from: number, to: number) {
  return from === to ? `nível ${from + 1}` : `níveis ${from + 1}–${to + 1}`;
}

/** Runs of levels outside any phase, for the "sem fase" hint and new phases. */
function unassignedRuns(ranges: PhaseRange[], count: number) {
  const taken = new Array<boolean>(count).fill(false);
  for (const r of ranges) for (let i = r.from; i <= r.to; i += 1) taken[i] = true;
  const runs: Array<{ from: number; to: number }> = [];
  taken.forEach((isTaken, i) => {
    if (isTaken) return;
    const last = runs[runs.length - 1];
    if (last && last.to === i - 1) last.to = i;
    else runs.push({ from: i, to: i });
  });
  return runs;
}

function PhaseEditor({
  levels,
  ranges,
  onChange,
  disabled,
}: {
  levels: CalendarLevel[];
  ranges: PhaseRange[];
  onChange: (next: PhaseRange[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const count = levels.length;
  const free = unassignedRuns(ranges, count);
  const levelOption = (i: number) => {
    const title = levels[i]?.title ?? "";
    return `${i + 1}. ${title.length > 28 ? `${title.slice(0, 27)}…` : title}`;
  };

  const update = (index: number, patch: Partial<PhaseRange>) => {
    const next = ranges.map((r) => ({ ...r }));
    const current = next[index];
    Object.assign(current, patch);
    const prev = next[index - 1];
    const after = next[index + 1];
    if (prev && prev.to >= current.from) prev.to = current.from - 1;
    if (after && after.from <= current.to) after.from = current.to + 1;
    onChange(next);
  };

  const add = () => {
    const run = free[0];
    if (!run) return;
    const key = nextPhaseKey(ranges.map((r) => r.key));
    const next = [...ranges, { key, from: run.from, to: run.to }].sort(
      (a, b) => a.from - b.from,
    );
    onChange(next);
  };

  const rename = (index: number, raw: string, input: HTMLInputElement) => {
    const key = normalizePhaseKey(raw);
    const current = ranges[index];
    if (!key || key === current.key) {
      input.value = current.key;
      return;
    }
    if (ranges.some((r, i) => i !== index && r.key === key)) {
      input.value = current.key;
      return;
    }
    update(index, { key });
  };

  const selectClass =
    "h-8 min-w-0 max-w-[11rem] rounded-lg border border-white/10 bg-black/30 px-2 text-xs disabled:opacity-50";
  const phaseCount =
    ranges.length === 1 ? "1 fase" : `${ranges.length} fases`;

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          <Layers className="size-3.5" />
          Fases
          <span className="text-[11px] font-normal normal-case tracking-normal">
            {phaseCount}
          </span>
          <ChevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
          />
        </button>
        {open ? (
        <button
          type="button"
          onClick={add}
          disabled={disabled || free.length === 0}
          title={
            free.length === 0
              ? "Todos os níveis já têm fase — encurta ou apaga uma fase primeiro"
              : undefined
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/12 bg-black/25 px-3 text-xs font-medium transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Nova fase
        </button>
        ) : null}
      </div>

      {open ? (
        ranges.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Ainda sem fases. Cria uma e escolhe os níveis que ela abrange.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {ranges.map((range, index) => {
            const prev = ranges[index - 1];
            const after = ranges[index + 1];
            const fromMin = prev ? prev.from + 1 : 0;
            const toMax = after ? after.to - 1 : count - 1;
            const span = levels.slice(range.from, range.to + 1);
            const weeks = span.reduce((sum, l) => sum + l.weeks, 0);
            const last = span[span.length - 1];
            const checkpoint = last?.isPhaseCheckpoint ? last : null;
            return (
              <li
                key={`${range.key}-${index}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-white/8 bg-black/15 px-3 py-2"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: phaseTone(index) }}
                />
                <span className="text-xs text-muted-foreground">Fase</span>
                <input
                  key={range.key}
                  defaultValue={range.key}
                  maxLength={3}
                  disabled={disabled}
                  aria-label={`Nome da ${phaseKeyLabel(range.key)}`}
                  onBlur={(e) => rename(index, e.target.value, e.target)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="h-8 w-11 rounded-lg border border-white/10 bg-black/30 text-center text-sm font-semibold uppercase"
                />
                <span className="text-xs text-muted-foreground">do</span>
                <select
                  aria-label={`Primeiro nível da ${phaseKeyLabel(range.key)}`}
                  value={range.from}
                  disabled={disabled}
                  onChange={(e) => update(index, { from: Number(e.target.value) })}
                  className={selectClass}
                >
                  {Array.from({ length: range.to - fromMin + 1 }, (_, k) => fromMin + k).map(
                    (i) => (
                      <option key={i} value={i}>
                        {levelOption(i)}
                      </option>
                    ),
                  )}
                </select>
                <span className="text-xs text-muted-foreground">ao</span>
                <select
                  aria-label={`Último nível da ${phaseKeyLabel(range.key)}`}
                  value={range.to}
                  disabled={disabled}
                  onChange={(e) => update(index, { to: Number(e.target.value) })}
                  className={selectClass}
                >
                  {Array.from({ length: toMax - range.from + 1 }, (_, k) => range.from + k).map(
                    (i) => (
                      <option key={i} value={i}>
                        {levelOption(i)}
                      </option>
                    ),
                  )}
                </select>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {span.length} {span.length === 1 ? "nível" : "níveis"} ·{" "}
                  {weeks === 1 ? "1 semana" : `${weeks} semanas`}
                  {checkpoint ? ` · fecha com «${checkpoint.title}»` : ""}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(ranges.filter((_, i) => i !== index))}
                  aria-label={`Apagar ${phaseKeyLabel(range.key)}`}
                  title="Apagar fase (os níveis ficam sem fase)"
                  className="ml-auto grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        )
      ) : null}
      {open && free.length > 0 && ranges.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Sem fase: {free.map((r) => rangeLabel(r.from, r.to)).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

type Cell =
  | { type: "level"; level: CalendarLevel; week: number; extended: boolean; over: boolean }
  | { type: "free"; week: number };

function levelTone(level: CalendarLevel, extended: boolean, over: boolean) {
  if (over) {
    return "bg-[color-mix(in_oklch,var(--neuma-coral)_70%,transparent)]";
  }
  if (extended) {
    return "bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--neuma-orange)_70%,transparent)_0_3px,transparent_3px_6px)] ring-1 ring-inset ring-[color-mix(in_oklch,var(--neuma-orange)_60%,transparent)]";
  }
  if (level.status === "active") return "neuma-gradient";
  if (level.status === "completed") return "bg-white/30";
  return level.number % 2 === 1
    ? "bg-[color-mix(in_oklch,color-mix(in_oklch,var(--neuma-blue)_55%,white)_70%,transparent)]"
    : "bg-[color-mix(in_oklch,color-mix(in_oklch,var(--neuma-blue)_35%,white)_40%,transparent)]";
}

function buildCells(levels: CalendarLevel[], total: number): Cell[] {
  const cells: Cell[] = [];
  let planned = 0;
  let week = 1;
  for (const level of levels) {
    for (let i = 0; i < level.weeks; i += 1) {
      planned += 1;
      cells.push({ type: "level", level, week, extended: false, over: planned > total });
      week += 1;
    }
    for (let i = 0; i < level.extendedWeeks; i += 1) {
      cells.push({ type: "level", level, week, extended: true, over: false });
      week += 1;
    }
  }
  for (let free = total - planned; free > 0; free -= 1) {
    cells.push({ type: "free", week });
    week += 1;
  }
  return cells;
}

function weekRange(first: number, count: number) {
  return count > 1 ? `Sem. ${first}–${first + count - 1}` : `Sem. ${first}`;
}

export function PathCalendarPanel({
  months,
  onMonthsChange,
  startDate,
  onStartDateChange,
  snapHint,
  endDate,
  totalWeeks,
  approximate,
  levels,
  disabled,
  scheduleDirty,
  onSelectLevel,
  onAddLevel,
  phaseRanges,
  onPhaseRangesChange,
}: {
  months: number;
  onMonthsChange: (months: number) => void;
  startDate: string;
  onStartDateChange: (raw: string) => void;
  snapHint: boolean;
  endDate: string | null;
  totalWeeks: number;
  /** No start date yet: weeks are an estimate from the months. */
  approximate: boolean;
  levels: CalendarLevel[];
  disabled?: boolean;
  scheduleDirty: boolean;
  onSelectLevel: (id: string) => void;
  /** Open create-level flow; `weeks` is the free block size (suggestion). */
  onAddLevel?: (weeks: number) => void;
  phaseRanges: PhaseRange[];
  onPhaseRangesChange: (next: PhaseRange[]) => void;
}) {
  const toneByKey = new Map(phaseRanges.map((r, i) => [r.key, phaseTone(i)]));
  const used = levels.reduce((sum, l) => sum + l.weeks, 0);
  const extended = levels.reduce((sum, l) => sum + l.extendedWeeks, 0);
  const free = totalWeeks - used;
  const cells = buildCells(levels, totalWeeks);

  const segments: Array<{ key: string; cells: Cell[]; level: CalendarLevel | null }> = [];
  for (const cell of cells) {
    const level = cell.type === "level" ? cell.level : null;
    const last = segments[segments.length - 1];
    if (last && last.level?.id === level?.id && (level || !last.level)) {
      last.cells.push(cell);
    } else {
      segments.push({ key: level ? level.id : `free-${cell.week}`, cells: [cell], level });
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarDays className="size-3.5" />
            Calendário
          </p>
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {approximate ? "≈ " : null}
            {totalWeeks} semanas
          </p>
          <p className="text-xs text-muted-foreground">
            {startDate && endDate
              ? `${formatShortDatePt(startDate)} → ${formatShortDatePt(endDate)}`
              : "Escolhe a data de início para fixar as semanas exatas."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Duração
            </p>
            <WeekStepper
              label="Duração do percurso em meses"
              value={months}
              onChange={onMonthsChange}
              min={1}
              max={24}
              disabled={disabled}
              unit={(n) => (n === 1 ? "mês" : "meses")}
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Início
            </p>
            <DatePicker
              id="path-start"
              value={startDate}
              disabled={disabled}
              className="h-10 w-44"
              onValueChange={onStartDateChange}
            />
          </div>
        </div>
      </div>
      {snapHint ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Ajustámos para segunda-feira — as semanas começam sempre à segunda.
        </p>
      ) : null}

      <div className="mt-5">
        <div
          className="flex h-9 w-full gap-1"
          role="list"
          aria-label="Semanas do percurso por nível"
        >
          {segments.map((segment) => {
            const first = segment.cells[0].week;
            const count = segment.cells.length;
            if (!segment.level) {
              const freeLabel =
                count === 1 ? "1 semana livre" : `${count} semanas livres`;
              if (onAddLevel && !disabled) {
                return (
                  <button
                    key={segment.key}
                    type="button"
                    role="listitem"
                    onClick={() => onAddLevel(count)}
                    aria-label={`Criar nível com ${freeLabel}`}
                    title={`${weekRange(first, count)} · criar nível`}
                    className="group relative flex min-w-0 gap-px rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--neuma-blue)_55%,white)]"
                    style={{ flexGrow: count, flexBasis: 0 }}
                  >
                    {segment.cells.map((cell) => (
                      <span
                        key={cell.week}
                        className="h-full min-w-0 flex-1 rounded-[3px] border border-dashed border-white/25 transition-colors group-hover:border-[color-mix(in_oklch,var(--neuma-blue)_45%,white)] group-hover:bg-white/[0.04]"
                      />
                    ))}
                    <span className="pointer-events-none absolute inset-0 grid place-items-center">
                      <span className="grid size-6 place-items-center rounded-full border border-dashed border-white/35 bg-[var(--neuma-ink)]/80 text-muted-foreground transition-colors group-hover:border-[color-mix(in_oklch,var(--neuma-blue)_55%,white)] group-hover:text-foreground">
                        <Plus className="size-3.5" strokeWidth={2.5} />
                      </span>
                    </span>
                  </button>
                );
              }
              return (
                <div
                  key={segment.key}
                  role="listitem"
                  aria-label={freeLabel}
                  title={`${weekRange(first, count)} · por distribuir`}
                  className="flex min-w-0 gap-px"
                  style={{ flexGrow: count, flexBasis: 0 }}
                >
                  {segment.cells.map((cell) => (
                    <span
                      key={cell.week}
                      className="h-full min-w-0 flex-1 rounded-[3px] border border-dashed border-white/25"
                    />
                  ))}
                </div>
              );
            }
            const level = segment.level;
            const extra = level.extendedWeeks;
            return (
              <button
                key={segment.key}
                type="button"
                role="listitem"
                onClick={() => onSelectLevel(level.id)}
                title={`Nível ${level.number} · ${level.title} · ${weekRange(first, count)}${extra ? ` (+${extra} prolongada${extra === 1 ? "" : "s"})` : ""}`}
                aria-label={`Nível ${level.number}, ${level.weeks === 1 ? "1 semana" : `${level.weeks} semanas`}`}
                className="group relative flex min-w-0 gap-px rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--neuma-blue)_55%,white)]"
                style={{ flexGrow: count, flexBasis: 0 }}
              >
                {segment.cells.map((cell) =>
                  cell.type === "level" ? (
                    <span
                      key={cell.week}
                      className={cn(
                        "h-full min-w-0 flex-1 rounded-[3px] transition-opacity group-hover:opacity-80",
                        levelTone(level, cell.extended, cell.over),
                      )}
                    />
                  ) : null,
                )}
                <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums text-[var(--neuma-ink)] mix-blend-normal">
                  {level.number}
                </span>
              </button>
            );
          })}
        </div>
        {phaseRanges.length > 0 ? (
          <div aria-hidden className="mt-1.5 flex w-full gap-1">
            {segments.map((segment, i) => {
              const key = segment.level?.phaseKey ?? null;
              const tone = key ? toneByKey.get(key) : undefined;
              const prevKey = segments[i - 1]?.level?.phaseKey ?? null;
              const nextKey = segments[i + 1]?.level?.phaseKey ?? null;
              return (
                <div
                  key={segment.key}
                  className="relative h-4 min-w-0"
                  style={{ flexGrow: segment.cells.length, flexBasis: 0 }}
                >
                  {tone ? (
                    <>
                      <span
                        className={cn(
                          "absolute top-0 left-0 h-[3px] rounded-full",
                          nextKey === key ? "-right-1" : "right-0",
                        )}
                        style={{ background: tone }}
                      />
                      {prevKey !== key ? (
                        <span
                          className="absolute top-1 left-0 whitespace-nowrap text-[10px] font-medium"
                          style={{ color: tone }}
                        >
                          {phaseKeyLabel(key)}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>Sem. 1</span>
          <span>Sem. {Math.max(totalWeeks, cells.length)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <p className="tabular-nums">
          <span className="font-semibold">{used}</span>
          <span className="text-muted-foreground"> de {totalWeeks} semanas distribuídas</span>
        </p>
        <p
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            free > 0 && "bg-white/8 text-foreground",
            free === 0 &&
              "bg-[color-mix(in_srgb,var(--neuma-lime)_18%,transparent)] text-[color-mix(in_srgb,var(--neuma-lime)_70%,var(--neuma-cream))]",
            free < 0 && "bg-[var(--neuma-coral)]/15 text-[var(--neuma-coral)]",
          )}
        >
          {free > 0
            ? `${free === 1 ? "1 semana livre" : `${free} semanas livres`}`
            : free === 0
              ? "Tudo distribuído"
              : `Excede em ${-free === 1 ? "1 semana" : `${-free} semanas`} — reduz um nível ou aumenta a duração`}
        </p>
        {extended > 0 ? (
          <p className="text-xs text-muted-foreground">
            +{extended} {extended === 1 ? "semana prolongada" : "semanas prolongadas"} além do previsto
          </p>
        ) : null}
      </div>
      {scheduleDirty ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Guarda as alterações para aplicar a nova duração aos níveis.
        </p>
      ) : approximate ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Sem data de início, o limite de semanas ainda não é aplicado.
        </p>
      ) : null}

      <PhaseEditor
        levels={levels}
        ranges={phaseRanges}
        onChange={onPhaseRangesChange}
        disabled={disabled}
      />
    </section>
  );
}
