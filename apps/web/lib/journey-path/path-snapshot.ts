import type { StudentNode, StudentPath } from "@/lib/students/queries";

export type PathSnapshot = {
  title: string;
  description: string | null;
  goal: string | null;
  status: StudentPath["status"];
  studentId: string | null;
  /** Ordered node fingerprint: id + title + status (detects reorder / level edits). */
  nodesKey: string;
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
    nodesKey: nodes
      .map(
        (n) =>
          [
            n.id,
            n.title.trim(),
            (n.description ?? "").trim(),
            n.kind,
            n.status,
            n.week_number ?? "",
            n.due_date ?? "",
            (n.resource_url ?? "").trim(),
            (n.content_body ?? "").trim(),
          ].join("\0"),
      )
      .join("\n"),
  };
}

export function isEmptyDraftSnapshot(snapshot: PathSnapshot): boolean {
  return (
    snapshot.title === "Novo percurso" &&
    snapshot.nodesKey === "" &&
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
    a.nodesKey === b.nodesKey
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
