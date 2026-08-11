import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CheckInTallyPanel } from "@/components/check-in-tally-panel";
import { ORPHAN_CHECKIN_LABEL } from "@/lib/labels";

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
    .select("id, title")
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

  return (
    <CheckInTallyPanel
      formId={formId}
      nodeId={node.id}
      nodeTitle={node.title}
      studentId={user.id}
    />
  );
}
