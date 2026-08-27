import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  getCurrentProfile,
  getSessionUser,
  getStudentNavBadge,
} from "@/lib/auth/session";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [profile, badge] = await Promise.all([
    getCurrentProfile(),
    getStudentNavBadge(user.id),
  ]);

  if (profile?.role === "mentor") redirect("/studio");
  if (profile?.role !== "student") {
    redirect("/login?error=perfil-invalido");
  }

  return (
    <Suspense fallback={null}>
      <AppShell
        role="student"
        name={profile.full_name}
        email={profile.email ?? user.email ?? ""}
        avatarUrl={profile.avatar_url}
        badgeCounts={{ checkins: badge }}
      >
        {children}
      </AppShell>
    </Suspense>
  );
}
