import { notFound } from "next/navigation";

import { MentorLevelReviewView } from "@/components/mentor-level-review-view";
import { loadMentorLevelReviewData } from "@/lib/journey-path/load-level-review";

export default async function MentorLevelReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; nodeId: string }>;
  searchParams: Promise<{ checkin?: string; tab?: string }>;
}) {
  const { id: pathId, nodeId } = await params;
  const { checkin, tab } = await searchParams;
  const activeTab = tab === "nivel" ? "nivel" : "feedback";

  const data = await loadMentorLevelReviewData(pathId, nodeId, {
    checkin,
  });

  if (!data) notFound();

  return (
    <MentorLevelReviewView
      pathId={data.pathId}
      pathTitle={data.pathTitle}
      studentName={data.studentName}
      studentId={data.studentId}
      node={data.node}
      levelNumber={data.levelNumber}
      nodeCheckIns={data.nodeCheckIns}
      checkInDetail={data.checkInDetail}
      selectedCheckInId={data.selectedCheckInId}
      activeTab={activeTab}
    />
  );
}
