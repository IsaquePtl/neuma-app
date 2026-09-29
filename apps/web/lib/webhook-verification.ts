/**
 * Unsigned Cal/Tally bodies are only acceptable on a local dev server.
 * Production, and any non-localhost site URL, must present a secret.
 */
export function webhookMustBeSigned(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!site) return false;
  try {
    const host = new URL(site).hostname;
    return host !== "localhost" && host !== "127.0.0.1";
  } catch {
    return true;
  }
}
