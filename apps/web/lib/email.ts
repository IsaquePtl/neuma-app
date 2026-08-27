import "server-only";

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
};

/** Envia email via Resend. Sem RESEND_API_KEY, faz no-op (log). */
export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ?? "Neuma <onboarding@resend.dev>";

  if (!key) {
    console.info("[email:skip]", { to, subject });
    return { ok: false as const, skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email:error]", res.status, body);
    return { ok: false as const, skipped: false };
  }

  return { ok: true as const, skipped: false };
}

export function appUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3001");
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
