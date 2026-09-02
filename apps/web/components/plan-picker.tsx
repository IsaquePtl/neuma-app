"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { createCheckoutSession } from "@/lib/actions/billing";
import {
  formatEuros,
  getPlans,
  monthlyEquivalentCents,
  savingsPercent,
  type FixedPlan,
} from "@/lib/stripe/plans";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PLANS = getPlans();

export function PlanPicker({
  title = "Escolhe o teu plano",
  subtitle = "Sem período experimental. Pagas e entras.",
  cancelled = false,
}: {
  title?: string;
  subtitle?: string;
  cancelled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<FixedPlan>("quarterly");
  const [error, setError] = useState<string | null>(null);

  function onContinue() {
    setError(null);
    startTransition(async () => {
      const result = await createCheckoutSession(selected);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.assign(result.url);
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {cancelled ? (
        <p
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          Cancelaste o pagamento. Escolhe um plano quando estiveres pronto.
        </p>
      ) : null}

      <div className="space-y-3">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.plan;
          const save = savingsPercent(plan);
          const perMonth = monthlyEquivalentCents(plan);

          return (
            <button
              key={plan.plan}
              type="button"
              onClick={() => setSelected(plan.plan)}
              disabled={pending}
              className={cn(
                "relative w-full rounded-2xl border px-4 py-4 text-left transition",
                "hover:border-[var(--neuma-coral)]/40",
                isSelected
                  ? "border-[var(--neuma-coral)]/50 bg-[var(--neuma-coral)]/[0.08]"
                  : "border-white/10 bg-white/[0.03]",
              )}
            >
              {plan.highlight ? (
                <span className="absolute -top-2.5 right-4 rounded-full bg-[var(--neuma-coral)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                  Recomendado
                </span>
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-lg font-semibold tracking-tight">
                      {plan.label}
                    </span>
                    {save > 0 ? (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-[var(--neuma-lime)]">
                        −{save}%
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {plan.cadence}
                    {plan.months > 1
                      ? ` · ${formatEuros(perMonth)}/mês`
                      : null}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="font-heading text-xl font-semibold tracking-tight">
                      {formatEuros(plan.amountCents)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-full border",
                      isSelected
                        ? "border-[var(--neuma-coral)] bg-[var(--neuma-coral)] text-black"
                        : "border-white/20",
                    )}
                    aria-hidden
                  >
                    {isSelected ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={onContinue}
        className="h-14 w-full bg-[var(--neuma-orange)] text-base font-semibold text-white hover:bg-[var(--neuma-orange)]/90"
      >
        {pending ? "A abrir o pagamento…" : "Continuar para pagar"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Pagamento seguro pela Stripe. Podes cancelar a qualquer momento no
        perfil.
      </p>
    </div>
  );
}
