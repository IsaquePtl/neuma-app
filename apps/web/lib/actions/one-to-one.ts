"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getAppOrigin } from "@/lib/auth/app-origin";
import { appUrl, sendEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripe } from "@/lib/stripe/client";
import { createOneToOnePrice } from "@/lib/stripe/one-to-one";
import { ensureStripeCustomer } from "@/lib/stripe/sync";

async function requireMentor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissão");
  return { supabase, mentorId: user.id, mentorName: profile.full_name };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type CreateInviteResult =
  | { ok: true; inviteId: string; inviteUrl: string }
  | { ok: false; error: string };

export async function createOneToOneInvite(input: {
  email: string;
  fullName: string;
  amountCents: number;
  interval: "month" | "year";
  intervalCount: number;
  notes?: string;
  sourceSubmissionId?: string | null;
}): Promise<CreateInviteResult> {
  try {
    const { mentorId, mentorName } = await requireMentor();
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();

    if (!email.includes("@")) return { ok: false, error: "Email inválido." };
    if (!fullName) return { ok: false, error: "Indica o nome." };
    if (!Number.isFinite(input.amountCents) || input.amountCents < 100) {
      return { ok: false, error: "Valor mínimo: 1,00 €." };
    }

    const priceId = await createOneToOnePrice({
      amountCents: input.amountCents,
      interval: input.interval,
      intervalCount: Math.max(1, input.intervalCount || 1),
      nickname: `Neuma 1:1 — ${fullName}`,
    });

    const token = randomBytes(24).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const admin = createAdminClient();
    const { data: invite, error } = await admin
      .from("one_to_one_invites")
      .insert({
        email,
        full_name: fullName,
        token_hash: tokenHash,
        amount_cents: input.amountCents,
        currency: "eur",
        interval: input.interval,
        interval_count: Math.max(1, input.intervalCount || 1),
        stripe_price_id: priceId,
        status: "sent",
        notes: input.notes?.trim() || null,
        source_submission_id: input.sourceSubmissionId || null,
        created_by: mentorId,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (error || !invite) {
      return { ok: false, error: error?.message ?? "Não foi possível criar o convite." };
    }

    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const origin = getAppOrigin(host ? `${proto}://${host}` : null);
    const inviteUrl = `${origin}/1-1/${token}`;

    await sendEmail({
      to: email,
      subject: "O teu convite Neuma 1:1",
      html: `
        <p>Olá ${fullName},</p>
        <p>${mentorName ?? "A Neuma"} aceitou-te no programa <strong>Neuma 1:1</strong>.</p>
        <p>Cria a tua conta e activa o acesso aqui:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p>Este link é pessoal e expira em 14 dias.</p>
      `,
    });

    revalidatePath("/studio/finance/one-to-one");
    revalidatePath("/studio/journeys/onboardings");
    return { ok: true, inviteId: invite.id, inviteUrl };
  } catch (error) {
    console.error("[one-to-one:create]", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Não foi possível criar o convite.",
    };
  }
}

export async function revokeOneToOneInvite(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMentor();
    const admin = createAdminClient();
    await admin
      .from("one_to_one_invites")
      .update({ status: "revoked" })
      .eq("id", inviteId)
      .in("status", ["pending", "sent"]);
    revalidatePath("/studio/finance/one-to-one");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao revogar.",
    };
  }
}

export type ResendInviteResult =
  | { ok: true; inviteUrl: string }
  | { ok: false; error: string };

/**
 * Gera um novo token para um convite ja existente (pending/sent/expired) e
 * reenvia o email. Nao cria preco novo na Stripe — reutiliza o existente.
 */
export async function resendOneToOneInvite(
  inviteId: string,
): Promise<ResendInviteResult> {
  try {
    const { mentorName } = await requireMentor();
    const admin = createAdminClient();
    const { data: invite } = await admin
      .from("one_to_one_invites")
      .select("*")
      .eq("id", inviteId)
      .maybeSingle();

    if (!invite) return { ok: false, error: "Convite não encontrado." };
    if (invite.status === "paid") {
      return { ok: false, error: "Este convite já foi utilizado." };
    }
    if (invite.status === "revoked") {
      return { ok: false, error: "Este convite foi revogado." };
    }

    const token = randomBytes(24).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const { error } = await admin
      .from("one_to_one_invites")
      .update({
        token_hash: tokenHash,
        status: "sent",
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", inviteId);

    if (error) return { ok: false, error: error.message };

    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const origin = getAppOrigin(host ? `${proto}://${host}` : null);
    const inviteUrl = `${origin}/1-1/${token}`;

    await sendEmail({
      to: invite.email,
      subject: "O teu convite Neuma 1:1",
      html: `
        <p>Olá ${invite.full_name ?? ""},</p>
        <p>${mentorName ?? "A Neuma"} convida-te para o programa <strong>Neuma 1:1</strong>.</p>
        <p>Cria a tua conta e activa o acesso aqui:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p>Este link é pessoal e expira em 14 dias.</p>
      `,
    });

    revalidatePath("/studio/finance/one-to-one");
    revalidatePath("/studio/journeys/onboardings");
    return { ok: true, inviteUrl };
  } catch (error) {
    console.error("[one-to-one:resend]", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Não foi possível reenviar.",
    };
  }
}

export type RedeemInviteResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

/**
 * Completa o signup do 1:1 e abre o Checkout com o preco a medida.
 * O email vem do convite e nao e editavel.
 */
export async function redeemOneToOneInvite(input: {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<RedeemInviteResult> {
  try {
    const tokenHash = hashToken(input.token);
    const admin = createAdminClient();
    const { data: invite } = await admin
      .from("one_to_one_invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!invite) return { ok: false, error: "Convite inválido." };
    if (invite.status === "revoked") {
      return { ok: false, error: "Este convite foi revogado." };
    }
    if (invite.status === "paid") {
      return { ok: false, error: "Este convite já foi utilizado." };
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await admin
        .from("one_to_one_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return { ok: false, error: "Este convite expirou." };
    }
    if (!invite.stripe_price_id) {
      return { ok: false, error: "Convite sem preço associado." };
    }
    if (!input.password || input.password.length < 5) {
      return { ok: false, error: "A password precisa de pelo menos 5 caracteres." };
    }

    const fullName =
      `${input.firstName.trim()} ${input.lastName.trim()}`.trim() ||
      invite.full_name ||
      invite.email;

    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: invite.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    let userId = created?.user?.id;
    if (createErr) {
      if (/already/i.test(createErr.message)) {
        // Conta ja existe: tentar login com a password dada nao e seguro aqui.
        // Em vez disso, pedimos que faca login e volte ao link.
        return {
          ok: false,
          error:
            "Já existe uma conta com este email. Entra e abre o link do convite outra vez.",
        };
      }
      return { ok: false, error: createErr.message };
    }
    if (!userId) return { ok: false, error: "Não foi possível criar a conta." };

    await admin.from("profiles").upsert({
      id: userId,
      email: invite.email,
      full_name: fullName,
      role: "student",
      is_one_to_one: true,
      billing_exempt: false,
      onboarding_completed: true,
    });

    // Iniciar sessao no browser: o cliente tem de fazer signIn. Devolvemos
    // o checkout URL; a pagina faz signInWithPassword e depois redirecciona.
    const customerId = await ensureStripeCustomer({
      profileId: userId,
      email: invite.email,
      fullName,
    });

    const stripe = requireStripe();
    const origin = appUrl("/");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: invite.stripe_price_id, quantity: 1 }],
      success_url: `${origin.replace(/\/$/, "")}/subscrever/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.replace(/\/$/, "")}/1-1/${input.token}?cancelado=1`,
      locale: "pt",
      metadata: {
        neuma_invite_id: invite.id,
        neuma_profile_id: userId,
        neuma_plan: "one_to_one",
      },
      subscription_data: {
        metadata: {
          neuma_profile_id: userId,
          neuma_one_to_one: "1",
          neuma_invite_id: invite.id,
        },
      },
    });

    if (!session.url) {
      return { ok: false, error: "Não foi possível abrir o pagamento." };
    }

    await admin
      .from("one_to_one_invites")
      .update({
        stripe_checkout_session_id: session.id,
        redeemed_profile_id: userId,
      })
      .eq("id", invite.id);

    return { ok: true, checkoutUrl: session.url };
  } catch (error) {
    console.error("[one-to-one:redeem]", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível activar o convite.",
    };
  }
}

export async function lookupOneToOneInvite(token: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("one_to_one_invites")
    .select(
      "id, email, full_name, amount_cents, currency, interval, interval_count, status, expires_at",
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  return data;
}
