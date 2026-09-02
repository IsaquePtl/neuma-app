"use client";

import { useState, useTransition } from "react";
import {
  CreditCard,
  RefreshCw,
  Ban,
  RotateCcw,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelMySubscription,
  changeMyPlan,
  createCardUpdateSession,
  previewPlanChange,
  reactivateMySubscription,
} from "@/lib/actions/billing";
import type { SubscriptionSummary } from "@/lib/billing/access";
import {
  formatEuros,
  getPlans,
  type FixedPlan,
} from "@/lib/stripe/plans";
import { billingPlanLabel, subscriptionStatusLabel } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  status: string | null;
  hosted_invoice_url: string | null;
  plan: string | null;
};

export function SubscriptionSettingsCard({
  subscription,
  payments,
}: {
  subscription: SubscriptionSummary | null;
  payments: PaymentRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [preview, setPreview] = useState<{
    plan: FixedPlan;
    amountDueCents: number;
  } | null>(null);

  if (!subscription) {
    return (
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Subscrição
        </h2>
        <p className="text-sm text-muted-foreground">
          Ainda não tens um plano activo.
        </p>
        <a
          href="/subscrever"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Escolher plano
        </a>
      </section>
    );
  }

  const planLabel = subscription.plan
    ? billingPlanLabel[subscription.plan]
    : "Plano";
  const statusLabel = subscriptionStatusLabel[subscription.status];
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-PT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Algo correu mal.");
        return;
      }
      toast.success(okMsg);
      setConfirmCancel(false);
      setChangingPlan(false);
      setPreview(null);
      window.location.reload();
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Subscrição
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {planLabel}
            {subscription.unitAmount != null
              ? ` · ${formatEuros(subscription.unitAmount)}`
              : null}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            subscription.status === "active" || subscription.status === "trialing"
              ? "bg-[var(--neuma-lime)]/15 text-[var(--neuma-lime)]"
              : subscription.status === "past_due"
                ? "bg-[var(--neuma-coral)]/15 text-[var(--neuma-coral)]"
                : "bg-white/10 text-muted-foreground",
          )}
        >
          {statusLabel}
        </span>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {periodEnd ? (
          <div>
            <dt className="text-muted-foreground">
              {subscription.cancelAtPeriodEnd
                ? "Acesso até"
                : "Próxima cobrança"}
            </dt>
            <dd className="font-medium">{periodEnd}</dd>
          </div>
        ) : null}
        {subscription.cardBrand && subscription.cardLast4 ? (
          <div>
            <dt className="text-muted-foreground">Cartão</dt>
            <dd className="font-medium capitalize">
              {subscription.cardBrand} ···· {subscription.cardLast4}
            </dd>
          </div>
        ) : null}
      </dl>

      {subscription.cancelAtPeriodEnd ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-muted-foreground">
          A subscrição está marcada para cancelar no fim do período. Continuas
          com acesso até {periodEnd}.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          className="gap-1.5"
          onClick={() =>
            run(async () => {
              const r = await createCardUpdateSession();
              if (r.ok) {
                window.location.assign(r.url);
                return { ok: true };
              }
              return r;
            }, "A abrir actualização do cartão…")
          }
        >
          <CreditCard className="size-3.5" />
          Actualizar cartão
        </Button>

        {!subscription.cancelAtPeriodEnd ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            className="gap-1.5"
            onClick={() => setChangingPlan((v) => !v)}
          >
            <ArrowRightLeft className="size-3.5" />
            Mudar plano
          </Button>
        ) : null}

        {subscription.cancelAtPeriodEnd ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            className="gap-1.5"
            onClick={() =>
              run(reactivateMySubscription, "Subscrição reactivada.")
            }
          >
            <RotateCcw className="size-3.5" />
            Reactivar
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setConfirmCancel(true)}
          >
            <Ban className="size-3.5" />
            Cancelar
          </Button>
        )}
      </div>

      {confirmCancel ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium">Tens a certeza?</p>
          <p className="text-sm text-muted-foreground">
            Continuas com acesso até ao fim do período já pago
            {periodEnd ? ` (${periodEnd})` : ""}. Podes reactivar até lá.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(cancelMySubscription, "Cancelamento agendado.")
              }
            >
              Confirmar cancelamento
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmCancel(false)}
            >
              Manter plano
            </Button>
          </div>
        </div>
      ) : null}

      {changingPlan ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium">Escolhe o novo plano</p>
          <div className="space-y-2">
            {getPlans()
              .filter((p) => p.plan !== subscription.plan)
              .map((plan) => (
                <button
                  key={plan.plan}
                  type="button"
                  disabled={pending}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm hover:border-[var(--neuma-coral)]/40"
                  onClick={() => {
                    startTransition(async () => {
                      const r = await previewPlanChange(plan.plan);
                      if (!r.ok) {
                        toast.error(r.error);
                        return;
                      }
                      setPreview({
                        plan: plan.plan,
                        amountDueCents: r.amountDueCents,
                      });
                    });
                  }}
                >
                  <span>{plan.label}</span>
                  <span className="font-medium">
                    {formatEuros(plan.amountCents)}
                  </span>
                </button>
              ))}
          </div>
          {preview ? (
            <div className="space-y-2 rounded-lg bg-white/[0.04] p-3 text-sm">
              <p>
                Ajuste imediato:{" "}
                <strong>
                  {preview.amountDueCents === 0
                    ? "nada a pagar agora"
                    : formatEuros(preview.amountDueCents)}
                </strong>
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => changeMyPlan(preview.plan),
                      "Plano actualizado.",
                    )
                  }
                >
                  Confirmar mudança
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreview(null)}
                >
                  Voltar
                </Button>
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setChangingPlan(false);
              setPreview(null);
            }}
          >
            Fechar
          </Button>
        </div>
      ) : null}

      {payments.length > 0 ? (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="size-3.5 text-muted-foreground" />
            Histórico de pagamentos
          </div>
          <ul className="space-y-1.5">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-muted-foreground">
                  {p.paid_at
                    ? new Date(p.paid_at).toLocaleDateString("pt-PT")
                    : "—"}
                </span>
                <span className="font-medium">
                  {formatEuros(p.amount_cents)}
                </span>
                {p.hosted_invoice_url ? (
                  <a
                    href={p.hosted_invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--neuma-coral)] hover:underline"
                  >
                    Recibo
                  </a>
                ) : (
                  <span className="w-12" />
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
