import type { StudentNode, StudentPath } from "@/lib/students/queries";

export type PathSnapshot = {
  title: string;
  description: string | null;
  goal: string | null;
  status: StudentPath["status"];
  studentId: string | null;
  nodeCount: number;
  nodeIds: string[];
};

export function buildPathSnapshot(
  path: StudentPath,
  nodes: StudentNode[],
  studentId: string | null,
): PathSnapshot {
  return {
    title: path.title.trim(),
    description: (path.description ?? "").trim() || null,
    goal: (path.goal ?? "").trim() || null,
    status: path.status,
    studentId,
    nodeCount: nodes.length,
    nodeIds: nodes.map((n) => n.id).sort(),
  };
}

export function isEmptyDraftSnapshot(snapshot: PathSnapshot): boolean {
  return (
    snapshot.title === "Novo percurso" &&
    snapshot.nodeCount === 0 &&
    !snapshot.studentId &&
    !snapshot.goal &&
    !snapshot.description
  );
}

export function snapshotsEqual(a: PathSnapshot, b: PathSnapshot): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.goal === b.goal &&
    a.status === b.status &&
    a.studentId === b.studentId &&
    a.nodeCount === b.nodeCount &&
    a.nodeIds.join("\0") === b.nodeIds.join("\0")
  );
}

export function shouldConfirmLeave(
  initial: PathSnapshot,
  current: PathSnapshot,
  isNewDraft: boolean,
): boolean {
  if (!snapshotsEqual(initial, current)) return true;
  return isNewDraft && isEmptyDraftSnapshot(initial);
}
