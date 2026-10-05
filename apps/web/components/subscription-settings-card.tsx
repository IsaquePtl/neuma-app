"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CreditCard,
  Ban,
  RotateCcw,
  ArrowRightLeft,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelMySubscription,
  changeMyPlan,
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

export type PaymentRow = {
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
  hideTitle = false,
}: {
  subscription: SubscriptionSummary | null;
  hideTitle?: boolean;
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
        {hideTitle ? null : (
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Subscrição
          </h2>
        )}
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
          {hideTitle ? null : (
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Subscrição
            </h2>
          )}
          <p
            className={cn(
              "text-sm text-muted-foreground",
              hideTitle ? null : "mt-1",
            )}
          >
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

      <div className="flex flex-col gap-2.5 desktop:flex-row desktop:flex-wrap">
        <Button
          render={<Link href="/settings/subscription/cartao" />}
          nativeButton={false}
          variant="secondary"
          disabled={pending}
          className="h-11 w-full gap-2 rounded-xl text-sm font-medium desktop:h-10 desktop:w-auto desktop:px-4"
        >
          <CreditCard className="size-4" />
          Actualizar cartão
        </Button>

        {!subscription.cancelAtPeriodEnd && subscription.plan !== "one_to_one" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="h-11 w-full gap-2 rounded-xl text-sm font-medium desktop:h-10 desktop:w-auto desktop:px-4"
            onClick={() => setChangingPlan((v) => !v)}
          >
            <ArrowRightLeft className="size-4" />
            Mudar plano
          </Button>
        ) : null}

        {subscription.cancelAtPeriodEnd ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="h-11 w-full gap-2 rounded-xl text-sm font-medium desktop:h-10 desktop:w-auto desktop:px-4"
            onClick={() =>
              run(reactivateMySubscription, "Subscrição reactivada.")
            }
          >
            <RotateCcw className="size-4" />
            Reactivar
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="h-11 w-full gap-2 rounded-xl text-sm font-medium text-destructive hover:text-destructive desktop:h-10 desktop:w-auto desktop:px-4"
            onClick={() => setConfirmCancel(true)}
          >
            <Ban className="size-4" />
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
    </section>
  );
}

export function PaymentHistoryCard({ payments }: { payments: PaymentRow[] }) {
  return (
    <section className="flex min-h-[16rem] flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:min-h-[20rem]">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        Histórico de pagamentos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Recibos e cobranças da tua subscrição.
      </p>

      {payments.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Ainda não há pagamentos registados.
        </p>
      ) : (
        <ul className="mt-5 flex-1 divide-y divide-white/10">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">
                  {p.paid_at
                    ? new Date(p.paid_at).toLocaleDateString("pt-PT", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.status === "succeeded" || p.status === "paid"
                    ? "Pago"
                    : (p.status ?? "Pagamento")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  {formatEuros(p.amount_cents)}
                </span>
                {p.hosted_invoice_url ? (
                  <a
                    href={p.hosted_invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--neuma-coral)]/35 bg-[var(--neuma-coral)]/10 px-3 text-sm font-medium text-[var(--neuma-coral)] transition-colors hover:border-[var(--neuma-coral)]/50 hover:bg-[var(--neuma-coral)]/15"
                  >
                    Recibo
                    <ExternalLink className="size-3.5 opacity-80" />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
