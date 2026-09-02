"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generateTempPassword() {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${out}!`;
}

async function requireMentor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissao");
  return { supabase, mentorId: user.id };
}

export type InviteResult =
  | { ok: true; email: string; tempPassword: string; userId: string }
  | { ok: false; error: string };

export async function inviteStudent(formData: FormData): Promise<InviteResult> {
  const { mentorId } = await requireMentor();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Email invalido." };
  }
  if (!fullName) {
    return { ok: false, error: "Indica o nome do aluno." };
  }

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let userId = created?.user?.id;

  if (createErr) {
    if (/already/i.test(createErr.message)) {
      return {
        ok: false,
        error: "Ja existe uma conta com este email.",
      };
    }
    return { ok: false, error: createErr.message };
  }

  if (!userId) {
    return { ok: false, error: "Nao foi possivel criar o utilizador." };
  }

  const { error: profErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role: "student",
      mentor_id: mentorId,
      onboarding_completed: false,
      // Por omissao, alunos convidados a mao nao passam pelo paywall.
      // O mentor pode exigir cobranca com o interruptor "Cobrar via Stripe".
      billing_exempt: formData.get("charge_via_stripe") !== "on",
    },
    { onConflict: "id" },
  );

  if (profErr) {
    return { ok: false, error: profErr.message };
  }

  revalidatePath("/studio/students");
  revalidatePath("/studio");

  return { ok: true, email, tempPassword, userId };
}
