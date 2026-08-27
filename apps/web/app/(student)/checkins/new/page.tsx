import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CheckInTallyPanel } from "@/components/check-in-tally-panel";
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

  const { data: path } = await supabase
    .from("paths")
    .select("id")
    .eq("student_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!path) redirect("/session");

  const formId = process.env.TALLY_CHECKIN_FORM_ID || "gDXd04";

  if (!nodeId) {
    return (
      <CheckInTallyPanel
        formId={formId}
        nodeId={null}
        nodeTitle={ORPHAN_CHECKIN_LABEL}
        studentId={user.id}
      />
    );
  }

  const { data: node } = await supabase
    .from("nodes")
    .select("id, title, path_id")
    .eq("id", nodeId)
    .maybeSingle();

  if (!node) {
    return (
      <CheckInTallyPanel
        formId={formId}
        nodeId={null}
        nodeTitle={ORPHAN_CHECKIN_LABEL}
        studentId={user.id}
      />
    );
  }

  const levelNumber = node.path_id
    ? await levelNumberForNode(supabase, node.id, node.path_id)
    : null;

  return (
    <CheckInTallyPanel
      formId={formId}
      nodeId={node.id}
      nodeTitle={node.title}
      levelNumber={levelNumber}
      studentId={user.id}
    />
  );
}
