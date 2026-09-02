"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripe } from "@/lib/stripe/client";
import { isFixedPlan, type FixedPlan } from "@/lib/stripe/plans";
import { resolvePriceId } from "@/lib/stripe/prices";
import {
  recordSubscriptionEvent,
  syncRefund,
  syncSubscription,
} from "@/lib/stripe/sync";
import type { Json } from "@/lib/types/database.types";

export type FinanceActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireMentor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissão");
  return { supabase, mentorId: user.id };
}

function revalidateFinance() {
  revalidatePath("/studio/finance");
  revalidatePath("/studio/finance/subscriptions");
  revalidatePath("/studio/finance/one-to-one");
}

function fail(error: unknown, fallback: string): FinanceActionResult {
  console.error("[finance]", error);
  return {
    ok: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

async function loadSubscription(subscriptionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "id, profile_id, stripe_subscription_id, stripe_item_id, plan, status, collection_paused",
    )
    .eq("id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Subscrição não encontrada.");
  return data;
}

export async function pauseSubscription(
  subscriptionId: string,
): Promise<FinanceActionResult> {
  try {
    const { mentorId } = await requireMentor();
    const sub = await loadSubscription(subscriptionId);
    const stripe = requireStripe();

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      pause_collection: { behavior: "void" },
    });
    await syncSubscription(sub.stripe_subscription_id);
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      profileId: sub.profile_id,
      actorId: mentorId,
      action: "pause",
      detail: { behavior: "void" },
    });

    revalidateFinance();
    return { ok: true };
  } catch (error) {
    return fail(error, "Não foi possível pausar a subscrição.");
  }
}

export async function resumeSubscription(
  subscriptionId: string,
): Promise<FinanceActionResult> {
  try {
    const { mentorId } = await requireMentor();
    const sub = await loadSubscription(subscriptionId);
    const stripe = requireStripe();

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      // Limpa pause_collection (API Stripe: string vazia / Emptyable).
      pause_collection: "",
    });
    await syncSubscription(sub.stripe_subscription_id);
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      profileId: sub.profile_id,
      actorId: mentorId,
      action: "resume",
    });

    revalidateFinance();
    return { ok: true };
  } catch (error) {
    return fail(error, "Não foi possível retomar a subscrição.");
  }
}

export async function cancelSubscription(
  subscriptionId: string,
  options: { immediate: boolean },
): Promise<FinanceActionResult> {
  try {
    const { mentorId } = await requireMentor();
    const sub = await loadSubscription(subscriptionId);
    const stripe = requireStripe();

    if (options.immediate) {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id, {
        prorate: false,
        invoice_now: false,
      });
    } else {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    await syncSubscription(sub.stripe_subscription_id);
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      profileId: sub.profile_id,
      actorId: mentorId,
      action: options.immediate ? "cancel_immediate" : "cancel_at_period_end",
    });

    revalidateFinance();
    return { ok: true };
  } catch (error) {
    return fail(error, "Não foi possível cancelar a subscrição.");
  }
}

export async function changeSubscriptionPlan(
  subscriptionId: string,
  plan: FixedPlan,
): Promise<FinanceActionResult> {
  try {
    if (!isFixedPlan(plan)) {
      return { ok: false, error: "Plano inválido." };
    }

    const { mentorId } = await requireMentor();
    const sub = await loadSubscription(subscriptionId);

    if (!sub.stripe_item_id) {
      return { ok: false, error: "Subscrição sem item Stripe." };
    }
    if (sub.plan === plan) {
      return { ok: false, error: "Já está neste plano." };
    }

    const stripe = requireStripe();
    const priceId = await resolvePriceId(plan);
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: sub.stripe_item_id, price: priceId }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      metadata: {
        neuma_plan: plan,
        ...(sub.profile_id ? { neuma_profile_id: sub.profile_id } : {}),
      },
    });
    await syncSubscription(sub.stripe_subscription_id);
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      profileId: sub.profile_id,
      actorId: mentorId,
      action: "change_plan",
      detail: { from: sub.plan, to: plan },
    });

    revalidateFinance();
    return { ok: true };
  } catch (error) {
    return fail(error, "Não foi possível mudar o plano.");
  }
}

export async function refundPayment(
  paymentId: string,
  options: { amountCents?: number; reason?: string } = {},
): Promise<FinanceActionResult> {
  try {
    const { mentorId } = await requireMentor();
    const admin = createAdminClient();

    const { data: payment, error } = await admin
      .from("payments")
      .select(
        "id, profile_id, subscription_id, amount_cents, amount_refunded_cents, stripe_payment_intent_id, stripe_charge_id",
      )
      .eq("id", paymentId)
      .maybeSingle();
    if (error) throw error;
    if (!payment) return { ok: false, error: "Pagamento não encontrado." };

    const alreadyRefunded = payment.amount_refunded_cents ?? 0;
    const refundable = Math.max(0, payment.amount_cents - alreadyRefunded);
    if (refundable <= 0) {
      return { ok: false, error: "Este pagamento já foi reembolsado." };
    }

    const amount =
      options.amountCents !== undefined ? options.amountCents : refundable;
    if (!Number.isFinite(amount) || amount <= 0 || amount > refundable) {
      return {
        ok: false,
        error: `Valor inválido. Máximo reembolsável: ${refundable} cêntimos.`,
      };
    }

    if (!payment.stripe_payment_intent_id && !payment.stripe_charge_id) {
      return {
        ok: false,
        error: "Pagamento sem referência Stripe para reembolso.",
      };
    }

    const stripe = requireStripe();
    const reason =
      options.reason === "duplicate" ||
      options.reason === "fraudulent" ||
      options.reason === "requested_by_customer"
        ? options.reason
        : undefined;

    const refund = await stripe.refunds.create({
      ...(payment.stripe_payment_intent_id
        ? { payment_intent: payment.stripe_payment_intent_id }
        : { charge: payment.stripe_charge_id! }),
      amount,
      reason,
      metadata: {
        neuma_payment_id: payment.id,
        neuma_actor_id: mentorId,
        ...(options.reason && !reason ? { note: options.reason } : {}),
      },
    });

    await syncRefund(refund, { actorId: mentorId });
    await recordSubscriptionEvent({
      subscriptionId: payment.subscription_id,
      profileId: payment.profile_id,
      actorId: mentorId,
      action: "refund",
      detail: {
        paymentId: payment.id,
        amountCents: amount,
        reason: options.reason ?? null,
        stripeRefundId: refund.id,
      },
    });

    revalidateFinance();
    return { ok: true };
  } catch (error) {
    return fail(error, "Não foi possível reembolsar o pagamento.");
  }
}

export async function grantComplimentaryAccess(
  profileId: string,
): Promise<FinanceActionResult> {
  try {
    const { mentorId, supabase } = await requireMentor();
    const { error } = await supabase
      .from("profiles")
      .update({ billing_exempt: true })
      .eq("id", profileId)
      .eq("role", "student");
    if (error) throw error;

    await recordSubscriptionEvent({
      subscriptionId: null,
      profileId,
      actorId: mentorId,
      action: "grant_complimentary",
    });

    revalidateFinance();
    revalidatePath(`/studio/students/${profileId}`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Não foi possível conceder acesso de cortesia.");
  }
}

export async function revokeComplimentaryAccess(
  profileId: string,
): Promise<FinanceActionResult> {
  try {
    const { mentorId, supabase } = await requireMentor();
    const { error } = await supabase
      .from("profiles")
      .update({ billing_exempt: false })
      .eq("id", profileId)
      .eq("role", "student");
    if (error) throw error;

    await recordSubscriptionEvent({
      subscriptionId: null,
      profileId,
      actorId: mentorId,
      action: "revoke_complimentary",
    });

    revalidateFinance();
    revalidatePath(`/studio/students/${profileId}`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Não foi possível revogar o acesso de cortesia.");
  }
}

export async function resyncSubscription(
  subscriptionId: string,
): Promise<FinanceActionResult> {
  try {
    const { mentorId } = await requireMentor();
    const sub = await loadSubscription(subscriptionId);

    await syncSubscription(sub.stripe_subscription_id);
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      profileId: sub.profile_id,
      actorId: mentorId,
      action: "resync",
    });

    revalidateFinance();
    return { ok: true };
  } catch (error) {
    return fail(error, "Não foi possível ressincronizar a subscrição.");
  }
}

export async function updateFinanceSetting(
  key: string,
  value: Json,
): Promise<FinanceActionResult> {
  try {
    const { mentorId, supabase } = await requireMentor();
    const trimmed = key.trim();
    if (!trimmed) return { ok: false, error: "Chave inválida." };

    const { error } = await supabase.from("finance_settings").upsert(
      {
        key: trimmed,
        value,
        updated_by: mentorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw error;

    revalidateFinance();
    return { ok: true };
  } catch (error) {
    return fail(error, "Não foi possível actualizar a definição.");
  }
}
