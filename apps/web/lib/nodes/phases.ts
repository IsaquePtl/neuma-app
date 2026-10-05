import type { NodeKind } from "@/lib/types/database.types";

/**
 * Phases group consecutive levels by `phase_key`. A milestone flagged with
 * `is_phase_checkpoint` closes its phase: it is always the phase's last level.
 * Any other milestone is a standalone check-point (quiz retried immediately).
 */
export type PhaseNodeLike = {
  id: string;
  kind: NodeKind;
  phase_key?: string | null;
  is_phase_checkpoint?: boolean | null;
};

export type PhaseBlock<T extends PhaseNodeLike> = {
  key: string | null;
  nodes: T[];
  /** Index in the full ordered list of the block's first level. */
  startIndex: number;
  checkpoint: T | null;
};

export function normalizePhaseKey(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().replace(/^fase\s+/i, "").trim();
  return value ? value.toUpperCase() : null;
}

function keyOf(node: PhaseNodeLike): string | null {
  return normalizePhaseKey(node.phase_key);
}

/** Shape check only — position is checked by `resolvePhaseCheckpointIds`. */
export function canCloseOwnPhase(node: PhaseNodeLike): boolean {
  return node.kind === "milestone" && keyOf(node) !== null;
}

/**
 * Read-time source of truth: a checkpoint closes its phase only when it is the
 * last level of that phase. Anything else degrades to a standalone check-point.
 */
export function resolvePhaseCheckpointIds(nodes: PhaseNodeLike[]): Set<string> {
  const lastByKey = new Map<string, PhaseNodeLike>();
  for (const node of nodes) {
    const key = keyOf(node);
    if (key) lastByKey.set(key, node);
  }
  const ids = new Set<string>();
  for (const node of lastByKey.values()) {
    if (node.is_phase_checkpoint && canCloseOwnPhase(node)) ids.add(node.id);
  }
  return ids;
}

/** Consecutive runs of the same phase (levels without phase form `key: null` runs). */
export function phaseBlocks<T extends PhaseNodeLike>(nodes: T[]): PhaseBlock<T>[] {
  const checkpointIds = resolvePhaseCheckpointIds(nodes);
  const blocks: PhaseBlock<T>[] = [];
  nodes.forEach((node, index) => {
    const key = keyOf(node);
    const current = blocks[blocks.length - 1];
    if (current && current.key === key) {
      current.nodes.push(node);
    } else {
      blocks.push({ key, nodes: [node], startIndex: index, checkpoint: null });
    }
    if (checkpointIds.has(node.id)) blocks[blocks.length - 1].checkpoint = node;
  });
  return blocks;
}

/** Levels the student must revisit after failing a phase checkpoint. */
export function phaseReviewNodes<T extends PhaseNodeLike>(
  nodes: T[],
  checkpointId: string,
): T[] {
  const index = nodes.findIndex((n) => n.id === checkpointId);
  if (index < 0) return [];
  const checkpoint = nodes[index];
  if (!resolvePhaseCheckpointIds(nodes).has(checkpoint.id)) return [];
  const key = keyOf(checkpoint);
  return nodes.slice(0, index).filter((n) => keyOf(n) === key);
}

/** Distinct phases in order of first appearance. */
export function listPhases<T extends PhaseNodeLike>(
  nodes: T[],
): Array<{ key: string; checkpoint: T | null; count: number }> {
  const out = new Map<string, { key: string; checkpoint: T | null; count: number }>();
  for (const block of phaseBlocks(nodes)) {
    if (!block.key) continue;
    const entry = out.get(block.key) ?? { key: block.key, checkpoint: null, count: 0 };
    entry.count += block.nodes.length;
    if (block.checkpoint) entry.checkpoint = block.checkpoint;
    out.set(block.key, entry);
  }
  return [...out.values()];
}

export type PhaseOption = {
  key: string;
  count: number;
  checkpoint: { id: string; title: string } | null;
};

/** Serializable phase list for editors (picker + "replaces X" warning). */
export function phaseOptions(
  nodes: Array<PhaseNodeLike & { title: string }>,
): PhaseOption[] {
  return listPhases(nodes).map((p) => ({
    key: p.key,
    count: p.count,
    checkpoint: p.checkpoint
      ? { id: p.checkpoint.id, title: p.checkpoint.title }
      : null,
  }));
}

/** Next unused phase letter (A, B, C…) for "Nova fase". */
export function suggestNextPhaseKey(phases: Array<{ key: string }>): string {
  const used = new Set(phases.map((p) => p.key));
  for (let c = 65; c <= 90; c += 1) {
    const key = String.fromCharCode(c);
    if (!used.has(key)) return key;
  }
  return String(phases.length + 1);
}

export type PhaseLayoutPlan = {
  orderedIds: string[];
  /** Desired `is_phase_checkpoint` per id (only ids whose value must change). */
  flagChanges: Map<string, boolean>;
};

/**
 * Write-time normalization:
 * - each phase is contiguous (levels join their phase's first block);
 * - at most one checkpoint per phase (`preferredCheckpointId` wins, else the last);
 * - the checkpoint is the phase's last level;
 * - only milestones with a phase can be checkpoints.
 */
export function planPhaseLayout(
  nodes: PhaseNodeLike[],
  preferredCheckpointId?: string | null,
): PhaseLayoutPlan {
  const desired = new Map<string, boolean>();
  const chosenByKey = new Map<string, string>();
  for (const node of nodes) {
    const key = keyOf(node);
    if (!key || !node.is_phase_checkpoint || !canCloseOwnPhase(node)) continue;
    chosenByKey.set(key, node.id);
  }
  if (preferredCheckpointId) {
    const preferred = nodes.find((n) => n.id === preferredCheckpointId);
    const key = preferred ? keyOf(preferred) : null;
    if (preferred && key && preferred.is_phase_checkpoint && canCloseOwnPhase(preferred)) {
      chosenByKey.set(key, preferred.id);
    }
  }
  const checkpointIds = new Set(chosenByKey.values());
  for (const node of nodes) desired.set(node.id, checkpointIds.has(node.id));

  const segments: Array<{ key: string | null; ids: string[]; checkpointId: string | null }> = [];
  const segmentByKey = new Map<string, (typeof segments)[number]>();
  for (const node of nodes) {
    const key = keyOf(node);
    if (!key) {
      segments.push({ key: null, ids: [node.id], checkpointId: null });
      continue;
    }
    let segment = segmentByKey.get(key);
    if (!segment) {
      segment = { key, ids: [], checkpointId: null };
      segmentByKey.set(key, segment);
      segments.push(segment);
    }
    if (checkpointIds.has(node.id)) segment.checkpointId = node.id;
    else segment.ids.push(node.id);
  }

  const orderedIds = segments.flatMap((s) =>
    s.checkpointId ? [...s.ids, s.checkpointId] : s.ids,
  );

  const flagChanges = new Map<string, boolean>();
  for (const node of nodes) {
    const next = desired.get(node.id) ?? false;
    if (Boolean(node.is_phase_checkpoint) !== next) flagChanges.set(node.id, next);
  }
  return { orderedIds, flagChanges };
}

/** `planPhaseLayout` applied in memory, for bulk inserts (copies, drafts). */
export function normalizePhaseRows<T extends PhaseNodeLike>(rows: T[]): T[] {
  const withKeys = rows.map((row) => ({ ...row, phase_key: keyOf(row) }));
  const plan = planPhaseLayout(withKeys);
  const byId = new Map(withKeys.map((row) => [row.id, row]));
  return plan.orderedIds.map((id) => {
    const row = byId.get(id)!;
    const flag = plan.flagChanges.get(id);
    return {
      ...row,
      is_phase_checkpoint: flag ?? Boolean(row.is_phase_checkpoint),
    };
  });
}

export type PhaseAwareMove = {
  orderedIds: string[];
  /** New phase of the moved level when it crossed a phase boundary. */
  phaseKey: string | null;
  phaseChanged: boolean;
};

/**
 * Up/down that respects phases: crossing a boundary moves the level into the
 * neighbouring phase (before its checkpoint). Phase checkpoints don't move —
 * they always close their phase.
 */
export function planPhaseAwareMove(
  nodes: PhaseNodeLike[],
  id: string,
  direction: "up" | "down",
): PhaseAwareMove | null {
  const index = nodes.findIndex((n) => n.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= nodes.length) return null;

  const checkpointIds = resolvePhaseCheckpointIds(nodes);
  const moving = nodes[index];
  if (checkpointIds.has(moving.id)) return null;

  const neighbor = nodes[swapIndex];
  const movingKey = keyOf(moving);
  const neighborKey = keyOf(neighbor);

  let nextKey = movingKey;
  if (checkpointIds.has(neighbor.id) && neighborKey === movingKey) {
    // Past its own phase's checkpoint → leaves the phase into what follows.
    const after = nodes[swapIndex + 1];
    nextKey = after ? keyOf(after) : null;
  } else if (neighborKey !== movingKey) {
    nextKey = neighborKey;
  }

  const swapped = nodes.map((n) => (n.id === moving.id ? { ...n, phase_key: nextKey } : n));
  [swapped[index], swapped[swapIndex]] = [swapped[swapIndex], swapped[index]];
  const plan = planPhaseLayout(swapped);
  return {
    orderedIds: plan.orderedIds,
    phaseKey: nextKey,
    phaseChanged: nextKey !== movingKey,
  };
}

/**
 * Drag & drop to a final position. The level joins the phase it lands in: the
 * run around it, else its own phase if adjacent, else the open phase above,
 * else what follows. Dropping after a closed phase leaves it. Checkpoints don't move.
 */
export function planPhaseAwareDrop(
  nodes: PhaseNodeLike[],
  id: string,
  toIndex: number,
): PhaseAwareMove | null {
  const from = nodes.findIndex((n) => n.id === id);
  if (from < 0) return null;
  const checkpointIds = resolvePhaseCheckpointIds(nodes);
  if (checkpointIds.has(id)) return null;

  const moving = nodes[from];
  const rest = nodes.filter((n) => n.id !== id);
  const at = Math.max(0, Math.min(Math.trunc(toIndex), rest.length));
  const prev = rest[at - 1];
  const next = rest[at];
  const movingKey = keyOf(moving);
  const prevKey = prev ? keyOf(prev) : null;
  const nextKey = next ? keyOf(next) : null;
  const prevOpen = Boolean(prev) && !checkpointIds.has(prev!.id);

  let key: string | null;
  if (prev && next && prevKey === nextKey) key = prevKey;
  else if (movingKey && ((prevOpen && prevKey === movingKey) || nextKey === movingKey)) {
    key = movingKey;
  } else if (prevOpen && prevKey) key = prevKey;
  else key = next ? nextKey : null;

  const simulated = [...rest];
  simulated.splice(at, 0, { ...moving, phase_key: key });
  const plan = planPhaseLayout(simulated);
  const phaseChanged = key !== movingKey;
  if (!phaseChanged && sameOrder(plan.orderedIds, nodes.map((n) => n.id))) return null;
  return { orderedIds: plan.orderedIds, phaseKey: key, phaseChanged };
}

/** A phase as a contiguous run of levels (0-based, inclusive). */
export type PhaseRange = { key: string; from: number; to: number };

export function phaseRangesOf(nodes: PhaseNodeLike[]): PhaseRange[] {
  const ranges: PhaseRange[] = [];
  nodes.forEach((node, i) => {
    const key = keyOf(node);
    if (!key) return;
    const last = ranges[ranges.length - 1];
    if (last && last.key === key && last.to === i - 1) last.to = i;
    else ranges.push({ key, from: i, to: i });
  });
  return ranges;
}

export function validatePhaseRanges(
  ranges: PhaseRange[],
  levelCount: number,
): string | null {
  const seen = new Set<string>();
  let prevTo = -1;
  for (const range of [...ranges].sort((a, b) => a.from - b.from)) {
    const key = normalizePhaseKey(range.key);
    if (!key) return "Cada fase precisa de um nome.";
    if (seen.has(key)) return `Já existe a ${key.length <= 3 ? `Fase ${key}` : key}.`;
    seen.add(key);
    if (
      !Number.isInteger(range.from) ||
      !Number.isInteger(range.to) ||
      range.from < 0 ||
      range.to >= levelCount ||
      range.from > range.to
    ) {
      return "Intervalo de níveis inválido.";
    }
    if (range.from <= prevTo) return "As fases não se podem sobrepor.";
    prevTo = range.to;
  }
  return null;
}

/**
 * Levels keep their order. A phase checkpoint survives only if it is still the
 * last level of its (new) phase — otherwise it becomes a standalone milestone.
 */
export function planPhaseRanges<T extends PhaseNodeLike>(
  nodes: T[],
  ranges: PhaseRange[],
): Array<T & { phase_key: string | null; is_phase_checkpoint: boolean }> {
  const keyAt = new Array<string | null>(nodes.length).fill(null);
  const lastAt = new Set<number>();
  for (const range of ranges) {
    const key = normalizePhaseKey(range.key);
    for (let i = range.from; i <= range.to; i += 1) keyAt[i] = key;
    lastAt.add(range.to);
  }
  return nodes.map((node, i) => {
    const phase_key = keyAt[i] ?? null;
    const keepCheckpoint =
      Boolean(node.is_phase_checkpoint) &&
      phase_key !== null &&
      lastAt.has(i) &&
      node.kind === "milestone";
    return { ...node, phase_key, is_phase_checkpoint: keepCheckpoint };
  });
}

export function nextPhaseKey(used: Iterable<string>): string {
  const taken = new Set([...used].map((k) => k.toUpperCase()));
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code);
    if (!taken.has(letter)) return letter;
  }
  let n = 1;
  while (taken.has(String(n))) n += 1;
  return String(n);
}

export function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
