export const OAUTH_SHEET_CHANNEL = "neuma-oauth";
export const OAUTH_SHEET_WINDOW = "neuma-oauth";

export function safeOauthNext(value: unknown) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/** Telefone e iPad, incluindo iPadOS que se apresenta como Mac. */
export function prefersOauthSheet() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const iPadOs =
    navigator.maxTouchPoints > 1 && /MacIntel|iPad/.test(navigator.platform);
  return coarse || noHover || iPadOs;
}
