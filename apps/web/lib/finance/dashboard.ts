import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripe } from "@/lib/stripe/client";
import { resolvePriceId } from "@/lib/stripe/prices";
import { FIXED_PLANS, getPlan } from "@/lib/stripe/plans";
import type { Bucket } from "@/lib/finance/range";

export type FinanceDashboardPeriod = {
  mrr_cents: number;
  arr_cents: number;
  revenue_cents: number;
  refunds_cents: number;
  net_revenue_cents: number;
  active_subscribers: number;
  new_subscriptions: number;
  cancellations: number;
  churn_rate: number;
  avg_ticket_cents: number;
};

export type FinanceDashboardSeriesPoint = {
  bucket: string;
  revenue_cents: number;
  refunds_cents: number;
  new_subs: number;
  cancellations: number;
};

export type FinanceDashboardByPlan = {
  plan: string;
  revenue_cents: number;
  count: number;
};

export type FinanceDashboardData = FinanceDashboardPeriod & {
  prev: FinanceDashboardPeriod;
  series: FinanceDashboardSeriesPoint[];
  by_plan: FinanceDashboardByPlan[];
};

const EMPTY_PERIOD: FinanceDashboardPeriod = {
  mrr_cents: 0,
  arr_cents: 0,
  revenue_cents: 0,
  refunds_cents: 0,
  net_revenue_cents: 0,
  active_subscribers: 0,
  new_subscriptions: 0,
  cancellations: 0,
  churn_rate: 0,
  avg_ticket_cents: 0,
};

export const EMPTY_FINANCE_DASHBOARD: FinanceDashboardData = {
  ...EMPTY_PERIOD,
  prev: EMPTY_PERIOD,
  series: [],
  by_plan: [],
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toPeriod(raw: unknown): FinanceDashboardPeriod {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    mrr_cents: num(r.mrr_cents),
    arr_cents: num(r.arr_cents),
    revenue_cents: num(r.revenue_cents),
    refunds_cents: num(r.refunds_cents),
    net_revenue_cents: num(r.net_revenue_cents),
    active_subscribers: num(r.active_subscribers),
    new_subscriptions: num(r.new_subscriptions),
    cancellations: num(r.cancellations),
    churn_rate: num(r.churn_rate),
    avg_ticket_cents: num(r.avg_ticket_cents),
  };
}

function toSeriesPoint(raw: unknown): FinanceDashboardSeriesPoint {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    bucket: str(r.bucket),
    revenue_cents: num(r.revenue_cents),
    refunds_cents: num(r.refunds_cents),
    new_subs: num(r.new_subs),
    cancellations: num(r.cancellations),
  };
}

function toByPlan(raw: unknown): FinanceDashboardByPlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    plan: str(r.plan, "desconhecido"),
    revenue_cents: num(r.revenue_cents),
    count: num(r.count),
  };
}

export async function loadFinanceDashboard(
  from: Date,
  to: Date,
  bucket: Bucket,
): Promise<FinanceDashboardData> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("finance_dashboard", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_bucket: bucket,
      p_tz: "Europe/Lisbon",
    });
    if (error) throw error;

    const raw = (data ?? {}) as Record<string, unknown>;
    return {
      ...toPeriod(raw),
      prev: toPeriod(raw.prev),
      series: Array.isArray(raw.series) ? raw.series.map(toSeriesPoint) : [],
      by_plan: Array.isArray(raw.by_plan) ? raw.by_plan.map(toByPlan) : [],
    };
  } catch (error) {
    console.error("[finance:dashboard]", error);
    return EMPTY_FINANCE_DASHBOARD;
  }
}

export type FinanceSettings = {
  paywallStartAt: string | null;
  pastDueGraceDays: number;
  mrrGoalCents: number | null;
};

export async function loadFinanceSettings(): Promise<FinanceSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("finance_settings")
    .select("key, value");

  const map = new Map((data ?? []).map((row) => [row.key, row.value]));
  const mrrGoalRaw = map.get("mrr_goal_cents");
  const graceRaw = map.get("past_due_grace_days");

  return {
    paywallStartAt:
      typeof map.get("paywall_start_at") === "string"
        ? (map.get("paywall_start_at") as string)
        : null,
    pastDueGraceDays: typeof graceRaw === "number" ? graceRaw : 7,
    mrrGoalCents: typeof mrrGoalRaw === "number" ? mrrGoalRaw : null,
  };
}

export type StripeDiagnosticCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type StripeDiagnostics = {
  ok: boolean;
  checks: StripeDiagnosticCheck[];
};

/** Verificações rápidas de saúde da integração Stripe, para o painel do Studio. */
export async function diagnoseStripe(): Promise<StripeDiagnostics> {
  const checks: StripeDiagnosticCheck[] = [];

  const hasSecretKey = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  checks.push({
    key: "secret_key",
    label: "STRIPE_SECRET_KEY",
    ok: hasSecretKey,
    detail: hasSecretKey
      ? "Configurada."
      : "Não configurada — pagamentos e sincronização não funcionam.",
  });

  const hasWebhookSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  checks.push({
    key: "webhook_secret",
    label: "STRIPE_WEBHOOK_SECRET",
    ok: hasWebhookSecret,
    detail: hasWebhookSecret
      ? "Configurada."
      : "Não configurada — os webhooks não são validados.",
  });

  if (!hasSecretKey) {
    for (const plan of FIXED_PLANS) {
      const expected = getPlan(plan);
      checks.push({
        key: `price_${plan}`,
        label: `Preço ${expected.label}`,
        ok: false,
        detail: "Sem STRIPE_SECRET_KEY não é possível verificar.",
      });
    }
    checks.push({
      key: "webhook_events",
      label: "Último evento Stripe",
      ok: false,
      detail: "Sem chave configurada.",
    });
    return { ok: false, checks };
  }

  for (const plan of FIXED_PLANS) {
    const expected = getPlan(plan);
    try {
      const priceId = await resolvePriceId(plan);
      const stripe = requireStripe();
      const price = await stripe.prices.retrieve(priceId);
      const matches =
        Boolean(price.active) && price.unit_amount === expected.amountCents;
      checks.push({
        key: `price_${plan}`,
        label: `Preço ${expected.label}`,
        ok: matches,
        detail: matches
          ? `${priceId} · ${(expected.amountCents / 100).toFixed(2)} €`
          : `Divergência: app espera ${expected.amountCents} cêntimos, Stripe devolve ${price.unit_amount} (${price.active ? "activo" : "arquivado"}).`,
      });
    } catch (error) {
      checks.push({
        key: `price_${plan}`,
        label: `Preço ${expected.label}`,
        ok: false,
        detail:
          error instanceof Error ? error.message : "Erro a resolver o preço.",
      });
    }
  }

  try {
    const admin = createAdminClient();
    const { data: lastEvent } = await admin
      .from("stripe_events")
      .select("type, received_at")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    checks.push({
      key: "webhook_events",
      label: "Último evento Stripe",
      ok: Boolean(lastEvent),
      detail: lastEvent
        ? `${lastEvent.type} · ${new Date(lastEvent.received_at).toLocaleString("pt-PT")}`
        : "Ainda não chegou nenhum evento por webhook.",
    });
  } catch (error) {
    checks.push({
      key: "webhook_events",
      label: "Último evento Stripe",
      ok: false,
      detail: error instanceof Error ? error.message : "Erro a consultar eventos.",
    });
  }

  return { ok: checks.every((c) => c.ok), checks };
}
