/**
 * Client-only screen memory for Multi-agent path creation.
 * Scoped to the Supabase auth session so logout → login starts a fresh chat.
 */

export const CREATE_PATH_SESSION_KEY = "neuma.agentsHub.createPathSession.v1";

/** Stable id for the current auth session (survives token refresh, not re-login). */
export function authSessionScopeFromAccessToken(
  accessToken: string,
): string | null {
  try {
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return null;
    const json = JSON.parse(
      atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { session_id?: string };
    if (typeof json.session_id === "string" && json.session_id) {
      return json.session_id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Prefer JWT `session_id`; fall back to refresh-token prefix (new login ⇒ new token).
 */
export function authSessionScope(session: {
  access_token: string;
  refresh_token?: string | null;
  user: { id: string };
}): string | null {
  const fromJwt = authSessionScopeFromAccessToken(session.access_token);
  if (fromJwt) return fromJwt;
  if (session.refresh_token) {
    return `rt:${session.user.id}:${session.refresh_token.slice(0, 24)}`;
  }
  return null;
}

export function clearCreatePathSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CREATE_PATH_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
