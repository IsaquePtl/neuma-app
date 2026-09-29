"use client";

import { useMemo, useState } from "react";

import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeEndDate,
  formatPathEndDate,
  formatWeeksLabel,
  normalizeToMonday,
  parseDurationMonths,
  weeksBetweenDates,
} from "@/lib/path-period";

export function PeriodMonthsInput({
  id,
  name,
  value,
  onChange,
  min = 1,
  max = 24,
  disabled,
  required,
}: {
  id: string;
  name?: string;
  value: number;
  onChange: (months: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div className="flex h-10 overflow-hidden rounded-lg border border-input bg-transparent">
      <Input
        id={id}
        {...(name ? { name } : {})}
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next) && next >= min) onChange(next);
        }}
        className="h-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <span className="flex items-center border-l border-input px-3 text-sm text-muted-foreground">
        meses
      </span>
    </div>
  );
}

export function PathScheduleFields({
  startDate,
  periodMonths,
  onStartDateChange,
  onPeriodMonthsChange,
  disabled,
  startId = "path-start",
  periodId = "path-period",
  showPeriodInput = true,
}: {
  startDate: string;
  periodMonths: number;
  onStartDateChange: (value: string) => void;
  onPeriodMonthsChange: (months: number) => void;
  disabled?: boolean;
  startId?: string;
  periodId?: string;
  /** When false, only start date is edited here (duration lives elsewhere). */
  showPeriodInput?: boolean;
}) {
  const [snapHint, setSnapHint] = useState(false);

  const schedule = useMemo(() => {
    if (!startDate || periodMonths < 1) {
      return { endDate: null as string | null, weeks: null as number | null };
    }
    const startMonday = normalizeToMonday(startDate);
    const endDate = computeEndDate(startMonday, periodMonths);
    if (!endDate) return { endDate: null, weeks: null };
    return {
      endDate,
      weeks: weeksBetweenDates(startMonday, endDate),
    };
  }, [startDate, periodMonths]);

  return (
    <>
      <div
        className={
          showPeriodInput ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"
        }
      >
        {showPeriodInput ? (
          <div className="space-y-2">
            <Label htmlFor={periodId}>Duração</Label>
            <PeriodMonthsInput
              id={periodId}
              name="period_months"
              value={periodMonths}
              disabled={disabled}
              onChange={onPeriodMonthsChange}
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={startId}>Início do percurso</Label>
          <DatePicker
            id={startId}
            name="start_date"
            value={startDate}
            disabled={disabled}
            className="h-10"
            onValueChange={(raw) => {
              if (!raw) {
                setSnapHint(false);
                onStartDateChange("");
                return;
              }
              const monday = normalizeToMonday(raw);
              setSnapHint(monday !== raw);
              onStartDateChange(monday);
            }}
          />
        </div>
      </div>

      {snapHint ? (
        <p className="text-xs text-muted-foreground">
          Ajustámos para segunda-feira — os percursos começam sempre nesse dia.
        </p>
      ) : null}

      {schedule.endDate && schedule.weeks != null ? (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
          <div className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Semanas
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatWeeksLabel(schedule.weeks)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Fim do percurso
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatPathEndDate(schedule.endDate)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Define duração e data de início (segunda-feira) para calcular as
          semanas e o fim.
        </p>
      )}

      {!showPeriodInput ? (
        <input type="hidden" name="period_months" value={periodMonths} />
      ) : null}
      {schedule.endDate ? (
        <input type="hidden" name="end_date" value={schedule.endDate} />
      ) : null}
    </>
  );
}

export function initialPeriodMonths(
  durationLabel: string | null | undefined,
  startDate?: string | null,
  endDate?: string | null,
  periodMonths?: number | null,
): number {
  if (periodMonths && periodMonths >= 1) return periodMonths;
  return parseDurationMonths(durationLabel, startDate, endDate);
}
