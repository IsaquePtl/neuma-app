"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createCardUpdateSession } from "@/lib/actions/billing";

export function CardUpdateCheckoutClient() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await createCardUpdateSession();
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
            : "Não foi possível actualizar o cartão.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/settings/subscription"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar à subscrição
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return null;
}
