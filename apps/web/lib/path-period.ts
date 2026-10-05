/** Shared path schedule helpers (months, Mon–Fri weeks, node segmentation). */

function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysToDate(isoDate: string, days: number): string {
  const d = parseLocalDate(isoDate);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function addMonthsToDate(isoDate: string, months: number): string {
  const d = parseLocalDate(isoDate);
  d.setMonth(d.getMonth() + months);
  return toIsoDate(d);
}

export function addWeeksToDate(isoDate: string, weeks: number): string {
  return addDaysToDate(isoDate, weeks * 7);
}

/** JS getDay(): 0=Sun … 1=Mon … 6=Sat */
export function weekdayIndex(isoDate: string): number {
  return parseLocalDate(isoDate).getDay();
}

export function isMonday(isoDate: string): boolean {
  return weekdayIndex(isoDate) === 1;
}

/** Snap to Monday of the same ISO week (Mon–Sun). */
export function mondayOfWeek(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + delta);
  return toIsoDate(d);
}

/** Next Monday on or after the given date. */
export function normalizeToMonday(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  const day = d.getDay();
  if (day === 1) return isoDate;
  const delta = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + delta);
  return toIsoDate(d);
}

export function fridayOfWeek(isoDate: string): string {
  return addDaysToDate(mondayOfWeek(isoDate), 4);
}

/**
 * End of a path: Friday of the last week inside [start, start + months).
 * Start must be a Monday (caller should normalize).
 */
export function computePathEndDate(
  startMonday: string,
  months: number,
): string | null {
  if (!startMonday || !months || months <= 0) return null;
  return fridayOfWeek(addDaysToDate(addMonthsToDate(startMonday, months), -1));
}

const WEEKS_PER_MONTH = 52 / 12;

/** Accepts "6 meses", "1 mês", "26 semanas (~6 meses)" or "26 semanas". */
export function parseMonthsFromDuration(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  const months = text.match(/(\d+)\s*(?:mês|mes)/);
  if (months) {
    const n = Number(months[1]);
    return n > 0 ? n : null;
  }
  const weeks = text.match(/(\d+)\s*sem/);
  if (weeks) {
    const n = Number(weeks[1]);
    return n > 0 ? Math.max(1, Math.round(n / WEEKS_PER_MONTH)) : null;
  }
  const lead = text.match(/^(\d+)/);
  if (!lead) return null;
  const n = Number(lead[1]);
  return n > 0 ? n : null;
}

/** Rough week count before a start date pins the calendar. */
export function approxWeeksForMonths(months: number): number {
  return Math.max(1, Math.round(months * WEEKS_PER_MONTH));
}

export function parseDurationMonths(
  durationLabel: string | null | undefined,
  startDate?: string | null,
  endDate?: string | null,
): number {
  const fromLabel = parseMonthsFromDuration(durationLabel);
  if (fromLabel) return fromLabel;
  if (startDate && endDate) {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
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

export function formatWeeksLabel(weeks: number): string {
  return weeks === 1 ? "1 semana" : `${weeks} semanas`;
}

export function computeEndDate(
  startDate: string | null | undefined,
  months: number | null | undefined,
): string | null {
  if (!startDate || !months || months <= 0) return null;
  const startMonday = normalizeToMonday(startDate);
  return computePathEndDate(startMonday, months);
}

export function formatPathEndDate(iso: string): string {
  const d = parseLocalDate(iso);
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatShortDatePt(iso: string): string {
  const d = parseLocalDate(iso);
  return d.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Count Mon–Fri work weeks from path start Monday through end Friday (inclusive).
 * Example: Mon→Fri same week = 1; Mon→next Fri = 2.
 */
export function weeksBetweenDates(startDate: string, endDate: string): number {
  const startMon = mondayOfWeek(startDate);
  const endFri = fridayOfWeek(endDate);
  const start = parseLocalDate(startMon);
  const end = parseLocalDate(endFri);
  const diffDays = Math.round(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays < 0) return 1;
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

export function weekMondayForPath(
  pathStartMonday: string,
  weekNumber: number,
): string {
  const week = Math.max(1, weekNumber);
  return addWeeksToDate(normalizeToMonday(pathStartMonday), week - 1);
}

export function weekFridayForPath(
  pathStartMonday: string,
  weekNumber: number,
): string {
  return addDaysToDate(weekMondayForPath(pathStartMonday, weekNumber), 4);
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

  let startDate = input.startDate ?? null;
  if (startDate) {
    startDate = normalizeToMonday(startDate);
  }

  let endDate = input.endDate ?? null;
  let durationLabel = input.durationLabel ?? null;
  let totalWeeks: number | null = null;

  if (startDate && periodMonths && periodMonths > 0) {
    endDate = computePathEndDate(startDate, periodMonths);
    durationLabel = formatDurationLabel(periodMonths);
    if (endDate) totalWeeks = weeksBetweenDates(startDate, endDate);
  } else if (periodMonths && periodMonths > 0) {
    durationLabel = formatDurationLabel(periodMonths);
  } else if (startDate && endDate) {
    totalWeeks = weeksBetweenDates(startDate, endDate);
  }

  return {
    startDate,
    endDate,
    durationLabel,
    periodMonths: periodMonths && periodMonths > 0 ? periodMonths : null,
    totalWeeks,
  };
}
