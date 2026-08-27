import Image from "next/image";
import { redirect } from "next/navigation";

import { SignupWelcome } from "@/components/signup-welcome";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { ProfileGender } from "@/lib/types/database.types";

export default async function SignupWelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, gender")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex w-full flex-col items-center desktop:items-stretch">
      <Image
        src="/brand/mark-white.png"
        alt="Neuma"
        width={96}
        height={96}
        priority
        className="auth-mobile-mark mb-6 h-20 w-20 animate-float desktop:hidden"
      />

      <Card className="auth-enter-form w-full animate-fade-up p-7 sm:p-8">
        <SignupWelcome
          fullName={profile?.full_name ?? null}
          gender={(profile?.gender as ProfileGender | null) ?? null}
        />
      </Card>
    </div>
  );
}
