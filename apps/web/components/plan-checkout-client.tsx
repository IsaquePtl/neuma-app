"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createCheckoutSession } from "@/lib/actions/billing";
import type { FixedPlan } from "@/lib/stripe/plans";

/** Fallback se alguém aterrar em /subscrever/checkout (ex. link antigo). */
export function PlanCheckoutClient({
  plan,
  backHref,
}: {
  plan: FixedPlan;
  backHref: string;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await createCheckoutSession(plan, {
          cancelPath: backHref,
        });
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          return;
        }
        window.location.assign(result.url);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível iniciar o pagamento.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, backHref]);

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar aos planos
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return null;
}
