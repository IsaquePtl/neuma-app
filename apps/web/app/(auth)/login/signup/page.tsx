import Image from "next/image";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/signup-form";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; profile?: string }>;
}) {
  const { error, profile } = await searchParams;
  const wantsProfileStep = profile === "1";

  let displayName: string | null = null;
  let profileStep = false;

  if (wantsProfileStep) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login/signup");
    }
    profileStep = true;
    const { data: row } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    displayName = row?.full_name ?? null;
  }

  return (
    <div
      className={
        profileStep
          ? "auth-flow-instant flex w-full flex-col items-center desktop:items-stretch"
          : "flex w-full flex-col items-center desktop:items-stretch"
      }
    >
      {!profileStep ? (
        <Image
          src="/brand/mark-white.png"
          alt="Neuma"
          width={96}
          height={96}
          priority
          className="auth-mobile-mark mb-6 h-20 w-20 animate-float desktop:hidden"
        />
      ) : null}

      <Card
        className={
          profileStep
            ? "auth-enter-form--instant w-full p-6 sm:p-8"
            : "auth-enter-form w-full animate-fade-up p-6 sm:p-8"
        }
      >
        <div className="mb-5">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {profileStep ? "O teu perfil" : "Criar conta"}
          </h1>
          {profileStep ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Foto e uma linha sobre ti — opcional.
            </p>
          ) : null}
        </div>
        <SignupForm
          error={error}
          initialStep={profileStep ? "profile" : "credentials"}
          displayName={displayName}
        />
      </Card>
    </div>
  );
}
