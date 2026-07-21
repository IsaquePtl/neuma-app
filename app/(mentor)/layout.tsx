import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function MentorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "mentor") redirect("/");

  return (
    <AppShell
      role="mentor"
      name={profile.full_name}
      email={profile.email ?? user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
