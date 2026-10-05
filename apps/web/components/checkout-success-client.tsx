"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { finalizeCheckoutSession } from "@/lib/actions/billing";
import { setSignupFinishingCookieAction } from "@/lib/actions/signup-finishing";
import {
  clearSignupFinishingCookie,
  clearSignupLeadToken,
  clearSignupWizardStep,
  hasSignupFinishingCookie,
  readSignupWizardStep,
  writeSignupWizardStep,
} from "@/lib/auth/signup-wizard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SignupProfileStep } from "@/components/signup-profile-step";

export function CheckoutSuccessClient({
  sessionId,
  oneToOne = false,
  displayName = null,
  signupLead = false,
}: {
  sessionId: string | null;
  oneToOne?: boolean;
  displayName?: string | null;
  /** Checkout veio do signup por lead (sem auth prévia). */
  signupLead?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  /** 1:1 — perfil logo de seguida (como passo 4 do signup), sem ecrã intermédio. */
  const [oneToOneReady, setOneToOneReady] = useState(oneToOne);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    setPending(true);
    setError(null);

    void (async () => {
      try {
        const result = await finalizeCheckoutSession(sessionId);
        if (cancelled) return;

        if (!result.ok) {
          setError(result.error);
          setPending(false);
          return;
        }

        if (oneToOne) {
          setOneToOneReady(true);
          setPending(false);
          return;
        }

        // Signup em curso: após pagamento → definir password (passo 3).
        const resumeSignup =
          signupLead ||
          result.resumeSignup ||
          hasSignupFinishingCookie() ||
          readSignupWizardStep() === "plan";

        if (resumeSignup) {
          clearSignupLeadToken();
          writeSignupWizardStep("credentials");
          // Cookie httpOnly tem de existir antes do middleware ver /login/signup.
          await setSignupFinishingCookieAction();
          if (cancelled) return;
          router.replace("/login/signup");
          router.refresh();
          return;
        }

        clearSignupFinishingCookie();
        clearSignupWizardStep();
        router.replace("/home?welcome=1");
        router.refresh();
      } catch (err) {
        if (cancelled) return;
        console.error("[checkout-success]", err);
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível confirmar o pagamento.",
        );
        setPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, retryKey, router, oneToOne, signupLead]);

  if (oneToOne && oneToOneReady && !error) {
    return (
      <Card className="auth-enter-form--instant w-full space-y-6 p-6 sm:p-8">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">4 de 4 — Perfil</p>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            O teu perfil
          </h1>
          <p className="text-sm text-muted-foreground">
            {pending
              ? "A confirmar o pagamento…"
              : "Pagamento confirmado. Completa o teu perfil para entrares na app."}
          </p>
        </div>
        <SignupProfileStep displayName={displayName} />
      </Card>
    );
  }

  if (!sessionId) {
    return (
      <Card className="auth-enter-form--instant w-full space-y-4 p-6 text-center sm:p-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Sessão em falta
        </h1>
        <p className="text-sm text-muted-foreground">
          Não encontrámos a referência do pagamento. Se já pagaste, entra
          normalmente — o acesso activa-se em segundos.
        </p>
        <a
          href="/home"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Ir para a app
        </a>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="auth-enter-form--instant w-full space-y-4 p-6 text-center sm:p-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          A confirmar o pagamento…
        </h1>
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
        <p className="text-sm text-muted-foreground">
          Se o pagamento foi bem-sucedido, o acesso activa-se em breve. Podes
          tentar outra vez ou ir directamente para a app.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              setRetryKey((k) => k + 1);
            }}
          >
            Tentar outra vez
          </Button>
          <a
            href="/home"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground"
          >
            Ir para a app
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="auth-enter-form--instant w-full space-y-3 p-6 text-center sm:p-8">
      <div className="mx-auto size-10 animate-pulse rounded-full bg-[var(--neuma-coral)]/30" />
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        Pagamento confirmado
      </h1>
      <p className="text-sm text-muted-foreground">A preparar a tua conta…</p>
    </Card>
  );
}
