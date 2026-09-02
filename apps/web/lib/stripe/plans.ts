import type { BillingPlan } from "@/lib/types/database.types";

export type FixedPlan = Exclude<BillingPlan, "one_to_one">;

export const FIXED_PLANS: readonly FixedPlan[] = [
  "monthly",
  "quarterly",
  "annual",
] as const;

/**
 * Chaves estaveis na Stripe (lookup_key), a forma como o codigo se refere aos
 * precos.
 *
 * Os precos da Stripe sao IMUTAVEIS: editar o valor de um preco no Dashboard
 * nao o altera, arquiva-o e cria um novo com outro id. Se o codigo dependesse
 * do id, partia-se em silencio a cada edicao — foi exactamente o que
 * aconteceu durante o desenvolvimento. A lookup_key sobrevive a essas
 * edicoes porque pode ser transferida para o preco novo.
 */
export const PLAN_LOOKUP_KEYS: Record<FixedPlan, string> = {
  monthly: "neuma_monthly",
  quarterly: "neuma_quarterly",
  annual: "neuma_annual",
};

/** Catalogo para exibicao. Seguro em componentes de cliente. */
export type PlanDefinition = {
  plan: FixedPlan;
  label: string;
  /** Periodicidade em texto corrido, ex. "a cada 3 meses". */
  cadence: string;
  amountCents: number;
  currency: "eur";
  interval: "month" | "year";
  intervalCount: number;
  /** Meses cobertos por cada cobranca. Base da normalizacao do MRR. */
  months: number;
  /** Destacado na UI como opcao recomendada. */
  highlight?: boolean;
};

/**
 * Valores em cêntimos em codigo, para a UI renderizar precos sem chamar a
 * Stripe. Sao confrontados com a Stripe pelo verificador do catalogo, para
 * nao existir divergencia silenciosa entre o que mostramos e o que cobramos.
 */
const DEFINITIONS: Record<FixedPlan, PlanDefinition> = {
  monthly: {
    plan: "monthly",
    label: "Mensal",
    cadence: "todos os meses",
    amountCents: 2494,
    currency: "eur",
    interval: "month",
    intervalCount: 1,
    months: 1,
  },
  quarterly: {
    plan: "quarterly",
    label: "Trimestral",
    cadence: "a cada 3 meses",
    amountCents: 6294,
    currency: "eur",
    interval: "month",
    intervalCount: 3,
    months: 3,
    highlight: true,
  },
  annual: {
    plan: "annual",
    label: "Anual",
    cadence: "todos os anos",
    amountCents: 19894,
    currency: "eur",
    interval: "year",
    intervalCount: 1,
    months: 12,
  },
};

export function getPlan(plan: FixedPlan): PlanDefinition {
  return DEFINITIONS[plan];
}

export function getPlans(): PlanDefinition[] {
  return FIXED_PLANS.map(getPlan);
}

export function isFixedPlan(value: string): value is FixedPlan {
  return (FIXED_PLANS as readonly string[]).includes(value);
}

/**
 * Fallback quando um price id nao esta no catalogo — precos 1:1 sao criados a
 * medida e precos editados ficam arquivados. Deduz o plano pela cadencia.
 */
export function planFromRecurring(
  interval: string | null | undefined,
  intervalCount: number | null | undefined,
): BillingPlan | null {
  if (interval === "year") return "annual";
  if (interval === "month") {
    if (intervalCount === 3) return "quarterly";
    if (intervalCount === 1) return "monthly";
  }
  return null;
}

/** Numero de meses cobertos por um ciclo de cobranca. */
export function monthsForInterval(
  interval: string | null | undefined,
  intervalCount: number | null | undefined,
): number {
  const count = intervalCount && intervalCount > 0 ? intervalCount : 1;
  if (interval === "year") return count * 12;
  if (interval === "month") return count;
  if (interval === "week") return (count * 7) / 30;
  if (interval === "day") return count / 30;
  return count;
}

/** Preco equivalente por mes, em cêntimos, para exibicao. */
export function monthlyEquivalentCents(plan: PlanDefinition): number {
  return Math.round(plan.amountCents / plan.months);
}

/** Poupanca percentual face ao mensal, para o badge nos cartoes. */
export function savingsPercent(plan: PlanDefinition): number {
  const monthly = DEFINITIONS.monthly.amountCents;
  const perMonth = plan.amountCents / plan.months;
  if (perMonth >= monthly) return 0;
  return Math.round((1 - perMonth / monthly) * 100);
}

export function formatEuros(
  cents: number,
  options: { withCents?: boolean } = {},
): string {
  const { withCents = true } = options;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  }).format(cents / 100);
}
