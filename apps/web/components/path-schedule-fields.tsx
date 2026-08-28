"use client";

import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMonthsToDate,
  formatPathEndDate,
  parseDurationMonths,
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
}: {
  startDate: string;
  periodMonths: number;
  onStartDateChange: (value: string) => void;
  onPeriodMonthsChange: (months: number) => void;
  disabled?: boolean;
  startId?: string;
  periodId?: string;
}) {
  const endDate = useMemo(() => {
    if (!startDate || periodMonths < 1) return null;
    return addMonthsToDate(startDate, periodMonths);
  }, [startDate, periodMonths]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={startId}>Início do percurso (dia)</Label>
          <Input
            id={startId}
            name="start_date"
            type="date"
            value={startDate}
            disabled={disabled}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={periodId}>Período</Label>
          <PeriodMonthsInput
            id={periodId}
            name="period_months"
            value={periodMonths}
            disabled={disabled}
            onChange={onPeriodMonthsChange}
          />
        </div>
      </div>

      {endDate ? (
        <p className="text-xs text-muted-foreground">
          Fim previsto:{" "}
          <span className="text-foreground/90">{formatPathEndDate(endDate)}</span>
          {" · "}
          {periodMonths} meses
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Define a data de início para calcular o fim do percurso.
        </p>
      )}

      {endDate ? <input type="hidden" name="end_date" value={endDate} /> : null}
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
