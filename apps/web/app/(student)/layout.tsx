import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  getCurrentProfile,
  getSessionUser,
  getStudentNavBadge,
} from "@/lib/auth/session";
import { getAccessState } from "@/lib/billing/access";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [profile, badge, access] = await Promise.all([
    getCurrentProfile(),
    getStudentNavBadge(user.id),
    getAccessState(),
  ]);

  if (profile?.role === "mentor") redirect("/studio");
  if (profile?.role !== "student") {
    redirect("/login?error=perfil-invalido");
  }

  if (!access.hasAccess) {
    redirect("/subscrever");
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
        {access.reason === "grace" && access.graceEndsAt ? (
          <div className="border-b border-[var(--neuma-coral)]/30 bg-[var(--neuma-coral)]/10 px-4 py-2 text-center text-sm text-[var(--neuma-coral)]">
            O pagamento falhou. Actualiza o cartão nas definições até{" "}
            {new Date(access.graceEndsAt).toLocaleDateString("pt-PT")} para
            manter o acesso.
          </div>
        ) : null}
        {children}
      </AppShell>
    </Suspense>
  );
}
