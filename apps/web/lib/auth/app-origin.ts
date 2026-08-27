/**
 * Origin da app para redirects de Auth (OAuth, email, recovery).
 * Em desenvolvimento força localhost para não ir para produção.
 */
export function getAppOrigin(requestOrigin?: string | null) {
  if (process.env.NODE_ENV === "development") {
    return (
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3001"
    );
  }

  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (requestOrigin) return requestOrigin.replace(/\/$/, "");

  return "http://localhost:3001";
}

/** Origin a usar no browser (OAuth redirectTo). */
export function getBrowserAppOrigin() {
  if (typeof window !== "undefined") {
    const { origin } = window.location;
    if (
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      process.env.NODE_ENV === "development"
    ) {
      return origin;
    }
  }
  return getAppOrigin(typeof window !== "undefined" ? window.location.origin : null);
}
