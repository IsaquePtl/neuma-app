import "server-only";

import { appUrl, sendEmail } from "@/lib/email";

export async function sendSignupResumeEmail(input: {
  to: string;
  firstName: string;
  resumeToken: string;
}) {
  const resumeUrl = appUrl(
    `/login/signup?resume=${encodeURIComponent(input.resumeToken)}`,
  );
  const name = input.firstName.trim() || "olá";

  return sendEmail({
    to: input.to,
    subject: "Continua o teu registo na Neuma",
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.5; color: #111;">
        <p>Olá ${escapeHtml(name)},</p>
        <p>Começaste a criar a tua conta na <strong>Neuma</strong>, mas ainda falta escolher o plano e concluir o pagamento.</p>
        <p style="margin: 28px 0;">
          <a href="${resumeUrl}"
             style="display: inline-block; background: #e85d04; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
            Continuar com o Sign up
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Se o botão não funcionar, copia este link:<br />
          <a href="${resumeUrl}" style="color: #e85d04;">${resumeUrl}</a>
        </p>
      </div>
    `,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
