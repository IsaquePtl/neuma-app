"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getAppOrigin } from "@/lib/auth/app-origin";
import { parseAge, parseGender } from "@/lib/auth/signup-profile";
import {
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/validation";
import { appUrl, sendEmail } from "@/lib/email";
import {
  oneToOneInvitePath,
  oneToOneInviteUrl,
} from "@/lib/one-to-one/invite-path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripe } from "@/lib/stripe/client";
import { createOneToOnePrice } from "@/lib/stripe/one-to-one";
import { ensureStripeCustomer } from "@/lib/stripe/sync";
import type { ProfileGender } from "@/lib/types/database.types";

export type OneToOneBillingMode = "recurring" | "one_time";
export type OneToOneIntervalMonths = 1 | 2 | 3;

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

function checkoutIntegrationId(flow: string) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `neuma_${flow}_${suffix}`;
}

export type CreateInviteResult =
  | { ok: true; inviteId: string; inviteUrl: string }
  | { ok: false; error: string };

export async function createOneToOneInvite(input: {
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: ProfileGender;
  amountCents: number;
  billingMode: OneToOneBillingMode;
  /** Recurring only: every 1 / 2 / 3 months. */
  intervalMonths?: OneToOneIntervalMonths;
  /** Total program length in months (≥ 1). */
  durationMonths: number;
  sourceSubmissionId?: string | null;
}): Promise<CreateInviteResult> {
  try {
    const { mentorId, mentorName } = await requireMentor();
    const email = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const age = parseAge(input.age);
    const gender = parseGender(input.gender);
    const durationMonths = Math.max(1, Math.floor(input.durationMonths || 1));
    const billingMode = input.billingMode === "one_time" ? "one_time" : "recurring";
    const intervalMonths = ([1, 2, 3] as const).includes(
      input.intervalMonths as OneToOneIntervalMonths,
    )
      ? (input.intervalMonths as OneToOneIntervalMonths)
      : 1;

    if (!email.includes("@")) return { ok: false, error: "Email inválido." };
    if (!firstName || !lastName) {
      return { ok: false, error: "Indica primeiro e último nome." };
    }
    if (age == null) {
      return { ok: false, error: "Indica uma idade válida (13–120)." };
    }
    if (!gender) {
      return { ok: false, error: "Indica o sexo." };
    }
    if (!Number.isFinite(input.amountCents) || input.amountCents < 100) {
      return { ok: false, error: "Valor mínimo: 1,00 €." };
    }

    const priceId = await createOneToOnePrice({
      amountCents: input.amountCents,
      billingMode,
      intervalMonths: billingMode === "recurring" ? intervalMonths : undefined,
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
        first_name: firstName,
        last_name: lastName,
        age,
        gender,
        token_hash: tokenHash,
        amount_cents: input.amountCents,
        currency: "eur",
        interval: "month",
        interval_count: billingMode === "recurring" ? intervalMonths : 1,
        duration_months: durationMonths,
        billing_mode: billingMode,
        stripe_price_id: priceId,
        status: "sent",
        notes: null,
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
    const inviteUrl = oneToOneInviteUrl(origin, token);

    await sendEmail({
      to: email,
      subject: "O teu convite Neuma 1:1",
      html: `
        <p>Olá ${firstName},</p>
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
    const inviteUrl = oneToOneInviteUrl(origin, token);

    await sendEmail({
      to: invite.email,
      subject: "O teu convite Neuma 1:1",
      html: `
        <p>Olá ${invite.first_name ?? invite.full_name ?? ""},</p>
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

export type RedeemAccountResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Passo 2 do wizard 1:1 — cria a conta com password (email vem do convite).
 */
export async function redeemOneToOneAccount(input: {
  token: string;
  password: string;
}): Promise<RedeemAccountResult> {
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
    if (!isValidPassword(input.password)) {
      return {
        ok: false,
        error: `A password precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      };
    }

    const firstName = (invite.first_name || "").trim();
    const lastName = (invite.last_name || "").trim();
    const fullName =
      `${firstName} ${lastName}`.trim() ||
      invite.full_name ||
      invite.email;

    if (invite.redeemed_profile_id) {
      // Conta já criada neste convite — o cliente só precisa de entrar.
      return { ok: true };
    }

    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: invite.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          age: invite.age ?? undefined,
          gender: invite.gender ?? undefined,
        },
      });

    let userId = created?.user?.id;
    if (createErr) {
      if (/already/i.test(createErr.message)) {
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
      age: invite.age,
      gender: invite.gender,
      is_one_to_one: false,
      billing_exempt: false,
      onboarding_completed: true,
    });

    await admin
      .from("one_to_one_invites")
      .update({ redeemed_profile_id: userId })
      .eq("id", invite.id);

    return { ok: true };
  } catch (error) {
    console.error("[one-to-one:account]", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar a conta.",
    };
  }
}

export type RedeemCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

/**
 * Passo 3 — abre Stripe Checkout (subscription ou one-time) para o convite.
 * Requer sessão autenticada do aluno do convite.
 */
export async function startOneToOneCheckout(input: {
  token: string;
}): Promise<RedeemCheckoutResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    const tokenHash = hashToken(input.token);
    const admin = createAdminClient();
    const { data: invite } = await admin
      .from("one_to_one_invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!invite) return { ok: false, error: "Convite inválido." };
    if (invite.status === "paid") {
      return { ok: false, error: "Este convite já foi utilizado." };
    }
    if (invite.status === "revoked") {
      return { ok: false, error: "Este convite foi revogado." };
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await admin
        .from("one_to_one_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return { ok: false, error: "Este convite expirou." };
    }
    const sessionEmail = (user.email ?? "").trim().toLowerCase();
    const inviteEmail = (invite.email ?? "").trim().toLowerCase();
    if (!sessionEmail || sessionEmail !== inviteEmail) {
      return { ok: false, error: "Este convite pertence a outro email." };
    }
    if (!invite.stripe_price_id) {
      return { ok: false, error: "Convite sem preço associado." };
    }
    if (
      invite.redeemed_profile_id &&
      invite.redeemed_profile_id !== user.id
    ) {
      return { ok: false, error: "Este convite pertence a outra conta." };
    }

    // Conta que já existia antes do convite: não pode ser mentor e tem de ter
    // perfil. is_one_to_one só passa a true no webhook, depois do pagamento.
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "mentor") {
      return {
        ok: false,
        error: "Uma conta de mentor não pode activar este convite.",
      };
    }
    const fullName = profile?.full_name || invite.full_name || invite.email;
    if (!profile) {
      const { error: profileError } = await admin.from("profiles").insert({
        id: user.id,
        email: invite.email,
        full_name: fullName,
        role: "student",
        is_one_to_one: false,
        billing_exempt: false,
      });
      if (profileError) return { ok: false, error: profileError.message };
    }

    const customerId = await ensureStripeCustomer({
      profileId: user.id,
      email: invite.email,
      fullName,
    });

    const stripe = requireStripe();
    const origin = appUrl("/");
    const billingMode =
      invite.billing_mode === "one_time" ? "one_time" : "recurring";
    const durationMonths = Math.max(1, invite.duration_months ?? 1);

    const session = await stripe.checkout.sessions.create({
      mode: billingMode === "one_time" ? "payment" : "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: invite.stripe_price_id, quantity: 1 }],
      success_url: `${origin.replace(/\/$/, "")}/subscrever/sucesso?session_id={CHECKOUT_SESSION_ID}&one_to_one=1`,
      cancel_url: `${origin.replace(/\/$/, "")}${oneToOneInvitePath(input.token)}?cancelado=1`,
      locale: "pt",
      integration_identifier: checkoutIntegrationId("one_to_one"),
      metadata: {
        neuma_invite_id: invite.id,
        neuma_profile_id: user.id,
        neuma_plan: "one_to_one",
        neuma_billing_mode: billingMode,
        neuma_duration_months: String(durationMonths),
      },
      ...(billingMode === "recurring"
        ? {
            subscription_data: {
              metadata: {
                neuma_profile_id: user.id,
                neuma_one_to_one: "1",
                neuma_invite_id: invite.id,
                neuma_duration_months: String(durationMonths),
              },
            },
          }
        : {
            payment_intent_data: {
              metadata: {
                neuma_profile_id: user.id,
                neuma_one_to_one: "1",
                neuma_invite_id: invite.id,
                neuma_duration_months: String(durationMonths),
              },
            },
          }),
    });

    if (!session.url) {
      return { ok: false, error: "Não foi possível abrir o pagamento." };
    }

    const { error: inviteError } = await admin
      .from("one_to_one_invites")
      .update({
        stripe_checkout_session_id: session.id,
        redeemed_profile_id: user.id,
      })
      .eq("id", invite.id);
    if (inviteError) return { ok: false, error: inviteError.message };

    return { ok: true, checkoutUrl: session.url };
  } catch (error) {
    console.error("[one-to-one:checkout]", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o pagamento.",
    };
  }
}

/** @deprecated Use redeemOneToOneAccount + startOneToOneCheckout */
export async function redeemOneToOneInvite(input: {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  const account = await redeemOneToOneAccount({
    token: input.token,
    password: input.password,
  });
  if (!account.ok) return account;
  // Caller must sign in then call startOneToOneCheckout
  return {
    ok: false,
    error: "Fluxo actualizado — usa o wizard do convite.",
  };
}

export async function lookupOneToOneInvite(token: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("one_to_one_invites")
    .select(
      "id, email, full_name, first_name, last_name, amount_cents, currency, interval, interval_count, duration_months, billing_mode, status, expires_at",
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  return data;
}
