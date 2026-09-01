import { notFound, redirect } from "next/navigation";

import { CheckpointQuizPanel } from "@/components/checkpoint-quiz-panel";
import { getQuizForStudent } from "@/lib/actions/quiz";
import { createClient } from "@/lib/supabase/server";
import { loadMyPathWithNodes } from "@/lib/students/queries";

async function levelNumberForNode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nodeId: string,
  pathId: string,
) {
  const { data: siblings } = await supabase
    .from("nodes")
    .select("id")
    .eq("path_id", pathId)
    .order("order_index", { ascending: true });

  const idx = siblings?.findIndex((n) => n.id === nodeId) ?? -1;
  return idx >= 0 ? idx + 1 : null;
}

export default async function CheckpointQuizPage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const { nodeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { path, nodes } = await loadMyPathWithNodes(user.id);
  if (!path) redirect("/path");
  if (path.status === "paused") redirect("/path");

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) notFound();
  if (node.kind !== "milestone") redirect(`/path/${nodeId}`);

  const activeIndex = nodes.findIndex((n) => n.status === "active");
  const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
  const isPast =
    node.status === "completed" ||
    (activeIndex >= 0 && nodeIndex >= 0 && nodeIndex < activeIndex);
  const isActive = node.status === "active";

  if (!isActive && !isPast) {
    redirect("/path");
  }

  const [levelNumber, { data: attempts }, { questions }] = await Promise.all([
    levelNumberForNode(supabase, nodeId, path.id),
    supabase
      .from("node_quiz_attempts")
      .select("id, score, correct_count, total, created_at")
      .eq("node_id", nodeId)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
    getQuizForStudent(nodeId),
  ]);

  return (
    <CheckpointQuizPanel
      nodeId={nodeId}
      nodeTitle={node.title}
      pathTitle={path.title}
      levelNumber={levelNumber ?? nodeIndex + 1}
      initialLastAttempt={attempts?.[0] ?? null}
      questions={questions}
    />
  );
}
