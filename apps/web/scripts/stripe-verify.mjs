#!/usr/bin/env node
/**
 * Verifica a configuracao da Stripe contra o que o codigo espera.
 *
 *   node scripts/stripe-verify.mjs
 *
 * Le STRIPE_SECRET_KEY do ambiente (ou de apps/web/.env.local).
 * So faz leituras. Nao cria nem altera nada.
 *
 * Existe porque uma divergencia entre o catalogo da app e os precos da Stripe
 * e silenciosa e caramente: a app pode anunciar 62,94 EUR a cada 3 meses
 * enquanto a Stripe cobra 62,94 EUR por mes. Correr isto depois de mexer em
 * precos no Dashboard evita a surpresa.
 */

import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";

const EXPECTED = [
  {
    plan: "monthly",
    label: "Mensal",
    lookupKey: "neuma_monthly",
    amount: 2494,
    interval: "month",
    intervalCount: 1,
  },
  {
    plan: "quarterly",
    label: "Trimestral",
    lookupKey: "neuma_quarterly",
    amount: 6294,
    interval: "month",
    intervalCount: 3,
  },
  {
    plan: "annual",
    label: "Anual",
    lookupKey: "neuma_annual",
    amount: 19894,
    interval: "year",
    intervalCount: 1,
  },
];

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY nao definida (ambiente ou .env.local).");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
const problems = [];
const warnings = [];

const account = await stripe.accounts.retrieve();
const mode = key.startsWith("sk_test_") ? "TESTE" : "PRODUCAO (live)";
console.log(`Conta: ${account.id}  pais=${account.country}  moeda=${account.default_currency}`);
console.log(`Modo:  ${mode}\n`);

if (!key.startsWith("sk_test_")) {
  warnings.push("Estas a usar uma chave LIVE. Nesta fase devia ser sk_test_.");
}

for (const expected of EXPECTED) {
  const found = await stripe.prices.list({
    lookup_keys: [expected.lookupKey],
    active: true,
    limit: 1,
    expand: ["data.product"],
  });
  const price = found.data[0];

  if (!price) {
    problems.push(
      `${expected.label}: nenhum preco activo com lookup_key "${expected.lookupKey}".`,
    );
    console.log(`${expected.label}: NAO ENCONTRADO`);
    continue;
  }

  const productName =
    typeof price.product === "string" ? price.product : price.product.name;

  console.log(`${expected.label}: ${price.id}`);
  console.log(`   produto="${productName}"  ${price.unit_amount} ${price.currency}  ${price.recurring?.interval}x${price.recurring?.interval_count}  tax=${price.tax_behavior}`);

  if (price.unit_amount !== expected.amount) {
    problems.push(
      `${expected.label}: a app mostra ${expected.amount} e a Stripe cobra ${price.unit_amount}.`,
    );
  }
  if (price.currency !== "eur") {
    problems.push(`${expected.label}: moeda ${price.currency}, esperado eur.`);
  }
  if (price.recurring?.interval !== expected.interval) {
    problems.push(
      `${expected.label}: periodicidade ${price.recurring?.interval}, esperado ${expected.interval}.`,
    );
  }
  if ((price.recurring?.interval_count ?? 1) !== expected.intervalCount) {
    problems.push(
      `${expected.label}: interval_count ${price.recurring?.interval_count}, esperado ${expected.intervalCount}. Um trimestral configurado como mensal cobra tres vezes mais.`,
    );
  }
  if (price.tax_behavior === "unspecified") {
    warnings.push(
      `${expected.label}: tax_behavior em unspecified. Como os precos incluem IVA, devia ser inclusive. So pode ser definido uma vez.`,
    );
  }
}

console.log("\nProduto Neuma 1:1");
const products = await stripe.products.list({ limit: 100, active: true });
const oneToOne = products.data.find(
  (p) => p.metadata?.neuma_role === "one_to_one" || p.name === "Neuma 1:1",
);
if (!oneToOne) {
  warnings.push(
    "Produto Neuma 1:1 inexistente. Nao e bloqueante: o codigo cria-o na primeira utilizacao.",
  );
  console.log("   nao existe (sera criado automaticamente)");
} else {
  console.log(`   ${oneToOne.id} "${oneToOne.name}"`);
}

console.log("\nWebhook");
if (process.env.STRIPE_WEBHOOK_SECRET) {
  console.log("   STRIPE_WEBHOOK_SECRET definida");
} else {
  warnings.push(
    'STRIPE_WEBHOOK_SECRET nao definida. Corre "stripe listen --forward-to localhost:3001/api/stripe/webhook" e cola o whsec_ no .env.local.',
  );
  console.log("   STRIPE_WEBHOOK_SECRET ausente");
}

console.log("");
if (warnings.length) {
  console.log("AVISOS:");
  for (const w of warnings) console.log(`  - ${w}`);
  console.log("");
}
if (problems.length) {
  console.log("PROBLEMAS:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}

console.log("Configuracao da Stripe consistente com o catalogo da app.");
