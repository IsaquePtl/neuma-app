import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CheckInForm } from "@/components/check-in-form";

export default async function NewCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string }>;
}) {
  const { node: nodeId } = await searchParams;
  if (!nodeId) redirect("/path");

  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("id, title, description")
    .eq("id", nodeId)
    .single();

  if (!node) redirect("/path");

  return <CheckInForm nodeId={node.id} nodeTitle={node.title} />;
}
