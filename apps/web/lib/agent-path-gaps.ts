import { isAgentEmptyShell } from "@/lib/library-ready";

type NodeTitleRef = { title: string };

type ShellAsset = {
  id: string;
  title: string;
  content_status?: string | null;
  created_by_agent?: boolean | null;
};

export function nodeTitleSet(nodes: NodeTitleRef[]) {
  return new Set(nodes.map((n) => n.title));
}

export function shellsForPathNodes<T extends ShellAsset>(
  shells: T[],
  nodes: NodeTitleRef[],
): T[] {
  const titles = nodeTitleSet(nodes);
  return shells.filter(
    (s) => isAgentEmptyShell(s) && titles.has(s.title),
  );
}

export function orphanedAgentShells<T extends ShellAsset>(
  shells: T[],
  allNodeTitles: Set<string>,
): T[] {
  return shells.filter(
    (s) => isAgentEmptyShell(s) && !allNodeTitles.has(s.title),
  );
}

export function isAgentPathPending(
  path: { status: string },
  hasProposal: boolean,
  gapCount: number,
) {
  return hasProposal && (path.status === "draft" || gapCount > 0);
}
