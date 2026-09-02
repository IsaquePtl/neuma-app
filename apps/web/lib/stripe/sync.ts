import "server-only";

import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripe } from "@/lib/stripe/client";
import { planForPrice } from "@/lib/stripe/prices";
import type {
  BillingPlan,
  SubscriptionStatus,
} from "@/lib/types/database.types";

const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
];

function toStatus(value: string): SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
    ? (value as SubscriptionStatus)
    : "incomplete";
}

/** Converte segundos-epoch da Stripe em ISO, tolerando null. */
function toIso(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  return new Date(seconds * 1000).toISOString();
}

function idOf(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

// ---------------------------------------------------------------------------
// Cliente Stripe por perfil
// ---------------------------------------------------------------------------

/**
 * Devolve o stripe_customer_id do perfil, criando o cliente na Stripe na
 * primeira vez. Idempotente: duas chamadas em paralelo convergem para o
 * mesmo cliente porque a tabela tem o profile_id como chave primaria.
 */
export async function ensureStripeCustomer(input: {
  profileId: string;
  email: string | null;
  fullName: string | null;
}): Promise<string> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("profile_id", input.profileId)
    .maybeSingle();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const stripe = requireStripe();
  const customer = await stripe.customers.create({
    email: input.email ?? undefined,
    name: input.fullName ?? undefined,
    // Liga o cliente Stripe ao perfil. E por aqui que o webhook descobre
    // de quem e a subscricao quando o client_reference_id nao vem.
    metadata: { neuma_profile_id: input.profileId },
  });

  const { error } = await admin.from("billing_customers").upsert(
    {
      profile_id: input.profileId,
      stripe_customer_id: customer.id,
      email: input.email,
    },
    { onConflict: "profile_id" },
  );
  if (error) throw error;

  return customer.id;
}

/** Resolve o perfil a partir de um cliente Stripe. */
export async function profileIdFromCustomer(
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  const admin = createAdminClient();

  const { data } = await admin
    .from("billing_customers")
    .select("profile_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (data?.profile_id) return data.profile_id;

  // Nunca vimos este cliente (ex. criado a mao no Dashboard). Tentamos os
  // metadados e, em ultimo recurso, o email.
  const stripe = requireStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;

  const fromMeta = customer.metadata?.neuma_profile_id;
  if (fromMeta) {
    await admin.from("billing_customers").upsert(
      {
        profile_id: fromMeta,
        stripe_customer_id: customerId,
        email: customer.email,
      },
      { onConflict: "profile_id" },
    );
    return fromMeta;
  }

  if (customer.email) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", customer.email)
      .maybeSingle();
    if (profile?.id) {
      await admin.from("billing_customers").upsert(
        {
          profile_id: profile.id,
          stripe_customer_id: customerId,
          email: customer.email,
        },
        { onConflict: "profile_id" },
      );
      return profile.id;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Subscricoes
// ---------------------------------------------------------------------------

/**
 * ATENCAO a uma mudanca da API da Stripe: current_period_start e
 * current_period_end deixaram de existir no objecto Subscription e vivem
 * agora em cada subscription item. Ler do sitio antigo devolve undefined em
 * silencio, o que se traduziria em "proxima cobranca" vazia na app.
 */
function periodFromItems(subscription: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const items = subscription.items?.data ?? [];
  let start: number | null = null;
  let end: number | null = null;

  for (const item of items) {
    if (typeof item.current_period_start === "number") {
      start = start === null ? item.current_period_start : Math.min(start, item.current_period_start);
    }
    if (typeof item.current_period_end === "number") {
      end = end === null ? item.current_period_end : Math.max(end, item.current_period_end);
    }
  }

  return { start: toIso(start), end: toIso(end) };
}

/**
 * Cartao associado a subscricao.
 *
 * A subscricao pode nao ter default_payment_method proprio — e o caso normal
 * quando o cartao foi guardado no cliente, como acontece no Checkout. Nesse
 * cenario a cobranca usa o metodo por omissao do cliente, por isso e esse que
 * temos de mostrar ao aluno. Sem este fallback, a app dizia "sem cartao" a
 * quem tem um cartao a funcionar.
 */
function cardFromSubscription(subscription: Stripe.Subscription): {
  brand: string | null;
  last4: string | null;
} {
  const subPm = subscription.default_payment_method;
  if (subPm && typeof subPm !== "string" && subPm.card) {
    return { brand: subPm.card.brand ?? null, last4: subPm.card.last4 ?? null };
  }

  const customer = subscription.customer;
  if (customer && typeof customer !== "string" && !customer.deleted) {
    const customerPm = customer.invoice_settings?.default_payment_method;
    if (customerPm && typeof customerPm !== "string" && customerPm.card) {
      return {
        brand: customerPm.card.brand ?? null,
        last4: customerPm.card.last4 ?? null,
      };
    }
  }

  return { brand: null, last4: null };
}

async function planFromSubscription(
  subscription: Stripe.Subscription,
): Promise<BillingPlan | null> {
  const price = subscription.items?.data?.[0]?.price;
  if (!price) return null;

  return planForPrice(price, {
    oneToOne: subscription.metadata?.neuma_one_to_one === "1",
  });
}

/** Busca a subscricao a Stripe com tudo o que precisamos expandido. */
export async function fetchSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = requireStripe();
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: [
      "default_payment_method",
      "items.data.price",
      "customer.invoice_settings.default_payment_method",
    ],
  });
}

/**
 * Escreve o estado de uma subscricao no Supabase.
 *
 * A fonte de verdade e sempre a Stripe: passamos o objecto que a Stripe nos
 * deu (ou vamos busca-lo). Nunca deduzimos estado a partir do tipo de evento,
 * porque os webhooks podem chegar fora de ordem e um evento antigo
 * sobrescreveria um estado mais recente. O campo stripe_event_at guarda o
 * momento a que o estado escrito corresponde, e escritas mais antigas do que
 * o que ja temos sao ignoradas.
 */
export async function syncSubscription(
  input: string | Stripe.Subscription,
  options: { eventAt?: Date | null } = {},
): Promise<{ profileId: string | null; plan: BillingPlan | null }> {
  const subscription =
    typeof input === "string" ? await fetchSubscription(input) : input;

  const admin = createAdminClient();
  const customerId = idOf(subscription.customer);
  const profileId = await profileIdFromCustomer(customerId);

  const { data: previous } = await admin
    .from("subscriptions")
    .select("id, status, past_due_since, stripe_event_at")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const eventAt = options.eventAt ?? new Date();
  if (
    previous?.stripe_event_at &&
    new Date(previous.stripe_event_at) > eventAt
  ) {
    // Evento fora de ordem: ja temos estado mais recente.
    return { profileId, plan: null };
  }

  const status = toStatus(subscription.status);
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const period = periodFromItems(subscription);
  const card = cardFromSubscription(subscription);
  const plan = await planFromSubscription(subscription);

  // past_due_since marca o inicio da janela de tolerancia. So e definido na
  // transicao para past_due, para a tolerancia nao reiniciar a cada webhook.
  let pastDueSince: string | null = null;
  if (status === "past_due") {
    pastDueSince =
      previous?.status === "past_due" && previous.past_due_since
        ? previous.past_due_since
        : new Date().toISOString();
  }

  let profileSnapshot: { full_name: string | null; email: string | null } | null =
    null;
  if (profileId) {
    const { data } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", profileId)
      .maybeSingle();
    profileSnapshot = data ?? null;
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      profile_id: profileId,
      student_name: profileSnapshot?.full_name ?? null,
      student_email: profileSnapshot?.email ?? null,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id ?? null,
      stripe_item_id: item?.id ?? null,
      plan,
      status,
      currency: price?.currency ?? subscription.currency ?? "eur",
      unit_amount: price?.unit_amount ?? null,
      interval: price?.recurring?.interval ?? null,
      interval_count: price?.recurring?.interval_count ?? 1,
      current_period_start: period.start,
      current_period_end: period.end,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      canceled_at: toIso(subscription.canceled_at),
      ended_at: toIso(subscription.ended_at),
      trial_end: toIso(subscription.trial_end),
      // pause_collection chega dentro de customer.subscription.updated,
      // nao existe um evento "paused" proprio.
      collection_paused: Boolean(subscription.pause_collection),
      paused_at: subscription.pause_collection
        ? new Date().toISOString()
        : null,
      past_due_since: pastDueSince,
      card_brand: card.brand,
      card_last4: card.last4,
      latest_invoice_id: idOf(subscription.latest_invoice),
      stripe_event_at: eventAt.toISOString(),
      raw: JSON.parse(JSON.stringify(subscription)),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw error;

  // Marca a conta como 1:1 quando a subscricao e de preco a medida.
  if (profileId && plan === "one_to_one") {
    await admin
      .from("profiles")
      .update({ is_one_to_one: true })
      .eq("id", profileId);
  }

  return { profileId, plan };
}

// ---------------------------------------------------------------------------
// Facturas e reembolsos
// ---------------------------------------------------------------------------

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.subscription_details?.subscription) {
    return idOf(parent.subscription_details.subscription);
  }
  for (const line of invoice.lines?.data ?? []) {
    const sub = line.parent?.subscription_item_details?.subscription;
    if (sub) return idOf(sub);
  }
  return null;
}

/**
 * Extrai o payment_intent e a charge de uma factura.
 *
 * A Charge deixou de expor o campo `invoice` nesta versao da API, por isso a
 * ligacao factura-cobranca tem de ser feita por aqui, atraves de
 * invoice.payments, e nao a partir da charge.
 */
function paymentRefsFromInvoice(invoice: Stripe.Invoice): {
  paymentIntentId: string | null;
  chargeId: string | null;
} {
  for (const entry of invoice.payments?.data ?? []) {
    const payment = entry.payment;
    if (!payment) continue;
    const paymentIntentId = idOf(payment.payment_intent);
    const chargeId = idOf(payment.charge);
    if (paymentIntentId || chargeId) return { paymentIntentId, chargeId };
  }
  return { paymentIntentId: null, chargeId: null };
}

/**
 * Grava uma factura paga. So contam facturas efectivamente pagas, porque
 * esta tabela e a base da receita no dashboard.
 */
export async function syncInvoice(
  input: string | Stripe.Invoice,
): Promise<void> {
  const stripe = requireStripe();
  const invoice =
    typeof input === "string"
      ? await stripe.invoices.retrieve(input, { expand: ["payments"] })
      : input;

  if (!invoice.id) return;

  const admin = createAdminClient();
  const customerId = idOf(invoice.customer);
  const profileId = await profileIdFromCustomer(customerId);

  const stripeSubscriptionId = subscriptionIdFromInvoice(invoice);
  let subscriptionRowId: string | null = null;
  let plan: BillingPlan | null = null;

  if (stripeSubscriptionId) {
    // A factura muitas vezes chega antes do customer.subscription.created.
    // Sincronizamos a sub primeiro para nao gravar o pagamento sem plano.
    let { data } = await admin
      .from("subscriptions")
      .select("id, plan")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    if (!data?.plan) {
      await syncSubscription(stripeSubscriptionId);
      ({ data } = await admin
        .from("subscriptions")
        .select("id, plan")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .maybeSingle());
    }

    subscriptionRowId = data?.id ?? null;
    plan = data?.plan ?? null;
  }

  if (!plan) {
    const priceId = idOf(
      invoice.lines?.data?.[0]?.pricing?.price_details?.price ?? null,
    );
    if (priceId) {
      const priceObj = await stripe.prices.retrieve(priceId);
      plan = await planForPrice(priceObj);
    }
  }

  let profileSnapshot: { full_name: string | null; email: string | null } | null =
    null;
  if (profileId) {
    const { data } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", profileId)
      .maybeSingle();
    profileSnapshot = data ?? null;
  }

  const paidAt =
    invoice.status_transitions?.paid_at ?? invoice.created ?? null;
  const refs = paymentRefsFromInvoice(invoice);

  const { error } = await admin.from("payments").upsert(
    {
      profile_id: profileId,
      subscription_id: subscriptionRowId,
      student_name: profileSnapshot?.full_name ?? invoice.customer_name ?? null,
      student_email:
        profileSnapshot?.email ?? invoice.customer_email ?? null,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: customerId,
      stripe_payment_intent_id: refs.paymentIntentId,
      stripe_charge_id: refs.chargeId,
      plan,
      amount_cents: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? "eur",
      status: invoice.status ?? null,
      description: invoice.description ?? null,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_pdf: invoice.invoice_pdf ?? null,
      paid_at: toIso(paidAt),
    },
    { onConflict: "stripe_invoice_id" },
  );
  if (error) throw error;
}

/**
 * Grava um reembolso. Atribuido a data do REEMBOLSO, nao a do pagamento
 * original: senao, reembolsar hoje uma factura de Janeiro alterava a receita
 * de Janeiro retroactivamente e os numeros deixavam de fechar.
 */
export async function syncRefund(
  refund: Stripe.Refund,
  options: { actorId?: string | null } = {},
): Promise<void> {
  const admin = createAdminClient();

  const chargeId = idOf(refund.charge);
  const paymentIntentId = idOf(refund.payment_intent);

  let payment: { id: string; profile_id: string | null } | null = null;
  if (paymentIntentId) {
    const { data } = await admin
      .from("payments")
      .select("id, profile_id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
    payment = data ?? null;
  }
  if (!payment && chargeId) {
    const { data } = await admin
      .from("payments")
      .select("id, profile_id")
      .eq("stripe_charge_id", chargeId)
      .maybeSingle();
    payment = data ?? null;
  }

  const { error } = await admin.from("refunds").upsert(
    {
      payment_id: payment?.id ?? null,
      profile_id: payment?.profile_id ?? null,
      stripe_refund_id: refund.id,
      amount_cents: refund.amount ?? 0,
      currency: refund.currency ?? "eur",
      reason: refund.reason ?? null,
      created_by: options.actorId ?? null,
      refunded_at: toIso(refund.created),
    },
    { onConflict: "stripe_refund_id" },
  );
  if (error) throw error;

  // Mantem o total reembolsado no pagamento, para a receita liquida.
  if (payment?.id) {
    const { data: rows } = await admin
      .from("refunds")
      .select("amount_cents")
      .eq("payment_id", payment.id);
    const total = (rows ?? []).reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);
    await admin
      .from("payments")
      .update({ amount_refunded_cents: total })
      .eq("id", payment.id);
  }
}

/**
 * Liga a charge ao pagamento pelo payment_intent.
 *
 * Vai por aqui e nao por charge.invoice porque esse campo ja nao existe na
 * Charge nesta versao da API.
 */
export async function attachChargeToPayment(
  charge: Stripe.Charge,
): Promise<void> {
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId) return;

  const admin = createAdminClient();
  await admin
    .from("payments")
    .update({ stripe_charge_id: charge.id })
    .eq("stripe_payment_intent_id", paymentIntentId);
}

/** Registo de auditoria das acoes do admin. */
export async function recordSubscriptionEvent(input: {
  subscriptionId: string | null;
  profileId: string | null;
  actorId: string | null;
  action: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("subscription_events").insert({
    subscription_id: input.subscriptionId,
    profile_id: input.profileId,
    actor_id: input.actorId,
    action: input.action,
    detail: (input.detail ?? null) as never,
  });
}
