import type { TallyAnswerView } from "@/components/tally-answers";
import type { StudentNode } from "@/lib/students/queries";
import type {
  CheckInKind,
  CheckInStatus,
  NodeKind,
  StudentFeedbackViewKind,
} from "@/lib/types/database.types";

type CheckInFeedbackRow = {
  notes: string | null;
  next_steps?: string | null;
  video_url: string | null;
  approved: boolean | null;
};

type LevelFeedbackRow = {
  id?: string;
  notes: string | null;
  video_url: string | null;
  file_url?: string | null;
  created_at?: string;
};

export type StudentFeedbackViewRef = {
  kind: StudentFeedbackViewKind;
  referenceId: string;
};

export type StudentNodeCheckIn = {
  id: string;
  status: CheckInStatus;
  kind: CheckInKind;
  created_at: string;
  video_url: string | null;
  notes: string | null;
  submissionVideoUrl: string | null;
  tallyAnswers: TallyAnswerView[];
  feedback: CheckInFeedbackRow | null;
  /** False when mentor feedback exists and the student has not opened it yet. */
  viewed: boolean;
};

export type StudentNodeLevelFeedback = Required<
  Pick<LevelFeedbackRow, "id" | "notes" | "video_url" | "created_at">
> & {
  file_url: string | null;
  /** False when the student has not opened this level feedback yet. */
  viewed: boolean;
};

export type StudentUnviewedFeedbackItem = {
  kind: StudentFeedbackViewKind;
  referenceId: string;
  nodeId: string;
  nodeTitle: string;
  weekNumber: number | null;
  createdAt: string;
  checkInId?: string;
  nodeKind?: NodeKind | null;
};

/** Feedback list row for `/session/feedback` (viewed + unviewed). */
export type StudentFeedbackListItem = StudentUnviewedFeedbackItem & {
  viewed: boolean;
  nodeKind: NodeKind | null;
};

export type StudentNodeActivity = {
  checkIns: StudentNodeCheckIn[];
  levelFeedbacks: StudentNodeLevelFeedback[];
};

export function hasVisibleCheckInFeedback(
  feedback: CheckInFeedbackRow | null | undefined,
): boolean {
  if (!feedback) return false;
  return Boolean(
    feedback.notes?.trim() ||
      feedback.next_steps?.trim() ||
      feedback.video_url?.trim(),
  );
}

export function hasVisibleLevelFeedback(
  feedback: LevelFeedbackRow | null | undefined,
): boolean {
  if (!feedback) return false;
  return Boolean(
    feedback.notes?.trim() ||
      feedback.video_url?.trim() ||
      feedback.file_url?.trim(),
  );
}

/** Levels the student can open (active, completed, or before the active step). */
export function getStudentAccessibleNodeIds(nodes: StudentNode[]): string[] {
  const activeIndex = nodes.findIndex((n) => n.status === "active");
  return nodes
    .filter((node, index) => {
      if (node.status === "active" || node.status === "completed") return true;
      return activeIndex >= 0 && index < activeIndex;
    })
    .map((node) => node.id);
}

export function feedbackHrefForItem(item: StudentUnviewedFeedbackItem): string {
  const params = new URLSearchParams({ focus: "feedback" });
  if (item.kind === "check_in" && item.checkInId) {
    params.set("checkIn", item.checkInId);
  } else if (item.kind === "level") {
    params.set("feedback", item.referenceId);
  }
  return `/path/${item.nodeId}?${params.toString()}`;
}

export type NextLevelNode = Pick<
  StudentNode,
  | "id"
  | "order_index"
  | "status"
  | "title"
  | "description"
  | "kind"
  | "week_number"
>;

export type NextLevelPreview = {
  href: string;
  id: string;
  title: string;
  description: string | null;
  kind: NodeKind;
  week_number: number | null;
  levelNumber: number;
};

/** Next level preview after approval, or null if this is the last level. */
export function resolveNextLevel(
  nodes: NextLevelNode[],
  currentNodeId: string,
): NextLevelPreview | null {
  const sorted = [...nodes].sort((a, b) => a.order_index - b.order_index);
  const currentIndex = sorted.findIndex((node) => node.id === currentNodeId);
  if (currentIndex < 0 || currentIndex >= sorted.length - 1) return null;

  const nextNode = sorted[currentIndex + 1]!;

  return {
    href: `/path/${nextNode.id}`,
    id: nextNode.id,
    title: nextNode.title,
    description: nextNode.description,
    kind: nextNode.kind,
    week_number: nextNode.week_number,
    levelNumber: currentIndex + 2,
  };
}

/** Link to the next level after approval, or null if this is the last level. */
export function resolveNextLevelHref(
  nodes: Pick<StudentNode, "id" | "order_index" | "status">[],
  currentNodeId: string,
): string | null {
  return resolveNextLevel(nodes as NextLevelNode[], currentNodeId)?.href ?? null;
}
