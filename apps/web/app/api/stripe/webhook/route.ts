import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import {
  attachChargeToPayment,
  syncInvoice,
  syncRefund,
  syncSubscription,
} from "@/lib/stripe/sync";

/**
 * Webhook da Stripe.
 *
 * Duas garantias importantes:
 *
 * 1. IDEMPOTENCIA. A Stripe reenvia eventos quando nao recebe 2xx, e o mesmo
 *    evento pode chegar varias vezes. Gravamos o id do evento primeiro, com
 *    on-conflict-do-nothing; se ja existia e ja foi processado, saimos.
 *
 * 2. ORDEM. Os eventos podem chegar fora de ordem, e um evento antigo a ser
 *    processado depois de um recente sobrescreveria o estado com dados
 *    velhos. Passamos sempre a data do evento ao sync, que descarta escritas
 *    mais antigas do que aquilo que ja temos.
 */

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "charge.succeeded",
  "charge.refunded",
]);

function revalidateFinance() {
  revalidatePath("/studio/finance");
  revalidatePath("/studio/finance/subscriptions");
  revalidatePath("/settings");
  revalidatePath("/home");
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !secret) {
    console.error("[stripe:webhook] falta STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Stripe nao configurada" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  // Corpo cru: a assinatura e calculada sobre os bytes exactos, por isso nao
  // se pode usar request.json() aqui.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      secret,
    );
  } catch (error) {
    console.error("[stripe:webhook] assinatura invalida:", error);
    return NextResponse.json({ error: "Assinatura invalida" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotencia. Se o insert nao devolve linha, o evento ja existia.
  const { data: inserted, error: insertError } = await admin
    .from("stripe_events")
    .insert({
      id: event.id,
      type: event.type,
      api_version: event.api_version ?? null,
      payload: JSON.parse(JSON.stringify(event)),
    })
    .select("id")
    .maybeSingle();

  if (insertError && insertError.code !== "23505") {
    console.error("[stripe:webhook] falha a registar evento:", insertError);
    // Devolvemos 500 para a Stripe voltar a tentar: e melhor repetir do que
    // perder um pagamento por causa de um erro transitorio da base de dados.
    return NextResponse.json({ error: "Erro a registar evento" }, { status: 500 });
  }

  if (!inserted) {
    const { data: existing } = await admin
      .from("stripe_events")
      .select("processed_at")
      .eq("id", event.id)
      .maybeSingle();
    if (existing?.processed_at) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  if (!HANDLED.has(event.type)) {
    await admin
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", event.id);
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const eventAt = new Date(event.created * 1000);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // mode "setup" e a actualizacao de cartao: guardar o metodo no
        // cliente nao basta, tem de ficar como default_payment_method da
        // subscricao, senao a renovacao seguinte tenta o cartao antigo.
        if (session.mode === "setup") {
          await handleSetupCompleted(stripe, session);
          break;
        }

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subscriptionId) {
          await syncSubscription(subscriptionId, { eventAt });
        }
        if (session.invoice) {
          const invoiceId =
            typeof session.invoice === "string"
              ? session.invoice
              : session.invoice.id;
          if (invoiceId) await syncInvoice(invoiceId);
        }
        await markInviteAsPaid(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const subscription = event.data.object as Stripe.Subscription;
        // Vamos buscar a versao actual a Stripe em vez de confiar no payload,
        // porque precisamos do default_payment_method expandido.
        await syncSubscription(subscription.id, { eventAt });
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
      case "invoice.payment_action_required": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.id) await syncInvoice(invoice.id);

        const parent = invoice.parent;
        const subscriptionId = parent?.subscription_details?.subscription;
        if (subscriptionId) {
          const id =
            typeof subscriptionId === "string"
              ? subscriptionId
              : subscriptionId.id;
          await syncSubscription(id, { eventAt });
        }
        break;
      }

      case "charge.succeeded": {
        await attachChargeToPayment(event.data.object as Stripe.Charge);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await attachChargeToPayment(charge);
        for (const refund of charge.refunds?.data ?? []) {
          await syncRefund(refund);
        }
        break;
      }
    }

    await admin
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("id", event.id);

    revalidateFinance();
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[stripe:webhook] ${event.type} falhou:`, error);

    await admin
      .from("stripe_events")
      .update({ error: message })
      .eq("id", event.id);

    // 500 para a Stripe tentar de novo com backoff.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Conclui a actualizacao de cartao.
 *
 * O Checkout em mode "setup" cria um SetupIntent e guarda o metodo de
 * pagamento no cliente, mas NAO o associa a subscricao. Sem este passo, o
 * aluno ve "cartao actualizado" e a cobranca seguinte falha no cartao antigo.
 */
async function handleSetupCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  const setupIntentId =
    typeof session.setup_intent === "string"
      ? session.setup_intent
      : session.setup_intent?.id;
  if (!setupIntentId) return;

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethodId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;
  if (!paymentMethodId) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!customerId) return;

  const subscriptionId = session.metadata?.neuma_subscription_id;
  if (subscriptionId) {
    await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    });
    await syncSubscription(subscriptionId);
    return;
  }

  // Sem referencia explicita: aplica a todas as subscricoes vivas do cliente.
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  for (const subscription of subscriptions.data) {
    if (["canceled", "incomplete_expired"].includes(subscription.status)) {
      continue;
    }
    await stripe.subscriptions.update(subscription.id, {
      default_payment_method: paymentMethodId,
    });
    await syncSubscription(subscription.id);
  }
}

/** Fecha o convite 1:1 quando o pagamento e concluido. */
async function markInviteAsPaid(session: Stripe.Checkout.Session) {
  const inviteId = session.metadata?.neuma_invite_id;
  if (!inviteId) return;

  const admin = createAdminClient();
  await admin
    .from("one_to_one_invites")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id,
      redeemed_at: new Date().toISOString(),
      redeemed_profile_id: session.client_reference_id ?? null,
    })
    .eq("id", inviteId);

  if (session.client_reference_id) {
    await admin
      .from("profiles")
      .update({ is_one_to_one: true })
      .eq("id", session.client_reference_id);
  }

  revalidatePath("/studio/finance/one-to-one");
}
