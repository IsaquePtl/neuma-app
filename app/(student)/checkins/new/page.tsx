import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CheckInTallyPanel } from "@/components/check-in-tally-panel";

export default async function NewCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string }>;
}) {
  const { node: nodeId } = await searchParams;
  if (!nodeId) redirect("/home");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: node } = await supabase
    .from("nodes")
    .select("id, title")
    .eq("id", nodeId)
    .single();

  if (!node) redirect("/home");

  const formId = process.env.TALLY_CHECKIN_FORM_ID || "gDXd04";

  return (
    <CheckInTallyPanel
      formId={formId}
      nodeId={node.id}
      nodeTitle={node.title}
      studentId={user.id}
    />
  );
}
