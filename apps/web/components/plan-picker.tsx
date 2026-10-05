"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import {
  createCheckoutSession,
  createSignupLeadCheckoutSession,
} from "@/lib/actions/billing";
import {
  setSignupFinishingCookie,
  writeSignupWizardStep,
} from "@/lib/auth/signup-wizard";
import {
  formatEuros,
  getPlans,
  savingsPercent,
  type FixedPlan,
} from "@/lib/stripe/plans";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PLANS = getPlans();

export function PlanPicker({
  title = "Escolhe o teu plano",
  subtitle,
  cancelReturnPath,
  notice,
  signupResumeToken = null,
}: {
  title?: string;
  subtitle?: string;
  /** Where cancel na Stripe deve aterrar. */
  cancelReturnPath?: string;
  /** Optional status for lapsed/canceled subscriptions only. */
  notice?: string | null;
  /** Signup email (lead): checkout sem sessão Auth. */
  signupResumeToken?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FixedPlan>("quarterly");

  // Voltar da Stripe (bfcache / histórico) — repor botão e estado idle.
  useEffect(() => {
    const resetCheckoutUi = () => {
      setPending(false);
      setError(null);
    };
    window.addEventListener("pageshow", resetCheckoutUi);
    return () => window.removeEventListener("pageshow", resetCheckoutUi);
  }, []);

  async function onContinue() {
    if (pending) return;

    const from =
      cancelReturnPath?.startsWith("/") && !cancelReturnPath.startsWith("//")
        ? cancelReturnPath
        : "/subscrever";

    if (from.startsWith("/login/signup")) {
      setSignupFinishingCookie();
      writeSignupWizardStep("plan");
    }

    setPending(true);
    setError(null);

    try {
      const result = signupResumeToken
        ? await createSignupLeadCheckoutSession(selected, signupResumeToken)
        : await createCheckoutSession(selected, {
            cancelPath: from,
          });
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.assign(result.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar o pagamento.",
      );
      setPending(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      {notice ? (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <div className="space-y-3">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.plan;
          const save = savingsPercent(plan);

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
                    {isSelected ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : null}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={() => void onContinue()}
          className="h-14 w-full bg-[var(--neuma-orange)] text-base font-semibold text-white hover:bg-[var(--neuma-orange)]/90"
        >
          Continuar para pagar
        </Button>

        {error ? (
          <p className="text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Pagamento seguro pela Stripe. Podes cancelar a qualquer momento no
        perfil.
      </p>
    </div>
  );
}
