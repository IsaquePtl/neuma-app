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

  return (
    <AppShell
      role="student"
      name={profile.full_name}
      email={profile.email ?? user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
