"use server";

import { randomBytes } from "node:crypto";

import { composeFullName, parseAge, parseGender } from "@/lib/auth/signup-profile";
import { isValidEmail } from "@/lib/auth/validation";
import { ensureDefaultMentorForStudent } from "@/lib/auth/default-mentor";
import { sendSignupResumeEmail } from "@/lib/email/signup-resume";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileGender } from "@/lib/types/database.types";
import type Stripe from "stripe";

export type CreateSignupLeadResult =
  | { ok: true; resumeToken: string }
  | { ok: false; error: string };

export type SignupLeadDraft = {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  gender: ProfileGender;
  resumeToken: string;
};

function newResumeToken() {
  return randomBytes(24).toString("base64url");
}

/** Passo 1 (email): grava lead de marketing — sem auth.users / profiles. */
export async function createSignupLead(
  formData: FormData,
): Promise<CreateSignupLeadResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const age = parseAge(formData.get("age"));
  const gender = parseGender(formData.get("gender"));

  if (!firstName || !lastName) {
    return { ok: false, error: "Indica o primeiro e último nome." };
  }
  if (age == null) {
    return { ok: false, error: "Indica uma idade válida (13–120)." };
  }
  if (!gender) {
    return { ok: false, error: "Indica o teu sexo." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: "Indica um email válido." };
  }

  const admin = createAdminClient();
  const fullName = composeFullName(firstName, lastName);

  // Conta já convertida / existente → login (exceto OAuth incompleto).
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, signup_incomplete")
    .ilike("email", email)
    .maybeSingle();

  if (existingProfile && !existingProfile.signup_incomplete) {
    return {
      ok: false,
      error: "Já existe uma conta com este email. Entra em /login.",
    };
  }

  const resumeToken = newResumeToken();
  const { data: existingLead } = await admin
    .from("signup_leads")
    .select("id, resume_token, resume_email_sent_at, status")
    .ilike("email", email)
    .maybeSingle();

  if (existingLead?.status === "converted") {
    return {
      ok: false,
      error: "Já existe uma conta com este email. Entra em /login.",
    };
  }

  const tokenToUse = existingLead?.resume_token ?? resumeToken;

  const { error } = await admin.from("signup_leads").upsert(
    {
      email,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      age,
      gender,
      resume_token: tokenToUse,
      status: "pending_payment",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );

  if (error) {
    console.error("[signup-leads:create]", error);
    return {
      ok: false,
      error: error.message || "Não foi possível guardar os dados.",
    };
  }

  const { data: lead } = await admin
    .from("signup_leads")
    .select("id, resume_token, resume_email_sent_at, first_name")
    .ilike("email", email)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Não foi possível guardar os dados." };
  }

  if (!lead.resume_email_sent_at) {
    const sent = await sendSignupResumeEmail({
      to: email,
      firstName: lead.first_name,
      resumeToken: lead.resume_token,
    });
    if (sent.ok || sent.skipped) {
      await admin
        .from("signup_leads")
        .update({ resume_email_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
  }

  return { ok: true, resumeToken: lead.resume_token };
}

/** OAuth: marca perfil incompleto + upsert lead para marketing. */
export async function markOAuthSignupIncomplete(input: {
  profileId: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: ProfileGender;
}): Promise<CreateSignupLeadResult> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { ok: false, error: "Email inválido." };
  }

  const admin = createAdminClient();
  const fullName = composeFullName(input.firstName, input.lastName);
  const resumeToken = newResumeToken();

  await admin
    .from("profiles")
    .update({ signup_incomplete: true })
    .eq("id", input.profileId);

  const { data: existingLead } = await admin
    .from("signup_leads")
    .select("id, resume_token, resume_email_sent_at, status")
    .ilike("email", email)
    .maybeSingle();

  const tokenToUse =
    existingLead?.status === "pending_payment" && existingLead.resume_token
      ? existingLead.resume_token
      : resumeToken;

  const { error } = await admin.from("signup_leads").upsert(
    {
      email,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      full_name: fullName,
      age: input.age,
      gender: input.gender,
      resume_token: tokenToUse,
      status: "pending_payment",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );

  if (error) {
    console.error("[signup-leads:oauth]", error);
    return { ok: false, error: error.message };
  }

  const { data: lead } = await admin
    .from("signup_leads")
    .select("id, resume_token, resume_email_sent_at, first_name")
    .ilike("email", email)
    .maybeSingle();

  if (lead && !lead.resume_email_sent_at) {
    const sent = await sendSignupResumeEmail({
      to: email,
      firstName: lead.first_name,
      resumeToken: lead.resume_token,
    });
    if (sent.ok || sent.skipped) {
      await admin
        .from("signup_leads")
        .update({ resume_email_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
  }

  return { ok: true, resumeToken: lead?.resume_token ?? tokenToUse };
}

/** Valida token de retoma (server) — para a página de signup. */
export async function getSignupLeadByResumeToken(
  token: string,
): Promise<SignupLeadDraft | null> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 16) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("signup_leads")
    .select(
      "email, first_name, last_name, full_name, age, gender, resume_token, status",
    )
    .eq("resume_token", trimmed)
    .eq("status", "pending_payment")
    .maybeSingle();

  if (!data) return null;

  return {
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    fullName: data.full_name,
    age: data.age,
    gender: data.gender,
    resumeToken: data.resume_token,
  };
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (profile?.id) {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    if (data.user) return data.user;
  }

  // Fallback raro (auth sem profile): páginas curtas.
  for (let page = 1; page <= 5; page += 1) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const match = data?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

/**
 * Após pagamento Stripe: cria (ou recupera) auth+profile a partir do lead,
 * liga a subscrição e inicia sessão no browser (quando chamado do finalize).
 */
export async function provisionSignupLeadFromCheckout(
  session: Stripe.Checkout.Session,
  options?: { establishSession?: boolean },
): Promise<
  | { ok: true; profileId: string; establishedSession: boolean }
  | { ok: false; error: string }
> {
  const leadId = session.metadata?.neuma_signup_lead_id?.trim();
  if (!leadId) {
    return { ok: false, error: "Lead em falta na sessão de pagamento." };
  }

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("signup_leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead de signup não encontrado." };
  }

  let profileId = lead.converted_profile_id;

  if (!profileId) {
    const existing = await findAuthUserByEmail(admin, lead.email);
    if (existing) {
      profileId = existing.id;
    } else {
      const tempPassword = randomBytes(32).toString("base64url");
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: lead.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            first_name: lead.first_name,
            last_name: lead.last_name,
            full_name: lead.full_name,
            age: lead.age,
            gender: lead.gender,
            neuma_needs_password: true,
          },
        });

      if (createErr || !created.user) {
        console.error("[signup-leads:provision:create]", createErr);
        return {
          ok: false,
          error: createErr?.message || "Não foi possível criar a conta.",
        };
      }
      profileId = created.user.id;
    }

    await admin
      .from("profiles")
      .update({
        full_name: lead.full_name,
        age: lead.age,
        gender: lead.gender,
        email: lead.email,
        signup_incomplete: false,
      })
      .eq("id", profileId);

    await ensureDefaultMentorForStudent(profileId);

    await admin
      .from("signup_leads")
      .update({
        status: "converted",
        converted_profile_id: profileId,
        stripe_checkout_session_id: session.id,
        selected_plan:
          (session.metadata?.neuma_plan as
            | "monthly"
            | "quarterly"
            | "annual"
            | null) ?? lead.selected_plan,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
  } else {
    await admin
      .from("profiles")
      .update({ signup_incomplete: false })
      .eq("id", profileId);
  }

  // Ligar Stripe customer → profile (metadata + billing_customers).
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (customerId) {
    try {
      const { requireStripe } = await import("@/lib/stripe/client");
      const stripe = requireStripe();
      await stripe.customers.update(customerId, {
        metadata: { neuma_profile_id: profileId },
        email: lead.email,
        name: lead.full_name,
      });
    } catch (err) {
      console.error("[signup-leads:provision:customer]", err);
    }

    await admin.from("billing_customers").upsert(
      {
        profile_id: profileId,
        stripe_customer_id: customerId,
        email: lead.email,
      },
      { onConflict: "profile_id" },
    );
  }

  let establishedSession = false;
  if (options?.establishSession) {
    const tempPassword = randomBytes(32).toString("base64url");
    const { error: pwErr } = await admin.auth.admin.updateUserById(profileId, {
      password: tempPassword,
      user_metadata: {
        first_name: lead.first_name,
        last_name: lead.last_name,
        full_name: lead.full_name,
        age: lead.age,
        gender: lead.gender,
        neuma_needs_password: true,
      },
    });
    if (pwErr) {
      console.error("[signup-leads:provision:password]", pwErr);
      return {
        ok: false,
        error: "Conta criada, mas não foi possível iniciar sessão.",
      };
    }

    const supabase = await createClient();
    const { data: signedIn, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: lead.email,
        password: tempPassword,
      });

    if (signInError || !signedIn.session) {
      console.error("[signup-leads:provision:signin]", signInError);
      return {
        ok: false,
        error: "Conta criada, mas não foi possível iniciar sessão.",
      };
    }
    establishedSession = true;
  }

  return { ok: true, profileId, establishedSession };
}
