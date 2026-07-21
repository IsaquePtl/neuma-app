import { redirect } from "next/navigation";

import { NeumaLogo } from "@/components/neuma-logo";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.role === "mentor") redirect("/studio");
  if (profile?.onboarding_completed) redirect("/path");

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="neuma-hairline" />
      <header className="mx-auto flex w-full max-w-2xl items-center px-6 py-6">
        <NeumaLogo />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-6">
        {children}
      </main>
    </div>
  );
}
