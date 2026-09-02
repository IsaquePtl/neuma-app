import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripe } from "@/lib/stripe/client";

const SETTING_KEY = "one_to_one_product_id";

/**
 * Resolve o produto Neuma 1:1.
 *
 * A UI da Stripe obriga a um preco ao criar um produto; a API nao. Por isso
 * criamos o produto aqui na primeira utilizacao e guardamos o id em
 * finance_settings. Override manual via STRIPE_PRODUCT_ONE_TO_ONE.
 */
export async function getOrCreateOneToOneProduct(): Promise<string> {
  const fromEnv = process.env.STRIPE_PRODUCT_ONE_TO_ONE?.trim();
  if (fromEnv) return fromEnv;

  const admin = createAdminClient();
  const { data } = await admin
    .from("finance_settings")
    .select("value")
    .eq("key", SETTING_KEY)
    .maybeSingle();

  const stored =
    typeof data?.value === "string"
      ? data.value
      : typeof data?.value === "object" &&
          data.value &&
          "id" in (data.value as object)
        ? String((data.value as { id: string }).id)
        : typeof data?.value === "string"
          ? data.value
          : null;

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
    return productId;
  }

  // Fallback: procurar por metadata na Stripe
  const stripe = requireStripe();
  const listed = await stripe.products.list({ limit: 100, active: true });
  const existing = listed.data.find(
    (p) => p.metadata?.neuma_role === "one_to_one" || p.name === "Neuma 1:1",
  );
  if (existing) {
    await admin.from("finance_settings").upsert({
      key: SETTING_KEY,
      value: JSON.parse(JSON.stringify(existing.id)),
    });
    return existing.id;
  }

  const created = await stripe.products.create({
    name: "Neuma 1:1",
    description:
      "Mentoria individual Neuma. Cada cliente tem um preço à medida.",
    metadata: { neuma_role: "one_to_one" },
  });

  await admin.from("finance_settings").upsert({
    key: SETTING_KEY,
    value: JSON.parse(JSON.stringify(created.id)),
  });

  return created.id;
}

export async function createOneToOnePrice(input: {
  amountCents: number;
  interval: "month" | "year";
  intervalCount: number;
  nickname?: string;
}): Promise<string> {
  const stripe = requireStripe();
  const productId = await getOrCreateOneToOneProduct();
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: input.amountCents,
    currency: "eur",
    recurring: {
      interval: input.interval,
      interval_count: input.intervalCount,
    },
    nickname: input.nickname,
    metadata: { neuma_plan: "one_to_one" },
  });
  return price.id;
}
