import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripe } from "@/lib/stripe/client";

const SETTING_KEY = "one_to_one_product_id";
const PRODUCT_IMAGE_RELATIVE =
  "branding/PNGS/NeumaPNG_app_black.png";
/** Metadata marker — evita re-upload em cada convite. */
const PRODUCT_IMAGE_MARK = "app_black_v1";

function addMonthsIso(from: Date, months: number): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

async function uploadOneToOneProductImageUrl(
  stripe: Stripe,
): Promise<string> {
  const imagePath = path.join(process.cwd(), PRODUCT_IMAGE_RELATIVE);
  const data = await readFile(imagePath);
  const file = await stripe.files.create({
    purpose: "business_logo",
    file: {
      data,
      name: "NeumaPNG_app_black.png",
      type: "image/png",
    },
  });
  const link = await stripe.fileLinks.create({ file: file.id });
  if (!link.url) {
    throw new Error("Stripe file link sem URL para a imagem do produto 1:1.");
  }
  return link.url;
}

/** Sem descrição; imagem de branding Neuma (upload Stripe Files). */
async function ensureOneToOneProductPresentation(
  stripe: Stripe,
  product: Stripe.Product,
): Promise<void> {
  const needsDescriptionClear = Boolean(product.description?.trim());
  const needsImage =
    product.metadata?.neuma_product_image !== PRODUCT_IMAGE_MARK ||
    !product.images?.length;
  if (!needsDescriptionClear && !needsImage) return;

  const updates: Stripe.ProductUpdateParams = {
    metadata: {
      ...product.metadata,
      neuma_role: product.metadata?.neuma_role || "one_to_one",
      neuma_product_image: PRODUCT_IMAGE_MARK,
    },
  };
  if (needsDescriptionClear) updates.description = "";
  if (needsImage) {
    updates.images = [await uploadOneToOneProductImageUrl(stripe)];
  }
  await stripe.products.update(product.id, updates);
}

/**
 * Marca o convite 1:1 como pago e actualiza o perfil.
 * One-time: define `one_to_one_access_until` pela duração do programa.
 * Recurring: `is_one_to_one` + acesso via subscrição Stripe.
 */
export async function fulfillOneToOneCheckout(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const inviteId = session.metadata?.neuma_invite_id;
  if (!inviteId) return;

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("one_to_one_invites")
    .select("id, billing_mode, duration_months, redeemed_profile_id")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) return;

  const profileId =
    session.client_reference_id ??
    session.metadata?.neuma_profile_id ??
    invite.redeemed_profile_id;

  await admin
    .from("one_to_one_invites")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id,
      redeemed_at: new Date().toISOString(),
      redeemed_profile_id: profileId,
    })
    .eq("id", inviteId);

  if (profileId) {
    const billingMode =
      session.metadata?.neuma_billing_mode === "one_time" ||
      invite.billing_mode === "one_time"
        ? "one_time"
        : "recurring";

    const durationMonths = Math.max(
      1,
      Number(session.metadata?.neuma_duration_months) ||
        invite.duration_months ||
        1,
    );

    const accessUntil = addMonthsIso(new Date(), durationMonths);
    const profileUpdate: {
      is_one_to_one: true;
      one_to_one_access_until: string;
    } = {
      is_one_to_one: true,
      one_to_one_access_until: accessUntil,
    };

    await admin.from("profiles").update(profileUpdate).eq("id", profileId);

    // Checkout Session não aceita subscription_data.cancel_at — aplicar após criar.
    if (billingMode === "recurring") {
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (subscriptionId) {
        const cancelAtUnix = Math.floor(
          new Date(addMonthsIso(new Date(), durationMonths)).getTime() / 1000,
        );
        const stripe = requireStripe();
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at: cancelAtUnix,
        });
      }
    }
  }

  revalidatePath("/studio/finance/one-to-one");
  revalidatePath("/home");
  revalidatePath("/settings");
}

/**
 * Resolve o produto Neuma 1:1.
 *
 * A UI da Stripe obriga a um preco ao criar um produto; a API nao. Por isso
 * criamos o produto aqui na primeira utilizacao e guardamos o id em
 * finance_settings. Override manual via STRIPE_PRODUCT_ONE_TO_ONE.
 */
export async function getOrCreateOneToOneProduct(): Promise<string> {
  const stripe = requireStripe();
  const fromEnv = process.env.STRIPE_PRODUCT_ONE_TO_ONE?.trim();
  if (fromEnv) {
    const product = await stripe.products.retrieve(fromEnv);
    await ensureOneToOneProductPresentation(stripe, product);
    return fromEnv;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("finance_settings")
    .select("value")
    .eq("key", SETTING_KEY)
    .maybeSingle();

  // value is jsonb — string values come back as JSON strings without quotes stripped sometimes
  let productId: string | null = null;
  if (typeof data?.value === "string") {
    productId = data.value;
  } else if (data?.value != null) {
    const raw = JSON.stringify(data.value);
    productId = raw.replace(/^"|"$/g, "");
    if (productId === "null") productId = null;
  }

  if (productId && productId.startsWith("prod_")) {
    const product = await stripe.products.retrieve(productId);
    await ensureOneToOneProductPresentation(stripe, product);
    return productId;
  }

  // Fallback: procurar por metadata na Stripe
  const listed = await stripe.products.list({ limit: 100, active: true });
  const existing = listed.data.find(
    (p) => p.metadata?.neuma_role === "one_to_one" || p.name === "Neuma 1:1",
  );
  if (existing) {
    await ensureOneToOneProductPresentation(stripe, existing);
    await admin.from("finance_settings").upsert({
      key: SETTING_KEY,
      value: JSON.parse(JSON.stringify(existing.id)),
    });
    return existing.id;
  }

  const imageUrl = await uploadOneToOneProductImageUrl(stripe);
  const created = await stripe.products.create({
    name: "Neuma 1:1",
    images: [imageUrl],
    metadata: {
      neuma_role: "one_to_one",
      neuma_product_image: PRODUCT_IMAGE_MARK,
    },
  });

  await admin.from("finance_settings").upsert({
    key: SETTING_KEY,
    value: JSON.parse(JSON.stringify(created.id)),
  });

  return created.id;
}

export async function createOneToOnePrice(input: {
  amountCents: number;
  billingMode: "recurring" | "one_time";
  /** For recurring: every N months (1, 2, or 3). Ignored for one_time. */
  intervalMonths?: 1 | 2 | 3;
  nickname?: string;
}): Promise<string> {
  const stripe = requireStripe();
  const productId = await getOrCreateOneToOneProduct();

  if (input.billingMode === "one_time") {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: input.amountCents,
      currency: "eur",
      nickname: input.nickname,
      metadata: { neuma_plan: "one_to_one", neuma_billing_mode: "one_time" },
    });
    return price.id;
  }

  const intervalCount = input.intervalMonths ?? 1;
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: input.amountCents,
    currency: "eur",
    recurring: {
      interval: "month",
      interval_count: intervalCount,
    },
    nickname: input.nickname,
    metadata: {
      neuma_plan: "one_to_one",
      neuma_billing_mode: "recurring",
    },
  });
  return price.id;
}
