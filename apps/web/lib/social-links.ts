/** Normaliza handle Instagram: "isaque.portilho" (sem @ / URL). */
export function normalizeInstagramHandle(raw: string): string {
  let v = raw.trim();
  if (!v) return "";
  v = v.replace(/^@+/, "");
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  v = v.split(/[/?#]/)[0] ?? "";
  v = v.replace(/\/+$/, "");
  return v.trim();
}

/** URL pública do perfil Instagram. */
export function instagramProfileUrl(handle: string): string | null {
  const h = normalizeInstagramHandle(handle);
  if (!h) return null;
  return `https://www.instagram.com/${encodeURIComponent(h)}/`;
}

/** Só dígitos para wa.me (aceita +351…, espaços, etc.). */
export function normalizeWhatsappNumber(raw: string): string {
  let v = raw.trim();
  if (!v) return "";
  v = v.replace(/^https?:\/\/(wa\.me|api\.whatsapp\.com)\/(send\/?\?phone=)?/i, "");
  v = v.replace(/[^\d+]/g, "");
  // Mantém só dígitos (wa.me não quer +)
  return v.replace(/\D/g, "");
}

/** URL wa.me/<number>. */
export function whatsappChatUrl(number: string): string | null {
  const n = normalizeWhatsappNumber(number);
  if (!n || n.length < 8) return null;
  return `https://wa.me/${n}`;
}
