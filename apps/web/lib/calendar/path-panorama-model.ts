import { mentorLevelReviewHref } from "@/lib/journey-path/level-review-url";
import { calendarStart, levelStartMonday } from "@/lib/nodes/level-open";
import { effectivePassRule } from "@/lib/nodes/pass-rule";
import { plannedWeeks } from "@/lib/nodes/week-budget";
import { addWeeksToDate, mondayOfWeek } from "@/lib/path-period";
import type {
  CheckInKind,
  NodeKind,
  NodePassRule,
  NodeStatus,
  PathStatus,
} from "@/lib/types/database.types";

/** Shared week axis: this week plus the near future, not the full path. */
export const PANORAMA_WEEK_COUNT = 8;

/** Current week and the next one count as "soon". */
const SOON_WEEKS = 2;

const MONTHS_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const MARK_PHRASE: Record<string, string> = {
  rever: "Check-in por rever",
  sessão: "Sessão",
  quiz: "Quiz",
  prazo: "Prazo",
};

export type PathPanoramaTone = "quiet" | "normal" | "attention" | "missing";

export type PanoramaNodeInput = {
  id: string;
  title: string;
  status: NodeStatus;
  weekNumber: number | null;
  durationWeeks: number | null;
  extendedWeeks: number | null;
  kind: NodeKind;
  dueDate: string | null;
  resourceUrl: string | null;
  contentBody: string | null;
  libraryAssetId: string | null;
  orderIndex: number;
  passRule: NodePassRule | null;
  checkInKind: CheckInKind | null;
  /** Oldest pending check-in on this level, if any. */
  pendingCheckInId: string | null;
};

export type PanoramaPathInput = {
  id: string;
  title: string;
  status: PathStatus;
  startDate: string | null;
  createdAt: string | null;
  studentName: string | null;
  studentEmail: string | null;
  avatarUrl: string | null;
  placeholderName: string | null;
  nodes: PanoramaNodeInput[];
};

export type PathPanoramaSegment = {
  id: string;
  href: string;
  tone: PathPanoramaTone;
  needsMentor: boolean;
  start: number;
  end: number;
  lane: number;
  /** Short word on the bar. Empty when weight alone is the signal. */
  mark: string;
  label: string;
};

export type PathPanoramaRow = {
  pathId: string;
  href: string;
  name: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  pathTitle: string;
  lanes: number;
  segments: PathPanoramaSegment[];
};

export type PathPanoramaWeek = {
  monday: string;
  label: string;
  overlap: number;
  current: boolean;
};

export type PathPanoramaModel = {
  weeks: PathPanoramaWeek[];
  rows: PathPanoramaRow[];
  /** 0–1 across the week track. */
  today: number;
  spanLabel: string;
  showLegend: boolean;
};

function daysBetween(startIso: string, endIso: string): number {
  const ms =
    Date.parse(`${endIso}T12:00:00Z`) - Date.parse(`${startIso}T12:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function weekLabel(monday: string): string {
  const date = new Date(`${monday}T12:00:00Z`);
  const month = MONTHS_PT[date.getUTCMonth()] ?? "";
  return `${date.getUTCDate()} ${month}`;
}

function expectsRecording(kind: NodeKind): boolean {
  return kind === "lesson" || kind === "practice" || kind === "resource";
}

function hasLevelContent(node: PanoramaNodeInput): boolean {
  if (node.libraryAssetId) return true;
  if (node.contentBody?.trim()) return true;
  const url = node.resourceUrl?.trim() ?? "";
  return url.length > 0 && url !== "#";
}

function isCallLevel(node: PanoramaNodeInput): boolean {
  if (node.kind === "call") return true;
  const rule = effectivePassRule(node.kind, node.passRule);
  return rule === "check_in" && node.checkInKind === "call";
}

function displaySource(path: PanoramaPathInput): string {
  return (
    path.studentName?.trim() ||
    path.placeholderName?.trim() ||
    path.studentEmail?.trim() ||
    path.title.trim() ||
    "Percurso"
  );
}

function firstToken(name: string): string {
  if (name.includes("@")) return name.split("@")[0] || name;
  return name.split(/\s+/).filter(Boolean)[0] || name;
}

function assignLanes(segments: PathPanoramaSegment[]): number {
  const ordered = [...segments].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  const laneEnds: number[] = [];
  for (const segment of ordered) {
    let lane = laneEnds.findIndex((end) => end <= segment.start + 0.001);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(segment.end);
    } else {
      laneEnds[lane] = segment.end;
    }
    segment.lane = lane;
  }
  return Math.max(1, laneEnds.length);
}

function disambiguate(rows: PathPanoramaRow[]) {
  const keys = rows.map((row) => firstToken(row.fullName).toLocaleLowerCase("pt"));
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);

  for (const row of rows) {
    const full = row.fullName;
    const first = firstToken(full);
    const key = first.toLocaleLowerCase("pt");
    if ((counts.get(key) ?? 0) < 2) {
      row.name = first;
      continue;
    }
    const parts = full.split(/\s+/).filter(Boolean);
    const second = parts[1];
    row.name = second ? `${parts[0]} ${second[0]}.` : full;
  }

  const shortCounts = new Map<string, number>();
  for (const row of rows) {
    const key = row.name.toLocaleLowerCase("pt");
    shortCounts.set(key, (shortCounts.get(key) ?? 0) + 1);
  }
  for (const row of rows) {
    const key = row.name.toLocaleLowerCase("pt");
    if ((shortCounts.get(key) ?? 0) > 1) row.name = row.fullName;
  }
}

function segmentLabel(input: {
  title: string;
  weekNumber: number | null;
  mark: string;
  tone: PathPanoramaTone;
  status: NodeStatus;
  pinned: boolean;
}): string {
  const parts = [input.title.trim() || "Nível"];
  if (input.weekNumber != null && input.weekNumber >= 1) {
    parts.push(`sem. ${input.weekNumber}`);
  }
  const phrase = input.mark ? MARK_PHRASE[input.mark] : null;
  if (phrase) parts.push(phrase);
  else if (input.tone === "missing") parts.push("Falta gravar");
  else if (input.tone === "attention") {
    parts.push(input.pinned ? "Ainda neste nível" : "Nível activo");
  } else if (input.status === "completed") parts.push("Concluído");
  else if (input.tone === "quiet") parts.push("Mais à frente");
  else parts.push("Agendado");
  return parts.join(" · ");
}

type DraftSegment = PathPanoramaSegment & {
  mentorStart: number;
  mentorEnd: number;
};

function levelPlacement(
  node: PanoramaNodeInput,
  anchor: string | null,
  windowStart: string,
  today: string,
): {
  start: number;
  end: number;
  tone: PathPanoramaTone;
  mark: string;
  pinned: boolean;
  mentorStart: number;
  mentorEnd: number;
} | null {
  const span =
    plannedWeeks(node.durationWeeks) +
    Math.max(0, Math.min(52, node.extendedWeeks ?? 0));
  const levelMonday =
    anchor != null ? levelStartMonday(anchor, node.weekNumber) : null;
  const rawStart =
    levelMonday != null ? daysBetween(windowStart, levelMonday) / 7 : null;
  const rawEnd = rawStart != null ? rawStart + span : null;
  const placed = rawStart != null && rawEnd != null;

  const active = node.status === "active";
  const pending = Boolean(node.pendingCheckInId);
  const missing =
    expectsRecording(node.kind) &&
    !hasLevelContent(node) &&
    node.status !== "completed";
  const passRule = effectivePassRule(node.kind, node.passRule);
  const quiz = active && passRule === "quiz";
  const intersectsWindow =
    placed && rawEnd! > 0 && rawStart! < PANORAMA_WEEK_COUNT;
  const intersectsSoon = placed && rawEnd! > 0 && rawStart! < SOON_WEEKS;
  const call =
    isCallLevel(node) &&
    node.status !== "completed" &&
    (active || intersectsSoon);
  const thisWeekEnd = addWeeksToDate(windowStart, 1);
  const dueThisWeek =
    node.status !== "completed" &&
    Boolean(node.dueDate) &&
    node.dueDate! >= windowStart &&
    node.dueDate! < thisWeekEnd;
  const overdue =
    node.status !== "completed" &&
    Boolean(node.dueDate) &&
    node.dueDate! < today &&
    (active || (placed && rawStart! <= 0 && rawEnd! > 0));
  const due = dueThisWeek || overdue;
  const urgent = pending || call || quiz || due || active;
  const pinned = (active || pending || overdue) && (!placed || rawEnd! <= 0);

  if (!intersectsWindow && !pinned) return null;
  if (node.status === "completed" && !pending && !intersectsWindow) return null;

  let start = 0;
  let end = 0.62;
  if (placed && !pinned) {
    start = Math.max(0, rawStart!);
    end = Math.min(PANORAMA_WEEK_COUNT, rawEnd!);
  }
  if (end <= start) return null;

  let tone: PathPanoramaTone;
  if (urgent && missing) tone = "missing";
  else if (urgent) tone = "attention";
  else if (missing) tone = "missing";
  else if (node.status === "completed" || (placed && rawStart! >= SOON_WEEKS)) {
    tone = "quiet";
  } else tone = "normal";

  let mark = "";
  if (pending) mark = "rever";
  else if (call) mark = "sessão";
  else if (quiz) mark = "quiz";
  else if (due) mark = "prazo";

  let mentorStart = 0;
  let mentorEnd = 0;
  if (urgent) {
    mentorStart = start;
    mentorEnd = end;
  } else if (missing && placed) {
    if (rawStart! < 1) {
      mentorStart = 0;
      mentorEnd = Math.min(1, end);
    } else if (rawStart! < PANORAMA_WEEK_COUNT) {
      const arrival = Math.floor(rawStart!);
      mentorStart = arrival;
      mentorEnd = Math.min(PANORAMA_WEEK_COUNT, arrival + 1);
    }
  }

  return {
    start,
    end,
    tone,
    mark,
    pinned,
    mentorStart,
    mentorEnd,
  };
}

function buildRow(
  path: PanoramaPathInput,
  windowStart: string,
  today: string,
): { row: PathPanoramaRow; mentor: DraftSegment[] } | null {
  const anchor = calendarStart(path.startDate, path.createdAt);
  const segments: PathPanoramaSegment[] = [];
  const mentor: DraftSegment[] = [];

  const nodes = [...path.nodes].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const node of nodes) {
    const placed = levelPlacement(node, anchor, windowStart, today);
    if (!placed) continue;
    const segment: PathPanoramaSegment = {
      id: node.id,
      href: mentorLevelReviewHref(
        path.id,
        node.id,
        node.pendingCheckInId ? { checkin: node.pendingCheckInId } : undefined,
      ),
      tone: placed.tone,
      needsMentor: placed.mentorEnd > placed.mentorStart,
      start: placed.start,
      end: placed.end,
      lane: 0,
      mark: placed.mark,
      label: segmentLabel({
        title: node.title,
        weekNumber: node.weekNumber,
        mark: placed.mark,
        tone: placed.tone,
        status: node.status,
        pinned: placed.pinned,
      }),
    };
    segments.push(segment);
    mentor.push({
      ...segment,
      mentorStart: placed.mentorStart,
      mentorEnd: placed.mentorEnd,
    });
  }

  if (segments.length === 0) return null;
  const fullName = displaySource(path);
  return {
    row: {
      pathId: path.id,
      href: `/studio/journeys/${path.id}`,
      name: fullName,
      fullName,
      email: path.studentEmail,
      avatarUrl: path.avatarUrl,
      pathTitle: path.title,
      lanes: assignLanes(segments),
      segments,
    },
    mentor,
  };
}

function rank(segments: DraftSegment[]): number {
  let best = 4;
  for (const segment of segments) {
    if (!segment.needsMentor) {
      if (segment.tone === "missing") best = Math.min(best, 3);
      continue;
    }
    if (segment.mentorStart < 1 && segment.mentorEnd > 0) best = Math.min(best, 0);
    else if (segment.mentorStart < SOON_WEEKS) best = Math.min(best, 1);
    else best = Math.min(best, 2);
  }
  return best;
}

export function buildPathPanorama(
  paths: PanoramaPathInput[],
  today: string,
): PathPanoramaModel {
  const windowStart = mondayOfWeek(today);
  const kept = paths.filter(
    (path) =>
      (path.status === "active" || path.status === "paused") &&
      path.nodes.length > 0,
  );

  const built: Array<{
    status: PathStatus;
    row: PathPanoramaRow;
    mentor: DraftSegment[];
  }> = [];
  for (const path of kept) {
    const result = buildRow(path, windowStart, today);
    if (!result) continue;
    built.push({ status: path.status, ...result });
  }

  const overlapSets = Array.from(
    { length: PANORAMA_WEEK_COUNT },
    () => new Set<string>(),
  );
  for (const item of built) {
    for (const segment of item.mentor) {
      if (!segment.needsMentor) continue;
      const from = Math.max(0, Math.floor(segment.mentorStart));
      const to = Math.min(PANORAMA_WEEK_COUNT, Math.ceil(segment.mentorEnd));
      for (let week = from; week < to; week += 1) {
        overlapSets[week]?.add(item.row.pathId);
      }
    }
  }

  built.sort((a, b) => {
    const byNeed = rank(a.mentor) - rank(b.mentor);
    if (byNeed !== 0) return byNeed;
    const byStatus =
      (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1);
    if (byStatus !== 0) return byStatus;
    return a.row.fullName.localeCompare(b.row.fullName, "pt");
  });

  const rows = built.map((item) => item.row);
  disambiguate(rows);

  const weeks: PathPanoramaWeek[] = Array.from(
    { length: PANORAMA_WEEK_COUNT },
    (_, index) => {
      const monday = addWeeksToDate(windowStart, index);
      return {
        monday,
        label: weekLabel(monday),
        overlap: overlapSets[index]?.size ?? 0,
        current: index === 0,
      };
    },
  );

  const dayOffset = Math.min(
    Math.max(daysBetween(windowStart, today), 0),
    PANORAMA_WEEK_COUNT * 7 - 1,
  );

  return {
    weeks,
    rows,
    today: (dayOffset + 0.45) / (PANORAMA_WEEK_COUNT * 7),
    spanLabel: `Próximas ${PANORAMA_WEEK_COUNT} semanas`,
    showLegend:
      weeks.some((week) => week.overlap >= 2) ||
      rows.some((row) =>
        row.segments.some(
          (segment) =>
            segment.tone === "missing" || segment.tone === "attention",
        ),
      ),
  };
}
