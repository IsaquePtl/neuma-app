import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.role === "mentor") redirect("/studio");
  if (profile?.role !== "student") redirect("/");
  if (!profile.onboarding_completed) redirect("/onboarding");

  const { count: revisionCount } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("student_id", user.id)
    .eq("status", "needs_revision");

  const { data: myCheckIns } = await supabase
    .from("check_ins")
    .select("id")
    .eq("student_id", user.id);
  const ids = (myCheckIns ?? []).map((c) => c.id);
  let recentFeedbackCount = 0;
  if (ids.length > 0) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("feedbacks")
      .select("id", { count: "exact", head: true })
      .in("check_in_id", ids)
      .gte("created_at", weekAgo);
    recentFeedbackCount = count ?? 0;
  }

  const badge = (revisionCount ?? 0) + recentFeedbackCount;

  return (
    <AppShell
      role="student"
      name={profile.full_name}
      email={profile.email ?? user.email ?? ""}
      badgeCounts={{ checkins: badge }}
    >
      {children}
    </AppShell>
  );
}
