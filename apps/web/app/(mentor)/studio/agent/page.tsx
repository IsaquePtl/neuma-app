import { createClient } from "@/lib/supabase/server";
import { agentHealth } from "@/lib/agent/client";
import { AgentsHub } from "@/components/agents-hub";
import { purgeOrphanedAgentShells } from "@/lib/actions/agent-library";

export default async function AgentPage() {
  await purgeOrphanedAgentShells();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));

  const [
    { count: students },
    { count: pendingReviews },
    { count: onboardings },
    { count: proposals },
    { count: checkinsToday },
    { count: checkinsWeek },
    health,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("tally_submissions")
      .select("id", { count: "exact", head: true })
      .eq("submission_kind", "onboarding")
      .in("status", ["pending", "linked"]),
    supabase
      .from("agent_proposals")
      .select("id", { count: "exact", head: true })
      .eq("mentor_id", user!.id)
      .eq("status", "pending"),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday.toISOString()),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfWeek.toISOString()),
    agentHealth(),
  ]);

  return (
    <AgentsHub
      healthOk={Boolean(health?.ok)}
      healthLabel={
        health?.ok
          ? (health.model ?? "modelo")
          : String(health?.error ?? health?.status ?? "?")
      }
      tracking={{
        students: students ?? 0,
        pendingReviews: pendingReviews ?? 0,
        onboardings: onboardings ?? 0,
        proposals: proposals ?? 0,
        checkinsToday: checkinsToday ?? 0,
        checkinsWeek: checkinsWeek ?? 0,
      }}
    />
  );
}
