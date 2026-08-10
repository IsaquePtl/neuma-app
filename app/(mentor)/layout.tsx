import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  getCurrentProfile,
  getMentorNavBadge,
  getSessionUser,
} from "@/lib/auth/session";

export default async function MentorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [profile, badgeCount] = await Promise.all([
    getCurrentProfile(),
    getMentorNavBadge(),
  ]);

  if (profile?.role !== "mentor") redirect("/");

  return (
    <AppShell
      role="mentor"
      name={profile.full_name}
      email={profile.email ?? user.email ?? ""}
      avatarUrl={profile.avatar_url}
      badgeCounts={{ checkins: badgeCount }}
    >
      {children}
    </AppShell>
  );
}
