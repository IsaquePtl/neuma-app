"use client";

import { useState } from "react";

import { getBrowserAppOrigin } from "@/lib/auth/app-origin";
import {
  parseAge,
  parseGender,
  type SignupProfileDraft,
  writeSignupProfileDraft,
} from "@/lib/auth/signup-profile";
import {
  setSignupFinishingCookie,
  writeSignupWizardStep,
} from "@/lib/auth/signup-wizard";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type OAuthProvider = "google" | "apple";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("size-5", className)}>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("size-5", className)}>
      <path
        fill="currentColor"
        d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </svg>
  );
}

const OAUTH_BUTTON_CLASS =
  "h-12 w-full gap-3 border border-white/12 bg-white/[0.06] text-base font-medium text-foreground hover:bg-white/12";

export function OAuthSignInButtons({
  intent = "login",
  nextPath = "/",
  dividerLabel = "ou continuar com",
  getSignupDraft,
  onBeforeRedirect,
}: {
  intent?: "login" | "signup";
  nextPath?: string;
  dividerLabel?: string;
  getSignupDraft?: () => SignupProfileDraft | null;
  /** Chamado antes do redirect OAuth (ex.: guardar passo do wizard). */
  onBeforeRedirect?: () => void;
} = {}) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: OAuthProvider) {
    setPending(provider);
    setError(null);

    if (intent === "signup") {
      if (!getSignupDraft) {
        setPending(null);
        setError("Preenche o formulário antes de continuar.");
        return;
      }
      const draft = getSignupDraft();
      if (!draft) {
        setPending(null);
        setError("Preenche nome, idade e sexo antes de continuar com Google.");
        return;
      }
      writeSignupProfileDraft(draft);
      writeSignupWizardStep("profile");
      setSignupFinishingCookie();
      onBeforeRedirect?.();
    }

    const supabase = createClient();
    const redirectTo = `${getBrowserAppOrigin()}/auth/callback?intent=${intent}&next=${encodeURIComponent(nextPath)}`;

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        ...(provider === "google"
          ? { queryParams: { prompt: "select_account" } }
          : {}),
        ...(provider === "apple" ? { scopes: "name email" } : {}),
      },
    });

    if (oauthError || !data?.url) {
      setPending(null);
      setError("Não foi possível iniciar sessão. Tenta outra opção.");
      return;
    }

    // iOS/Android PWA: redirect na mesma janela mantém regresso ao mesmo origin
    // (não há API web para OAuth 100% in-app sem browser chrome no iPhone).
    requestAnimationFrame(() => {
      window.location.assign(data.url);
    });
  }

  return (
    <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-sm text-muted-foreground">{dividerLabel}</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => signIn("google")}
          className={OAUTH_BUTTON_CLASS}
        >
          <GoogleIcon />
          {pending === "google" ? "A abrir…" : "Google"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled
          aria-disabled="true"
          title="Em breve"
          className={cn(OAUTH_BUTTON_CLASS, "cursor-not-allowed opacity-40")}
        >
          <AppleIcon />
          Apple
        </Button>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
    </div>
  );
}

export function buildSignupDraftFromFields(fields: {
  firstName: string;
  lastName: string;
  age: string;
  gender: string;
}): SignupProfileDraft | null {
  const firstName = fields.firstName.trim();
  const lastName = fields.lastName.trim();
  const age = parseAge(fields.age);
  const gender = parseGender(fields.gender);
  if (!firstName || !lastName || age == null || !gender) return null;
  return { firstName, lastName, age, gender };
}
