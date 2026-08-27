"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { completeSignupProfile } from "@/lib/actions/auth";
import {
  clearSignupProfileDraft,
  readSignupProfileDraft,
} from "@/lib/auth/signup-profile";
import {
  firstNameFromFullName,
  welcomeGreeting,
} from "@/lib/profile/greeting";
import type { ProfileGender } from "@/lib/types/database.types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignupWelcome({
  fullName,
  gender,
}: {
  fullName: string | null;
  gender: ProfileGender | null;
}) {
  const [greetingGender, setGreetingGender] = useState(gender);
  const [displayName, setDisplayName] = useState(
    firstNameFromFullName(fullName) ?? "aí",
  );
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function syncOAuthDraft() {
      const draft = readSignupProfileDraft();
      if (!draft) {
        if (!cancelled) setSyncing(false);
        return;
      }

      const result = await completeSignupProfile(draft);
      if (!cancelled) {
        if (result.ok) {
          clearSignupProfileDraft();
          setGreetingGender(draft.gender);
          setDisplayName(draft.firstName);
        }
        setSyncing(false);
      }
    }

    void syncOAuthDraft();
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = welcomeGreeting(greetingGender);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center desktop:text-left">
        <h1 className="font-heading text-2xl tracking-tight sm:text-3xl">
          <span className="font-normal">{greeting}, </span>
          <span className="font-bold">{displayName}</span>
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Conta criada. Queres começar com o onboarding Neuma 1:1, ou entrar
          directamente na app?
        </p>
      </div>

      <div className="space-y-3">
        <Link
          href="/onboarding"
          aria-disabled={syncing}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-14 w-full justify-between bg-[var(--neuma-orange)] text-base font-semibold text-white hover:bg-[var(--neuma-orange)]/90",
            syncing && "pointer-events-none opacity-50",
          )}
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4" />
            Onboarding Neuma 1:1
          </span>
          <ArrowRight className="size-4" />
        </Link>

        <Link
          href="/home"
          aria-disabled={syncing}
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "h-14 w-full justify-between border-white/12 bg-white/[0.06] text-base font-medium hover:bg-white/12",
            syncing && "pointer-events-none opacity-50",
          )}
        >
          Continuar para a app
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <p className="text-center text-xs text-muted-foreground desktop:text-left">
        O onboarding 1:1 ajuda o mentor a conhecer-te e a desenhar o teu
        percurso. Podes sempre fazê-lo mais tarde.
      </p>
    </div>
  );
}
