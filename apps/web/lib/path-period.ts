/** Shared path schedule helpers (months, weeks, node segmentation). */

export function addMonthsToDate(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function addWeeksToDate(isoDate: string, weeks: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export function parseMonthsFromDuration(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return n > 0 ? n : null;
}

export function parseDurationMonths(
  durationLabel: string | null | undefined,
  startDate?: string | null,
  endDate?: string | null,
): number {
  const fromLabel = parseMonthsFromDuration(durationLabel);
  if (fromLabel) return fromLabel;
  if (startDate && endDate) {
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    let months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months -= 1;
    if (months > 0) return months;
  }
  return 3;
}

export function formatDurationLabel(months: number): string {
  return months === 1 ? "1 mês" : `${months} meses`;
}

export function computeEndDate(
  startDate: string | null | undefined,
  months: number | null | undefined,
): string | null {
  if (!startDate || !months || months <= 0) return null;
  return addMonthsToDate(startDate, months);
}

export function formatPathEndDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatShortDatePt(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function weeksBetweenDates(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const diffDays = Math.round(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.max(1, Math.ceil(diffDays / 7));
}

export type NodeTimelineSegment = {
  week_number: number;
  duration_weeks: number;
};

export function segmentNodeTimeline(
  nodeCount: number,
  totalWeeks: number,
  existingDurationWeeks?: (number | null)[],
): NodeTimelineSegment[] {
  if (nodeCount <= 0) return [];

  const hasCustomDurations =
    existingDurationWeeks?.length === nodeCount &&
    existingDurationWeeks.every((w) => w != null && w >= 1);

  let durations: number[];
  if (hasCustomDurations) {
    durations = existingDurationWeeks as number[];
  } else {
    const base = Math.max(1, Math.floor(totalWeeks / nodeCount));
    const remainder = totalWeeks % nodeCount;
    durations = Array.from({ length: nodeCount }, (_, i) =>
      Math.max(1, base + (i < remainder ? 1 : 0)),
    );
  }

  const segments: NodeTimelineSegment[] = [];
  let week = 1;
  for (const duration_weeks of durations) {
    segments.push({ week_number: week, duration_weeks });
    week += duration_weeks;
  }
  return segments;
}

export function resolvePathSchedule(input: {
  startDate: string | null;
  periodMonths: number | null;
  durationLabel?: string | null;
  endDate?: string | null;
}) {
  const periodMonths =
    input.periodMonths && input.periodMonths > 0
      ? input.periodMonths
      : input.durationLabel
        ? parseDurationMonths(
            input.durationLabel,
            input.startDate,
            input.endDate ?? null,
          )
        : null;

  let endDate = input.endDate ?? null;
  let durationLabel = input.durationLabel ?? null;

  if (input.startDate && periodMonths && periodMonths > 0) {
    endDate = addMonthsToDate(input.startDate, periodMonths);
    durationLabel = formatDurationLabel(periodMonths);
  } else if (periodMonths && periodMonths > 0) {
    durationLabel = formatDurationLabel(periodMonths);
  }

  return {
    startDate: input.startDate,
    endDate,
    durationLabel,
    periodMonths: periodMonths && periodMonths > 0 ? periodMonths : null,
  };
}
