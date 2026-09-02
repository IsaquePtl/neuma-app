"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { finalizeCheckoutSession } from "@/lib/actions/billing";
import {
  clearSignupFinishingCookie,
  clearSignupWizardStep,
} from "@/lib/auth/signup-wizard";
import { Button } from "@/components/ui/button";

export function CheckoutSuccessClient({
  sessionId,
}: {
  sessionId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!sessionId || attempted) return;
    setAttempted(true);

    startTransition(async () => {
      const result = await finalizeCheckoutSession(sessionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearSignupFinishingCookie();
      clearSignupWizardStep();
      router.replace("/home?welcome=1");
      router.refresh();
    });
  }, [sessionId, attempted, router]);

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
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
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-3 text-center">
      <div className="mx-auto size-10 animate-pulse rounded-full bg-[var(--neuma-coral)]/30" />
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        Pagamento confirmado
      </h1>
      <p className="text-sm text-muted-foreground">
        A preparar a tua conta…
      </p>
    </div>
  );
}
