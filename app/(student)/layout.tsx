import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "student") {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader name={profile.full_name} subtitle="O teu percurso" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
