/**
 * Opaque redeem token in the URL: raw base64url secret (hashed as token_hash in DB).
 * Created via `randomBytes(24).toString("base64url")` → ~32 chars.
 */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

/** Safety net — static App Router pages still win, but middleware must not treat these as invites. */
const RESERVED_ROOT_SEGMENTS = new Set([
  "login",
  "home",
  "studio",
  "onboarding",
  "subscrever",
  "soundworks",
  "auth",
  "api",
  "settings",
  "path",
  "checkins",
  "session",
  "tools",
  "1-1",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "_next",
  "manifest.webmanifest",
]);

export function isOneToOneInvitePathSegment(segment: string): boolean {
  if (!segment || RESERVED_ROOT_SEGMENTS.has(segment.toLowerCase())) {
    return false;
  }
  return INVITE_TOKEN_PATTERN.test(segment);
}

/** True for `/{token}` (single segment matching invite token shape). */
export function isOneToOneInvitePath(pathname: string): boolean {
  const match = pathname.match(/^\/([^/]+)\/?$/);
  if (!match) return false;
  return isOneToOneInvitePathSegment(match[1]);
}

export function oneToOneInvitePath(token: string): string {
  return `/${token}`;
}

export function oneToOneInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/${token}`;
}
