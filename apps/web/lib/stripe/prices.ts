import "server-only";

import type Stripe from "stripe";

import { requireStripe } from "@/lib/stripe/client";
import {
  FIXED_PLANS,
  PLAN_LOOKUP_KEYS,
  getPlan,
  planFromRecurring,
  type FixedPlan,
} from "@/lib/stripe/plans";
import type { BillingPlan } from "@/lib/types/database.types";

/**
 * Resolucao de precos da Stripe.
 *
 * Ordem de preferencia:
 *   1. lookup_key (auto-reparavel: sobrevive a edicoes de preco no Dashboard)
 *   2. variavel de ambiente STRIPE_PRICE_* (escape manual)
 *
 * A lookup_key vem primeiro de proposito. Um price id guardado no ambiente
 * fica invalido no momento em que alguem edita o valor no Dashboard, porque
 * a Stripe arquiva o preco antigo e cria um novo. A lookup_key e transferida
 * para o preco novo e continua a resolver.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { priceId: string; expiresAt: number };
const cache = new Map<FixedPlan, CacheEntry>();

function envPriceId(plan: FixedPlan): string | null {
  const raw =
    plan === "monthly"
      ? process.env.STRIPE_PRICE_MONTHLY
      : plan === "quarterly"
        ? process.env.STRIPE_PRICE_QUARTERLY
        : process.env.STRIPE_PRICE_ANNUAL;
  return raw?.trim() || null;
}

export async function resolvePriceId(plan: FixedPlan): Promise<string> {
  const cached = cache.get(plan);
  if (cached && cached.expiresAt > Date.now()) return cached.priceId;

  const stripe = requireStripe();

  try {
    const found = await stripe.prices.list({
      lookup_keys: [PLAN_LOOKUP_KEYS[plan]],
      active: true,
      limit: 1,
    });
    const priceId = found.data[0]?.id;
    if (priceId) {
      cache.set(plan, { priceId, expiresAt: Date.now() + CACHE_TTL_MS });
      return priceId;
    }
  } catch (error) {
    console.error(`[stripe:prices] lookup_key falhou para ${plan}:`, error);
  }

  const fromEnv = envPriceId(plan);
  if (fromEnv) {
    cache.set(plan, { priceId: fromEnv, expiresAt: Date.now() + CACHE_TTL_MS });
    return fromEnv;
  }

  throw new Error(
    `Preco do plano ${plan} nao configurado. Define a lookup_key "${PLAN_LOOKUP_KEYS[plan]}" na Stripe ou a variavel de ambiente correspondente.`,
  );
}

/** Mapa price id -> plano, para o sync classificar subscricoes. */
export async function priceIdToPlanMap(): Promise<Map<string, FixedPlan>> {
  const map = new Map<string, FixedPlan>();
  for (const plan of FIXED_PLANS) {
    try {
      map.set(await resolvePriceId(plan), plan);
    } catch {
      // Plano nao configurado: o sync cai na deducao pela cadencia.
    }
  }
  return map;
}

/**
 * Classifica uma subscricao num dos nossos planos.
 *
 * Precos arquivados continuam ligados a subscricoes antigas e nao aparecem no
 * mapa de lookup_keys, por isso a deducao pela cadencia e o caminho normal e
 * nao uma excepcao.
 */
export async function planForPrice(
  price: Stripe.Price | null | undefined,
  options: { oneToOne?: boolean } = {},
): Promise<BillingPlan | null> {
  if (!price) return null;
  if (options.oneToOne || price.metadata?.neuma_plan === "one_to_one") {
    return "one_to_one";
  }

  const map = await priceIdToPlanMap();
  const direct = map.get(price.id);
  if (direct) return direct;

  return planFromRecurring(
    price.recurring?.interval,
    price.recurring?.interval_count,
  );
}

export type CatalogueIssue = {
  plan: FixedPlan;
  severity: "error" | "warning";
  message: string;
};

/**
 * Confronta o catalogo em codigo com a Stripe.
 *
 * Existe porque uma divergencia aqui e silenciosa e caramente: a app anuncia
 * 62,94 EUR a cada 3 meses e a Stripe cobra 62,94 EUR por mes. E mostrado no
 * modulo Financas.
 */
export async function verifyPlanCatalogue(): Promise<CatalogueIssue[]> {
  const stripe = requireStripe();
  const issues: CatalogueIssue[] = [];

  for (const plan of FIXED_PLANS) {
    const expected = getPlan(plan);

    let price: Stripe.Price | null = null;
    try {
      price = await stripe.prices.retrieve(await resolvePriceId(plan));
    } catch (error) {
      issues.push({
        plan,
        severity: "error",
        message: `Preco nao encontrado na Stripe: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      continue;
    }

    if (!price.active) {
      issues.push({
        plan,
        severity: "error",
        message: "O preco esta arquivado na Stripe.",
      });
    }
    if (price.unit_amount !== expected.amountCents) {
      issues.push({
        plan,
        severity: "error",
        message: `Valor diferente: a app mostra ${expected.amountCents} e a Stripe cobra ${price.unit_amount}.`,
      });
    }
    if (price.currency !== expected.currency) {
      issues.push({
        plan,
        severity: "error",
        message: `Moeda diferente: esperado ${expected.currency}, na Stripe ${price.currency}.`,
      });
    }
    if (price.recurring?.interval !== expected.interval) {
      issues.push({
        plan,
        severity: "error",
        message: `Periodicidade diferente: esperado ${expected.interval}, na Stripe ${price.recurring?.interval}.`,
      });
    }
    if ((price.recurring?.interval_count ?? 1) !== expected.intervalCount) {
      issues.push({
        plan,
        severity: "error",
        message: `Numero de periodos diferente: esperado ${expected.intervalCount}, na Stripe ${price.recurring?.interval_count}. Um trimestral configurado como mensal cobra tres vezes mais.`,
      });
    }
    if (price.tax_behavior === "unspecified") {
      issues.push({
        plan,
        severity: "warning",
        message:
          "tax_behavior esta em unspecified. Como os precos incluem IVA, devia estar em inclusive. So pode ser definido uma vez.",
      });
    }
    if (price.lookup_key !== PLAN_LOOKUP_KEYS[plan]) {
      issues.push({
        plan,
        severity: "warning",
        message: `Sem lookup_key "${PLAN_LOOKUP_KEYS[plan]}". Sem ela, editar o preco no Dashboard quebra a ligacao.`,
      });
    }
  }

  return issues;
}
