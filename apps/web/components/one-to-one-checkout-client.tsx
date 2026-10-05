"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { startOneToOneCheckout } from "@/lib/actions/one-to-one";
import { oneToOneInvitePath } from "@/lib/one-to-one/invite-path";

/** Fallback se alguém aterrar em /subscrever/checkout?token=… */
export function OneToOneCheckoutClient({ token }: { token: string }) {
  const backHref = oneToOneInvitePath(token);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await startOneToOneCheckout({ token });
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
  }, [token]);

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar ao convite
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return null;
}
