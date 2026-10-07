import { notFound } from "next/navigation";

import { MentorQuizPreviewPanel } from "@/components/mentor-quiz-preview-panel";
import { listQuizQuestions } from "@/lib/actions/quiz";
import { loadMentorLevelReviewData } from "@/lib/journey-path/load-level-review";
import { nodeUsesQuizGate } from "@/lib/nodes/pass-rule";

export default async function MentorLevelQuizPage({
  params,
}: {
  params: Promise<{ id: string; nodeId: string }>;
}) {
  const { id: pathId, nodeId } = await params;
  const data = await loadMentorLevelReviewData(pathId, nodeId);

  if (!data) notFound();

  const { node } = data;
  if (node.kind === "call" || !nodeUsesQuizGate(node.pass_rule)) notFound();

  const questions = await listQuizQuestions(nodeId);

  return (
    <MentorQuizPreviewPanel
      nodeTitle={node.title}
      pathTitle={data.pathTitle}
      studentName={data.studentName}
      levelNumber={data.levelNumber}
      questions={questions}
      quizGate={nodeUsesQuizGate(node.pass_rule)}
      passScore={node.pass_score}
    />
  );
}
