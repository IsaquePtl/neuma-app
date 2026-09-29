import { cache } from "react";

import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  BillingPlan,
  SubscriptionStatus,
} from "@/lib/types/database.types";

/** Estados da Stripe que dao acesso sem reservas. */
const HEALTHY: readonly SubscriptionStatus[] = ["active", "trialing"];

export const DEFAULT_GRACE_DAYS = 7;

export type AccessReason =
  | "billing_disabled"
  | "mentor"
  | "exempt"
  | "grandfathered"
  | "subscription"
  | "grace"
  | "none";

export type SubscriptionSummary = {
  id: string;
  plan: BillingPlan | null;
  status: SubscriptionStatus;
  unitAmount: number | null;
  currency: string;
  interval: string | null;
  intervalCount: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  collectionPaused: boolean;
  pastDueSince: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  stripeSubscriptionId: string;
};

export type AccessState = {
  /** Interruptor NEUMA_BILLING_ENABLED. Desligado = app como antes. */
  billingEnabled: boolean;
  hasAccess: boolean;
  reason: AccessReason;
  subscription: SubscriptionSummary | null;
  /** Fim da tolerancia, quando o acesso vem de um pagamento em atraso. */
  graceEndsAt: string | null;
};

export function isBillingEnabled(): boolean {
  const raw = process.env.NEUMA_BILLING_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

type BillingSettings = {
  cutoff: Date | null;
  graceDays: number;
};

function parseCutoff(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw || raw === "null") return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseGraceDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_GRACE_DAYS;
}

/**
 * Cutoff and grace come from finance_settings, the same rows has_app_access()
 * reads. Students have no SELECT on that table, so this uses the service role
 * and fails closed when the key is missing — a silent fallback used to
 * grandfather every account.
 *
 * NEUMA_PAYWALL_START_AT still wins, so localhost can exercise the paywall
 * without writing the shared database.
 */
async function loadBillingSettings(): Promise<BillingSettings> {
  const fromEnv = process.env.NEUMA_PAYWALL_START_AT?.trim();
  const envCutoff = fromEnv ? parseCutoff(fromEnv) : null;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error(
      "Paywall activo mas falta SUPABASE_SERVICE_ROLE_KEY para ler finance_settings.",
    );
  }

  const { data, error } = await admin
    .from("finance_settings")
    .select("key, value")
    .in("key", ["paywall_start_at", "past_due_grace_days"]);
  if (error) {
    throw new Error(`Não foi possível ler finance_settings: ${error.message}`);
  }

  const map = new Map((data ?? []).map((row) => [row.key, row.value]));
  return {
    cutoff: envCutoff ?? parseCutoff(map.get("paywall_start_at")),
    graceDays: parseGraceDays(map.get("past_due_grace_days")),
  };
}

function toSummary(row: {
  id: string;
  plan: BillingPlan | null;
  status: SubscriptionStatus;
  unit_amount: number | null;
  currency: string;
  interval: string | null;
  interval_count: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  collection_paused: boolean;
  past_due_since: string | null;
  card_brand: string | null;
  card_last4: string | null;
  stripe_subscription_id: string;
}): SubscriptionSummary {
  return {
    id: row.id,
    plan: row.plan,
    status: row.status,
    unitAmount: row.unit_amount,
    currency: row.currency,
    interval: row.interval,
    intervalCount: row.interval_count,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    collectionPaused: row.collection_paused,
    pastDueSince: row.past_due_since,
    cardBrand: row.card_brand,
    cardLast4: row.card_last4,
    stripeSubscriptionId: row.stripe_subscription_id,
  };
}

/**
 * Subscricao mais relevante do utilizador autenticado.
 *
 * Ordena por estado e nao por data: uma conta que cancelou e voltou a
 * subscrever tem duas linhas, e queremos a que da acesso.
 */
export const getMySubscription = cache(
  async (): Promise<SubscriptionSummary | null> => {
    const user = await getSessionUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("subscriptions")
      .select(
        "id, plan, status, unit_amount, currency, interval, interval_count, current_period_end, cancel_at_period_end, collection_paused, past_due_since, card_brand, card_last4, stripe_subscription_id, created_at",
      )
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });

    const rows = data ?? [];
    if (rows.length === 0) return null;

    const rank = (status: SubscriptionStatus) => {
      if (HEALTHY.includes(status)) return 0;
      if (status === "past_due") return 1;
      if (status === "paused" || status === "unpaid") return 2;
      return 3;
    };

    const best = [...rows].sort((a, b) => rank(a.status) - rank(b.status))[0];
    return toSummary(best);
  },
);

/** Estado de acesso do utilizador autenticado, cacheado por request. */
export const getAccessState = cache(async (): Promise<AccessState> => {
  const billingEnabled = isBillingEnabled();

  const base: AccessState = {
    billingEnabled,
    hasAccess: true,
    reason: "billing_disabled",
    subscription: null,
    graceEndsAt: null,
  };

  if (!billingEnabled) return base;

  const profile = await getCurrentProfile();
  if (!profile) {
    return { ...base, hasAccess: false, reason: "none" };
  }

  const subscription = await getMySubscription();

  if (profile.role === "mentor") {
    return { ...base, reason: "mentor", subscription };
  }

  // O perfil de sessao nao traz billing_exempt; lemos so o que falta.
  const supabase = await createClient();
  const { data: flags } = await supabase
    .from("profiles")
    .select("billing_exempt")
    .eq("id", profile.id)
    .maybeSingle();

  if (flags?.billing_exempt) {
    return { ...base, reason: "exempt", subscription };
  }

  const settings = await loadBillingSettings();
  if (!settings.cutoff) {
    return { ...base, reason: "grandfathered", subscription };
  }
  if (profile.created_at && new Date(profile.created_at) < settings.cutoff) {
    return { ...base, reason: "grandfathered", subscription };
  }

  if (subscription && HEALTHY.includes(subscription.status)) {
    return { ...base, reason: "subscription", subscription };
  }

  if (subscription?.status === "past_due") {
    const since = subscription.pastDueSince
      ? new Date(subscription.pastDueSince)
      : new Date();
    const ends = new Date(since);
    ends.setDate(ends.getDate() + settings.graceDays);
    if (ends > new Date()) {
      return {
        ...base,
        reason: "grace",
        subscription,
        graceEndsAt: ends.toISOString(),
      };
    }
  }

  return {
    ...base,
    hasAccess: false,
    reason: "none",
    subscription,
  };
});
