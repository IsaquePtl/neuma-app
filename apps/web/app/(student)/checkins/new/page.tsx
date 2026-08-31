import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loadStudentPath } from "@/lib/students/queries";
import { CheckInTallyPanel } from "@/components/check-in-tally-panel";
import {
  checkInBlockedMessage,
  getCheckInAllowance,
} from "@/lib/checkins/allowance";
import { ORPHAN_CHECKIN_LABEL } from "@/lib/labels";

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

export default async function NewCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string }>;
}) {
  const { node: nodeId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const pathRow = await loadStudentPath(user.id, { forStudentApp: true });
  if (!pathRow) redirect("/session");
  if (pathRow.status === "paused") redirect("/path");

  if (!nodeId) {
    return (
      <CheckInTallyPanel
        nodeId={null}
        nodeTitle={ORPHAN_CHECKIN_LABEL}
        pathTitle={pathRow.title}
        studentId={user.id}
      />
    );
  }

  const { data: node } = await supabase
    .from("nodes")
    .select("id, title, path_id")
    .eq("id", nodeId)
    .maybeSingle();

  if (!node || node.path_id !== pathRow.id) {
    return (
      <CheckInTallyPanel
        nodeId={null}
        nodeTitle={ORPHAN_CHECKIN_LABEL}
        studentId={user.id}
      />
    );
  }

  const [levelNumber, allowance] = await Promise.all([
    node.path_id
      ? levelNumberForNode(supabase, node.id, node.path_id)
      : Promise.resolve(null),
    getCheckInAllowance(supabase, node.id, user.id),
  ]);

  return (
    <CheckInTallyPanel
      nodeId={node.id}
      nodeTitle={node.title}
      pathTitle={pathRow.title}
      levelNumber={levelNumber}
      studentId={user.id}
      blockedMessage={
        allowance.allowed ? null : checkInBlockedMessage(allowance)
      }
    />
  );
}
