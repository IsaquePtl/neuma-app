import {
  mondayOfWeek,
  normalizeToMonday,
  weekMondayForPath,
} from "@/lib/path-period";

/** Calendar date in Portugal, YYYY-MM-DD. Vercel runs in UTC. */
export function todayIsoDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function lisbonDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Monday the schedule is anchored to. A path without start_date still has
 * weeks: they begin on the Monday of the week the path was created.
 */
export function calendarStart(
  startDate: string | null | undefined,
  createdAt?: string | null,
): string | null {
  if (startDate) return normalizeToMonday(startDate);
  if (!createdAt) return null;
  return mondayOfWeek(lisbonDate(createdAt));
}

/** Monday the level starts, or null when the path has no calendar. */
export function levelStartMonday(
  pathStartDate: string | null | undefined,
  weekNumber: number | null | undefined,
): string | null {
  if (!pathStartDate || weekNumber == null || weekNumber < 1) return null;
  return weekMondayForPath(pathStartDate, weekNumber);
}

/** No calendar means the next level opens immediately. */
export function isLevelOpen(
  pathStartDate: string | null | undefined,
  weekNumber: number | null | undefined,
  today = todayIsoDate(),
): boolean {
  const monday = levelStartMonday(pathStartDate, weekNumber);
  if (!monday) return true;
  return today >= monday;
}

export function formatWeekdayDatePt(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = d.toLocaleDateString("pt-PT", { weekday: "long" });
  const date = d.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
  });
  return `${weekday}, ${date}`;
}

/** "Disponível na segunda-feira, 19 de outubro" */
export function levelAvailableLabel(iso: string): string {
  return `Disponível na ${formatWeekdayDatePt(iso)}`;
}

type LevelRow = {
  status: string;
  week_number: number | null;
};

/**
 * The immediate next level after a finished one, while its Monday is still
 * ahead. Hidden while any level is still active (revision, check-in, quiz).
 * Nodes must already be ordered by order_index.
 */
export function findUpcomingLevel<T extends LevelRow>(
  nodes: T[],
  pathStartDate: string | null | undefined,
  today = todayIsoDate(),
): { index: number; opensOn: string; node: T } | null {
  if (nodes.some((node) => node.status === "active")) return null;

  let lastCompleted = -1;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]!.status === "completed") lastCompleted = i;
  }
  if (lastCompleted < 0) return null;

  const next = nodes[lastCompleted + 1];
  if (!next || next.status !== "locked") return null;

  const opensOn = levelStartMonday(pathStartDate, next.week_number);
  if (!opensOn || today >= opensOn) return null;
  return { index: lastCompleted + 1, opensOn, node: next };
}

/**
 * Locked level that should become active because its Monday has arrived
 * and the previous level is already complete. Null while work is in progress.
 */
export function dueLevelToOpen<T extends LevelRow & { id: string }>(
  nodes: T[],
  pathStartDate: string | null | undefined,
  pathStatus: string,
  today = todayIsoDate(),
): T | null {
  if (pathStatus !== "active") return null;
  if (nodes.some((node) => node.status === "active")) return null;

  let lastCompleted = -1;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]!.status === "completed") lastCompleted = i;
  }
  if (lastCompleted < 0) return null;

  const next = nodes[lastCompleted + 1];
  if (!next || next.status !== "locked") return null;
  if (!isLevelOpen(pathStartDate, next.week_number, today)) return null;
  return next;
}

/**
 * Active level that was opened before its Monday, right after a completed one.
 * The first level of a path stays as the mentor published it.
 * Nodes must already be ordered by order_index.
 */
export function earlyActiveLevel<T extends LevelRow & { id: string }>(
  nodes: T[],
  pathStartDate: string | null | undefined,
  today = todayIsoDate(),
): T | null {
  const index = nodes.findIndex((node) => node.status === "active");
  if (index <= 0) return null;
  const active = nodes[index]!;
  if (nodes[index - 1]?.status !== "completed") return null;
  const monday = levelStartMonday(pathStartDate, active.week_number);
  if (!monday || today >= monday) return null;
  return active;
}
