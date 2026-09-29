"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { finalizeCheckoutSession } from "@/lib/actions/billing";
import {
  clearSignupFinishingCookie,
  clearSignupWizardStep,
  hasSignupFinishingCookie,
  readSignupWizardStep,
  setSignupFinishingCookie,
  writeSignupWizardStep,
} from "@/lib/auth/signup-wizard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SignupProfileStep } from "@/components/signup-profile-step";

export function CheckoutSuccessClient({
  sessionId,
  oneToOne = false,
  displayName = null,
}: {
  sessionId: string | null;
  oneToOne?: boolean;
  displayName?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  /** 1:1 — perfil logo de seguida (como passo 4 do signup), sem ecrã intermédio. */
  const [oneToOneReady, setOneToOneReady] = useState(oneToOne);

  useEffect(() => {
    if (!sessionId || attempted) return;
    setAttempted(true);

    startTransition(async () => {
      const result = await finalizeCheckoutSession(sessionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (oneToOne) {
        setOneToOneReady(true);
        return;
      }

      // Signup em curso: após pagamento → definir password (passo 3).
      const resumeSignup =
        hasSignupFinishingCookie() || readSignupWizardStep() === "plan";
      if (resumeSignup) {
        writeSignupWizardStep("credentials");
        setSignupFinishingCookie();
        router.replace("/login/signup");
        router.refresh();
        return;
      }

      clearSignupFinishingCookie();
      clearSignupWizardStep();
      router.replace("/home?welcome=1");
      router.refresh();
    });
  }, [sessionId, attempted, router, oneToOne]);

  if (oneToOne && oneToOneReady && !error) {
    return (
      <div className="flex w-full flex-col items-center auth-flow-instant desktop:items-stretch">
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
      </div>
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
              setAttempted(false);
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
