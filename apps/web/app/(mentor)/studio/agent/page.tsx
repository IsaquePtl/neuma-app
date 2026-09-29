import { createClient } from "@/lib/supabase/server";
import { agentHealth } from "@/lib/agent/client";
import { AgentsHub } from "@/components/agents-hub";
import { purgeOrphanedAgentShells } from "@/lib/actions/agent-library";

export default async function AgentPage() {
  await purgeOrphanedAgentShells();

  const supabase = await createClient();

  const [{ data: studentRows }, health] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student")
      .order("full_name", { ascending: true }),
    agentHealth(),
  ]);

  const studentOptions = (studentRows ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    email: s.email,
  }));

  return (
    <AgentsHub
      healthOk={Boolean(health?.ok)}
      healthLabel={
        health?.ok
          ? "multi-modelo"
          : String(health?.error ?? health?.status ?? "?")
      }
      students={studentOptions}
    />
  );
}
