import { createClient } from "@/lib/supabase/server";
import { agentHealth } from "@/lib/agent/client";
import { AgentsHub } from "@/components/agents-hub";
import { LibraryAgentNeedsYou } from "@/components/library-agent-needs";
import { isAgentEmptyShell } from "@/lib/library-ready";
import type {
  LibraryAssetKind,
  LibraryAssetUsage,
} from "@/lib/types/database.types";

export default async function AgentPage() {
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
    { data: shellAssets },
    { data: agentTopics },
    { data: categories },
    { data: libraryTopics },
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
    supabase
      .from("library_assets")
      .select(
        "id, title, summary, kind, usage, topic_id, body, url, storage_path, tags, duration_label, content_status, created_by_agent, archived_at",
      )
      .eq("created_by_agent", true)
      .in("content_status", ["empty", "drafting"])
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("library_topics")
      .select("id, category_id, name, rationale, created_by_agent")
      .eq("created_by_agent", true)
      .order("sort_index", { ascending: true }),
    supabase
      .from("library_categories")
      .select("id, name")
      .order("sort_index", { ascending: true }),
    supabase
      .from("library_topics")
      .select("id, category_id, name")
      .order("sort_index", { ascending: true }),
  ]);

  const catById = new Map((categories ?? []).map((c) => [c.id, c]));
  const emptyShells = (shellAssets ?? []).filter(isAgentEmptyShell);

  return (
    <div className="space-y-6">
      <LibraryAgentNeedsYou
        topics={(agentTopics ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          rationale: t.rationale,
          category_name: catById.get(t.category_id)?.name,
        }))}
        assets={emptyShells.map((a) => ({
          id: a.id,
          title: a.title,
          summary: a.summary,
          usage: a.usage as LibraryAssetUsage,
          kind: a.kind as LibraryAssetKind,
          topic_id: a.topic_id,
          body: a.body,
          url: a.url,
          storage_path: a.storage_path,
          tags: a.tags ?? [],
          duration_label: a.duration_label,
        }))}
        categories={categories ?? []}
        libraryTopics={libraryTopics ?? []}
      />
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
    </div>
  );
}
