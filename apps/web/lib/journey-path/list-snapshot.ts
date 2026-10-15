import { checkInStatusLabel } from "@/lib/labels";
import {
  calendarStart,
  findUpcomingLevel,
  formatWeekdayDatePt,
} from "@/lib/nodes/level-open";
import { effectivePassRule } from "@/lib/nodes/pass-rule";
import type {
  CheckInStatus,
  NodeKind,
  NodePassRule,
} from "@/lib/types/database.types";

type SnapshotNode = {
  id: string;
  title: string;
  status: string;
  order_index: number;
  week_number: number | null;
  kind: NodeKind;
  pass_rule: NodePassRule | null;
};

type CheckInRow = {
  status: CheckInStatus;
  created_at: string;
};

function levelTitle(node: { title: string; week_number: number | null }) {
  const title = node.title.trim() || "Nível";
  if (node.week_number != null && node.week_number >= 1) {
    return `${title} · Sem. ${node.week_number}`;
  }
  return title;
}

function checkInPhrase(node: SnapshotNode, rows: CheckInRow[]): string | null {
  const rule = effectivePassRule(node.kind, node.pass_rule);
  const pending = rows.some((row) => row.status === "pending");
  const mentorStillReviews =
    pending || rows.some((row) => row.status === "needs_revision");
  if (rule !== "check_in" && !mentorStillReviews) return null;
  if (pending) return checkInStatusLabel.pending;

  const latest = rows.reduce<CheckInRow | null>((best, row) => {
    if (!best || row.created_at > best.created_at) return row;
    return best;
  }, null);
  if (latest?.status === "needs_revision" || latest?.status === "approved") {
    return checkInStatusLabel[latest.status];
  }
  return rule === "check_in" ? "Sem check-in" : null;
}

export type PathListSnapshot = {
  agora: {
    title: string;
    /** Set when a level is active. Absent for "Sem nível ativo". */
    nodeId: string | null;
  };
  /** Check-in state of the active level, when that level uses check-ins. */
  checkIn: string | null;
  next: {
    title: string;
    nodeId: string;
    /** "entra na segunda-feira, 19 de outubro" while the level waits for Monday. */
    waiting: string | null;
  } | null;
};

/** Current level, check-in state, and next level under a path row. */
export function pathListSnapshot(input: {
  nodes: SnapshotNode[];
  startDate: string | null;
  createdAt: string | null;
  checkInsByNode: ReadonlyMap<string, CheckInRow[]>;
  checkInsLoaded: boolean;
}): PathListSnapshot {
  const nodes = [...input.nodes].sort(
    (a, b) => a.order_index - b.order_index,
  );
  const activeIndex = nodes.findIndex((node) => node.status === "active");
  const active = activeIndex >= 0 ? nodes[activeIndex] : null;

  let checkIn: string | null = null;
  if (active && input.checkInsLoaded) {
    checkIn = checkInPhrase(active, input.checkInsByNode.get(active.id) ?? []);
  }

  let next: PathListSnapshot["next"] = null;
  if (active) {
    const following = nodes[activeIndex + 1];
    if (following) {
      next = {
        title: following.title.trim() || "Nível",
        nodeId: following.id,
        waiting: null,
      };
    }
  } else {
    const upcoming = findUpcomingLevel(
      nodes,
      calendarStart(input.startDate, input.createdAt),
    );
    if (upcoming) {
      next = {
        title: upcoming.node.title.trim() || "Nível",
        nodeId: upcoming.node.id,
        waiting: `entra na ${formatWeekdayDatePt(upcoming.opensOn)}`,
      };
    } else {
      const following = nodes.find((node) => node.status !== "completed");
      if (following) {
        next = {
          title: following.title.trim() || "Nível",
          nodeId: following.id,
          waiting: null,
        };
      }
    }
  }

  return {
    agora: {
      title: active ? levelTitle(active) : "Sem nível ativo",
      nodeId: active?.id ?? null,
    },
    checkIn,
    next,
  };
}
