import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";

/**
 * Só autenticação + perfil bloqueiam o shell.
 * Badges carregam no cliente (AppShell) para não atrasar o login.
 */
async function MentorShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (profile?.role !== "mentor") redirect("/");

  return (
    <AppShell
      role="mentor"
      name={profile.full_name}
      email={profile.email ?? user.email ?? ""}
      avatarUrl={profile.avatar_url}
      badgeCounts={{ checkins: 0, proposals: 0 }}
      hydrateBadges
    >
      {children}
    </AppShell>
  );
}

export default function MentorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <MentorShell>{children}</MentorShell>
    </Suspense>
  );
}
