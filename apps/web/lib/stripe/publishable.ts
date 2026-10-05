/** Publishable key — safe for the browser (Stripe.js). */
export function getStripePublishableKey() {
  return (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();
}
