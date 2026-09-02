"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getAppOrigin } from "@/lib/auth/app-origin";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requireStripe } from "@/lib/stripe/client";
import { isFixedPlan, type FixedPlan } from "@/lib/stripe/plans";
import { resolvePriceId } from "@/lib/stripe/prices";
import {
  ensureStripeCustomer,
  fetchSubscription,
  recordSubscriptionEvent,
  syncInvoice,
  syncSubscription,
} from "@/lib/stripe/sync";

export type BillingActionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

async function requireStudent() {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, email, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "student") {
    throw new Error("Sem permissão");
  }

  return { user, profile, supabase };
}

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : null;
}

/** Cria uma Checkout Session de subscricao e devolve o URL da Stripe. */
export async function createCheckoutSession(
  plan: string,
): Promise<BillingActionResult> {
  try {
    if (!isFixedPlan(plan)) {
      return { ok: false, error: "Plano inválido." };
    }

    const { profile } = await requireStudent();
    const stripe = requireStripe();
    const priceId = await resolvePriceId(plan);
    const customerId = await ensureStripeCustomer({
      profileId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
    });

    const origin = getAppOrigin(await requestOrigin());
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: profile.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/subscrever/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscrever?cancelado=1`,
      locale: "pt",
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          neuma_profile_id: profile.id,
          neuma_plan: plan,
        },
      },
      metadata: {
        neuma_profile_id: profile.id,
        neuma_plan: plan,
      },
    });

    if (!session.url) {
      return { ok: false, error: "Não foi possível abrir o pagamento." };
    }

    return { ok: true, url: session.url };
  } catch (error) {
    console.error("[billing:checkout]", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o pagamento.",
    };
  }
}

/**
 * Sincroniza uma Checkout Session logo apos o regresso da Stripe.
 * Nao espera pelo webhook: o aluno precisa de acesso imediato.
 */
export async function finalizeCheckoutSession(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { profile } = await requireStudent();
    const stripe = requireStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "invoice"],
    });

    if (
      session.client_reference_id &&
      session.client_reference_id !== profile.id
    ) {
      return { ok: false, error: "Esta sessão de pagamento não é tua." };
    }

    if (session.status !== "complete" && session.payment_status !== "paid") {
      return { ok: false, error: "O pagamento ainda não foi confirmado." };
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    if (subscriptionId) {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          await syncSubscription(subscriptionId);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      if (lastError) throw lastError;
    }

    const invoiceId =
      typeof session.invoice === "string"
        ? session.invoice
        : session.invoice?.id;
    if (invoiceId) {
      try {
        await syncInvoice(invoiceId);
      } catch (error) {
        console.error("[billing:finalize:invoice]", error);
      }
    }

    revalidatePath("/home");
    revalidatePath("/settings");
    revalidatePath("/subscrever");
    return { ok: true };
  } catch (error) {
    console.error("[billing:finalize]", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o pagamento.",
    };
  }
}

export async function cancelMySubscription(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const { profile, supabase } = await requireStudent();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, status")
      .eq("profile_id", profile.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return { ok: false, error: "Não tens uma subscrição activa." };

    const stripe = requireStripe();
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
    await syncSubscription(sub.stripe_subscription_id);
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      profileId: profile.id,
      actorId: profile.id,
      action: "cancel_at_period_end",
    });

    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    console.error("[billing:cancel]", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Não foi possível cancelar.",
    };
  }
}

export async function reactivateMySubscription(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const { profile, supabase } = await requireStudent();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, cancel_at_period_end")
      .eq("profile_id", profile.id)
      .eq("cancel_at_period_end", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return { ok: false, error: "Não há cancelamento pendente." };
    }

    const stripe = requireStripe();
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
    await syncSubscription(sub.stripe_subscription_id);
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      profileId: profile.id,
      actorId: profile.id,
      action: "reactivate",
    });

    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    console.error("[billing:reactivate]", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível reactivar.",
    };
  }
}

export async function changeMyPlan(
  plan: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isFixedPlan(plan)) return { ok: false, error: "Plano inválido." };

    const { profile, supabase } = await requireStudent();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, stripe_item_id, plan, status")
      .eq("profile_id", profile.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_item_id) {
      return { ok: false, error: "Não tens uma subscrição activa." };
    }
    if (sub.plan === plan) {
      return { ok: false, error: "Já estás neste plano." };
    }

    const stripe = requireStripe();
    const priceId = await resolvePriceId(plan as FixedPlan);
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: sub.stripe_item_id, price: priceId }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      metadata: {
        neuma_profile_id: profile.id,
        neuma_plan: plan,
      },
    });
    await syncSubscription(sub.stripe_subscription_id);
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      profileId: profile.id,
      actorId: profile.id,
      action: "change_plan",
      detail: { from: sub.plan, to: plan },
    });

    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    console.error("[billing:change]", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível mudar o plano.",
    };
  }
}

export async function createCardUpdateSession(): Promise<BillingActionResult> {
  try {
    const { profile, supabase } = await requireStudent();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("profile_id", profile.id)
      .in("status", ["active", "trialing", "past_due", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return { ok: false, error: "Não tens uma subscrição activa." };
    }

    const stripe = requireStripe();
    const origin = getAppOrigin(await requestOrigin());
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: sub.stripe_customer_id,
      currency: "eur",
      success_url: `${origin}/settings?cartao=1`,
      cancel_url: `${origin}/settings`,
      locale: "pt",
      metadata: {
        neuma_profile_id: profile.id,
        neuma_subscription_id: sub.stripe_subscription_id,
      },
    });

    if (!session.url) {
      return { ok: false, error: "Não foi possível abrir a actualização." };
    }
    return { ok: true, url: session.url };
  } catch (error) {
    console.error("[billing:card]", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível actualizar o cartão.",
    };
  }
}

export async function previewPlanChange(plan: string): Promise<
  | {
      ok: true;
      amountDueCents: number;
      currency: string;
      nextInvoiceCents: number | null;
    }
  | { ok: false; error: string }
> {
  try {
    if (!isFixedPlan(plan)) return { ok: false, error: "Plano inválido." };

    const { profile, supabase } = await requireStudent();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_item_id, plan")
      .eq("profile_id", profile.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_item_id) {
      return { ok: false, error: "Não tens uma subscrição activa." };
    }
    if (sub.plan === plan) {
      return {
        ok: true,
        amountDueCents: 0,
        currency: "eur",
        nextInvoiceCents: null,
      };
    }

    const stripe = requireStripe();
    const priceId = await resolvePriceId(plan as FixedPlan);
    const live = await fetchSubscription(sub.stripe_subscription_id);
    const customerId =
      typeof live.customer === "string" ? live.customer : live.customer.id;
    const preview = await stripe.invoices.createPreview({
      customer: customerId,
      subscription: sub.stripe_subscription_id,
      subscription_details: {
        items: [{ id: sub.stripe_item_id, price: priceId }],
        proration_behavior: "create_prorations",
      },
    });

    return {
      ok: true,
      amountDueCents: preview.amount_due ?? 0,
      currency: preview.currency ?? "eur",
      nextInvoiceCents: preview.total ?? null,
    };
  } catch (error) {
    console.error("[billing:preview]", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível calcular a proração.",
    };
  }
}
