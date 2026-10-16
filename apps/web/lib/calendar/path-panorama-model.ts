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

/** Weeks on screen before a later repeat of the same level can extend the axis. */
export const PANORAMA_WEEK_COUNT = 12;

/** Furthest week still drawn, so a repeat a few weeks later stays on the same board. */
const PANORAMA_WEEK_MAX = 18;

/** Levels further out still count as the same gravação, but stay off the board. */
const PANORAMA_HORIZON = 30;

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
  /** Playable video on the level or on the library item it points at. */
  hasVideo: boolean;
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
  title: string;
  /** Level still needs a video, and no sibling level has one yet. */
  needsVideo: boolean;
  /** A video already exists on this level or on the same recording for another student. */
  videoReady: boolean;
  /** Set when at least one other student has this same level. */
  shareKey: string | null;
  shareCount: number;
  label: string;
};

export type PathPanoramaShareMember = {
  name: string;
  when: string;
  href: string;
  hasVideo: boolean;
  needsVideo: boolean;
};

/** One recording that covers the same level for more than one student. */
export type PathPanoramaShare = {
  key: string;
  /** Same value as the level cards, so hovering a recording still lights every equal title. */
  levelKey: string;
  title: string;
  instrument: string | null;
  /** True when any of these levels already has a playable video. */
  hasVideo: boolean;
  href: string;
  members: PathPanoramaShareMember[];
};

export type PathPanoramaRow = {
  pathId: string;
  href: string;
  name: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  pathTitle: string;
  instrument: string | null;
  /** Monday the path starts, used to order who joined recently. */
  startedOn: string | null;
  lanes: number;
  segments: PathPanoramaSegment[];
};

export type PathPanoramaWeek = {
  monday: string;
  label: string;
  /** Distinct recordings whose earliest student reaches them this week, still without a video. */
  due: number;
  current: boolean;
};

export type PathPanoramaModel = {
  weeks: PathPanoramaWeek[];
  rows: PathPanoramaRow[];
  /** 0–1 across the week track. */
  today: number;
  spanLabel: string;
  /** One line under the title: videos still to record, and how many are shared. */
  summary: string;
  shares: PathPanoramaShare[];
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

function expectsVideo(kind: NodeKind): boolean {
  return kind === "lesson" || kind === "practice" || kind === "resource";
}

function pathInstrument(title: string): "Piano" | "Guitarra" | null {
  const value = title.toLocaleLowerCase("pt");
  if (value.includes("guitarra") || value.includes("guitar")) return "Guitarra";
  if (value.includes("piano") || value.includes("teclado")) return "Piano";
  return null;
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

type DraftSegment = {
  id: string;
  pathId: string;
  href: string;
  tone: PathPanoramaTone;
  needsMentor: boolean;
  start: number;
  end: number;
  mark: string;
  pinned: boolean;
  title: string;
  needsVideo: boolean;
  hasVideo: boolean;
  libraryAssetId: string | null;
  instrument: "Piano" | "Guitarra" | null;
  mentorStart: number;
  mentorEnd: number;
  weekIndex: number;
  when: string;
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
    expectsVideo(node.kind) && !node.hasVideo && node.status !== "completed";
  const passRule = effectivePassRule(node.kind, node.passRule);
  const quiz = active && passRule === "quiz";
  const intersectsWindow =
    placed && rawEnd! > 0 && rawStart! < PANORAMA_HORIZON;
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
  let end = 1.4;
  if (placed && !pinned) {
    start = rawStart!;
    end = rawEnd!;
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
    } else if (rawStart! < PANORAMA_HORIZON) {
      const arrival = Math.floor(rawStart!);
      mentorStart = arrival;
      mentorEnd = arrival + 1;
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
): { drafts: DraftSegment[] } | null {
  const anchor = calendarStart(path.startDate, path.createdAt);
  const instrument = pathInstrument(path.title);
  const drafts: DraftSegment[] = [];

  const nodes = [...path.nodes].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const node of nodes) {
    const placed = levelPlacement(node, anchor, windowStart, today);
    if (!placed) continue;
    const weekIndex = placed.pinned ? 0 : Math.round(placed.start);
    const monday =
      weekIndex >= 0 ? addWeeksToDate(windowStart, weekIndex) : windowStart;
    drafts.push({
      id: node.id,
      pathId: path.id,
      href: mentorLevelReviewHref(
        path.id,
        node.id,
        node.pendingCheckInId ? { checkin: node.pendingCheckInId } : undefined,
      ),
      tone: placed.tone,
      needsMentor: placed.mentorEnd > placed.mentorStart,
      start: placed.start,
      end: placed.end,
      mark: placed.mark,
      pinned: placed.pinned,
      title: node.title.trim() || "Nível",
      needsVideo:
        expectsVideo(node.kind) && !node.hasVideo && node.status !== "completed",
      hasVideo: node.hasVideo,
      libraryAssetId: node.libraryAssetId,
      instrument,
      mentorStart: placed.mentorStart,
      mentorEnd: placed.mentorEnd,
      weekIndex,
      when: weekLabel(monday),
    });
  }

  if (drafts.length === 0) return null;
  return { drafts };
}

function contentKey(segment: DraftSegment): string {
  const title = normalizeTitle(segment.title);
  if (segment.libraryAssetId) return `asset:${segment.libraryAssetId}`;
  const instrument = segment.instrument?.toLocaleLowerCase("pt") ?? "geral";
  return `title:${instrument}:${title}`;
}

/** Equal level titles, whatever the instrument or library item. */
function levelKey(segment: DraftSegment): string {
  return `level:${normalizeTitle(segment.title)}`;
}

function mergeSharedKeys(groups: Map<string, DraftSegment[]>): Map<string, DraftSegment[]> {
  const merged = new Map(groups);
  const assetKeys = [...merged.keys()].filter((key) => key.startsWith("asset:"));
  for (const key of [...merged.keys()]) {
    if (!key.startsWith("title:")) continue;
    const items = merged.get(key);
    if (!items?.length) continue;
    const title = normalizeTitle(items[0]?.title ?? "");
    const instrument = items[0]?.instrument ?? null;
    const assetKey = assetKeys.find((candidate) => {
      const group = merged.get(candidate);
      if (!group?.length || normalizeTitle(group[0]?.title ?? "") !== title) {
        return false;
      }
      const instruments = new Set(group.map((item) => item.instrument));
      if (instruments.size !== 1) return true;
      return instruments.has(instrument);
    });
    if (!assetKey) continue;
    const group = merged.get(assetKey);
    if (!group) continue;
    group.push(...items);
    merged.delete(key);
  }
  return merged;
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

function clipSegment(
  segment: DraftSegment,
  weekCount: number,
): PathPanoramaSegment | null {
  const start = Math.max(0, segment.start);
  const end = Math.min(weekCount, segment.pinned ? Math.max(segment.end, 1.4) : segment.end);
  if (end <= start) return null;
  return {
    id: segment.id,
    href: segment.href,
    tone: segment.tone,
    needsMentor: segment.needsMentor,
    start,
    end,
    lane: 0,
    mark: segment.mark,
    title: segment.title,
    needsVideo: segment.needsVideo,
    videoReady: segment.hasVideo,
    shareKey: null,
    shareCount: 1,
    label: segment.title,
  };
}

export function buildPathPanorama(
  paths: PanoramaPathInput[],
  today: string,
): PathPanoramaModel {
  const windowStart = mondayOfWeek(today);
  const kept = paths.filter((path) => path.status === "active");

  const built: Array<{
    status: PathStatus;
    pathId: string;
    fullName: string;
    email: string | null;
    avatarUrl: string | null;
    pathTitle: string;
    instrument: "Piano" | "Guitarra" | null;
    startedOn: string | null;
    drafts: DraftSegment[];
  }> = [];
  for (const path of kept) {
    const result = buildRow(path, windowStart, today);
    built.push({
      status: path.status,
      pathId: path.id,
      fullName: displaySource(path),
      email: path.studentEmail,
      avatarUrl: path.avatarUrl,
      pathTitle: path.title,
      instrument: pathInstrument(path.title),
      startedOn: calendarStart(path.startDate, path.createdAt),
      drafts: result?.drafts ?? [],
    });
  }

  const groups = mergeSharedKeys(
    built.reduce((map, item) => {
      for (const segment of item.drafts) {
        const key = contentKey(segment);
        const list = map.get(key) ?? [];
        list.push(segment);
        map.set(key, list);
      }
      return map;
    }, new Map<string, DraftSegment[]>()),
  );

  const levelGroups = built.reduce((map, item) => {
    for (const segment of item.drafts) {
      const key = levelKey(segment);
      const list = map.get(key) ?? [];
      list.push(segment);
      map.set(key, list);
    }
    return map;
  }, new Map<string, DraftSegment[]>());

  let weekCount = PANORAMA_WEEK_COUNT;
  for (const items of [...groups.values(), ...levelGroups.values()]) {
    const pathsInGroup = new Set(items.map((item) => item.pathId));
    if (pathsInGroup.size < 2) continue;
    const indexes = items
      .map((item) => item.weekIndex)
      .filter((index) => index >= 0 && index < PANORAMA_WEEK_MAX);
    if (!indexes.some((index) => index < PANORAMA_WEEK_COUNT)) continue;
    weekCount = Math.max(weekCount, Math.min(PANORAMA_WEEK_MAX, Math.max(...indexes) + 1));
  }

  const levelBySegment = new Map<string, { key: string; count: number }>();
  for (const [key, items] of levelGroups) {
    const pathIds = new Set(items.map((item) => item.pathId));
    if (pathIds.size < 2) continue;
    for (const item of items) {
      levelBySegment.set(item.id, { key, count: pathIds.size });
    }
  }

  const recordingBySegment = new Map<string, { hasVideo: boolean }>();
  const shares: PathPanoramaShare[] = [];
  for (const [key, items] of groups) {
    const pathIds = new Set(items.map((item) => item.pathId));
    if (pathIds.size < 2) continue;
    const hasVideo = items.some((item) => item.hasVideo);
    for (const item of items) {
      recordingBySegment.set(item.id, { hasVideo });
    }
    const needs = items.filter((item) => item.needsVideo);
    if (needs.length === 0) continue;
    const visible = items.some(
      (item) => item.weekIndex >= 0 && item.weekIndex < weekCount + 6,
    );
    if (!visible) continue;
    const ordered = [...items].sort(
      (a, b) => a.weekIndex - b.weekIndex || a.title.localeCompare(b.title, "pt"),
    );
    const lead = ordered.find((item) => item.needsVideo) ?? ordered[0];
    if (!lead) continue;
    shares.push({
      key,
      levelKey: levelKey(lead),
      title: lead.title,
      instrument: lead.instrument,
      hasVideo,
      href: lead.href,
      members: [],
    });
  }

  const dueSets = Array.from({ length: weekCount }, () => new Set<string>());
  for (const [key, items] of groups) {
    if (items.some((item) => item.hasVideo)) continue;
    const open = items.filter((item) => item.needsVideo && item.weekIndex >= 0);
    if (open.length === 0) continue;
    const earliest = Math.min(...open.map((item) => item.weekIndex));
    if (earliest >= 0 && earliest < weekCount) dueSets[earliest]?.add(key);
  }

  built.sort((a, b) => {
    const byNeed = rank(a.drafts) - rank(b.drafts);
    if (byNeed !== 0) return byNeed;
    const byStatus =
      (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1);
    if (byStatus !== 0) return byStatus;
    return a.fullName.localeCompare(b.fullName, "pt");
  });

  const rows: PathPanoramaRow[] = [];
  for (const item of built) {
    const segments: PathPanoramaSegment[] = [];
    for (const draft of item.drafts) {
      if (draft.end <= 0 || draft.start >= weekCount) continue;
      const segment = clipSegment(draft, weekCount);
      if (!segment) continue;
      const level = levelBySegment.get(draft.id);
      if (level && level.count >= 2) {
        segment.shareKey = level.key;
        segment.shareCount = level.count;
      }
      const recording = recordingBySegment.get(draft.id);
      if (recording) {
        segment.videoReady = draft.hasVideo || recording.hasVideo;
      }
      const phrase = segment.mark ? MARK_PHRASE[segment.mark] : null;
      const videoWord = segment.needsVideo
        ? segment.videoReady
          ? "Vídeo já gravado noutro aluno"
          : "Falta gravar"
        : null;
      const shareWord =
        segment.shareCount >= 2 ? `Mesmo nível em ${segment.shareCount} alunos` : null;
      segment.label = [segment.title, phrase, videoWord, shareWord, draft.when]
        .filter(Boolean)
        .join(" · ");
      segments.push(segment);
    }
    rows.push({
      pathId: item.pathId,
      href: `/studio/journeys/${item.pathId}`,
      name: item.fullName,
      fullName: item.fullName,
      email: item.email,
      avatarUrl: item.avatarUrl,
      pathTitle: item.pathTitle,
      instrument: item.instrument,
      startedOn: item.startedOn,
      lanes: Math.max(1, assignLanes(segments)),
      segments,
    });
  }
  disambiguate(rows);

  const nameByPath = new Map(rows.map((row) => [row.pathId, row.name]));
  const fullByPath = new Map(built.map((item) => [item.pathId, item.fullName]));
  for (const share of shares) {
    const items = groups.get(share.key) ?? [];
    const ordered = [...items].sort((a, b) => a.weekIndex - b.weekIndex);
    const seen = new Set<string>();
    share.members = ordered.flatMap((item) => {
      if (seen.has(item.pathId)) return [];
      seen.add(item.pathId);
      return [{
        name: nameByPath.get(item.pathId) ?? fullByPath.get(item.pathId) ?? "Aluno",
        when: item.when,
        href: item.href,
        hasVideo: item.hasVideo,
        needsVideo: item.needsVideo,
      }];
    });
    const lead = ordered.find((item) => item.needsVideo) ?? ordered[0];
    if (lead) share.href = lead.href;
  }
  shares.sort((a, b) => {
    const earliest = (key: string) => {
      const items = (groups.get(key) ?? []).filter((item) => item.needsVideo);
      if (items.length === 0) return PANORAMA_HORIZON;
      return Math.min(...items.map((item) => item.weekIndex));
    };
    return earliest(a.key) - earliest(b.key) || a.title.localeCompare(b.title, "pt");
  });

  const noteByKey = new Map<string, string>();
  for (const [key, items] of levelGroups) {
    const unique = new Map<string, DraftSegment>();
    for (const item of [...items].sort((a, b) => a.weekIndex - b.weekIndex)) {
      if (!unique.has(item.pathId)) unique.set(item.pathId, item);
    }
    if (unique.size < 2) continue;
    noteByKey.set(
      key,
      [...unique.values()]
        .map((item) => {
          const name = nameByPath.get(item.pathId) ?? fullByPath.get(item.pathId) ?? "Aluno";
          return `${name} · ${item.when}`;
        })
        .join(", "),
    );
  }
  for (const row of rows) {
    for (const segment of row.segments) {
      const note = segment.shareKey ? noteByKey.get(segment.shareKey) : null;
      if (note) segment.label = `${segment.label} · ${note}`;
    }
  }

  const weeks: PathPanoramaWeek[] = Array.from({ length: weekCount }, (_, index) => {
    const monday = addWeeksToDate(windowStart, index);
    return {
      monday,
      label: weekLabel(monday),
      due: dueSets[index]?.size ?? 0,
      current: index === 0,
    };
  });

  const dayOffset = Math.min(
    Math.max(daysBetween(windowStart, today), 0),
    weekCount * 7 - 1,
  );
  const missing = rows.reduce(
    (sum, row) => sum + row.segments.filter((segment) => segment.needsVideo && !segment.videoReady).length,
    0,
  );
  const sharedRecordings = shares.filter((share) => !share.hasVideo).length;
  const summaryParts = [
    missing === 0
      ? "Nenhum nível sem vídeo"
      : missing === 1
        ? "1 nível sem vídeo"
        : `${missing} níveis sem vídeo`,
  ];
  if (sharedRecordings > 0) {
    summaryParts.push(
      sharedRecordings === 1
        ? "1 gravação chega a mais do que um aluno"
        : `${sharedRecordings} gravações chegam a mais do que um aluno`,
    );
  }

  return {
    weeks,
    rows,
    today: (dayOffset + 0.45) / (weekCount * 7),
    spanLabel: `Próximas ${weekCount} semanas`,
    summary: summaryParts.join(" · "),
    shares,
    showLegend: missing > 0 || shares.length > 0 || weeks.some((week) => week.due > 0),
  };
}
