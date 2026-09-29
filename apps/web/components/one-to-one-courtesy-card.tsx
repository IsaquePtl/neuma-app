"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  grantOneToOneCourtesy,
  revokeOneToOneCourtesy,
} from "@/lib/actions/finance";

export function OneToOneCourtesyCard({
  profileId,
  isOneToOne,
  accessUntil,
}: {
  profileId: string;
  isOneToOne: boolean;
  accessUntil: string | null;
}) {
  const [until, setUntil] = useState(() => {
    if (!accessUntil) return "";
    const date = new Date(accessUntil);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open =
    isOneToOne && !!accessUntil && new Date(accessUntil) > new Date();

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">Neuma 1:1</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {open
            ? `Cortesia activa até ${new Date(accessUntil!).toLocaleDateString("pt-PT")}. Sem cobrança Stripe.`
            : "Sem acesso 1:1. Concede uma data de fim para este aluno entrar sem pagar."}
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await grantOneToOneCourtesy(profileId, until);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        <label className="grid gap-1 text-xs text-muted-foreground">
          Acesso até
          <DatePicker
            required
            value={until}
            onValueChange={setUntil}
            className="w-[10.75rem]"
          />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "A guardar…" : "Conceder 1:1"}
        </Button>
        {open ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await revokeOneToOneCourtesy(profileId);
                if (!result.ok) setError(result.error);
              });
            }}
          >
            Revogar
          </Button>
        ) : null}
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </Card>
  );
}
