import "server-only";

import Stripe from "stripe";

/**
 * Versao da API fixada de proposito. Sem isto, uma actualizacao do SDK muda
 * a forma dos objectos que recebemos e o sync passa a ler campos que ja nao
 * existem — uma falha silenciosa que so aparece quando alguem paga.
 */
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

let cached: Stripe | null = null;

/**
 * Devolve null quando nao ha chave configurada, para que a app arranque e
 * compile sem credenciais. Quem precisa da Stripe usa requireStripe().
 */
export function getStripe(): Stripe | null {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;

  cached = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "Neuma", url: "https://www.comunidadeneuma.com" },
    // A Stripe ja tenta de novo em erros de rede; limitamos para nao
    // arrastar um Server Action durante muito tempo.
    maxNetworkRetries: 2,
    timeout: 20_000,
  });

  return cached;
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      "STRIPE_SECRET_KEY nao esta configurada. Preenche o .env.local.",
    );
  }
  return stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** True quando a chave em uso e de teste. Usado para avisos na UI de admin. */
export function isStripeTestMode(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_"));
}
