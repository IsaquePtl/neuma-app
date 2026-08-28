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

  // Preferir o host que o utilizador usou (custom domain vs alias vercel.app).
  // NEXT_PUBLIC_SITE_URL pode apontar para outro alias e partir cookies OAuth.
  if (requestOrigin) {
    return requestOrigin.replace(/\/$/, "");
  }

  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  return "http://localhost:3001";
}

/** Origin a usar no browser (OAuth redirectTo). Sempre o host actual. */
export function getBrowserAppOrigin() {
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return getAppOrigin(null);
}

/** Redirect relativo ao pedido HTTP — evita saltar de domínio após OAuth. */
export function redirectUrlForRequest(
  request: { url: string },
  pathname: string,
) {
  return new URL(pathname, request.url);
}
