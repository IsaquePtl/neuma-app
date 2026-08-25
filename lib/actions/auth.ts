"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/validation";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!isValidEmail(email)) {
    redirect(`/login?error=${encodeURIComponent("Indica um email valido.")}`);
  }

  if (!isValidPassword(password)) {
    redirect(
      `/login?error=${encodeURIComponent(`A password precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Credenciais invalidas.")}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(
      `/login/forgot?error=${encodeURIComponent("Indica o teu email.")}`,
    );
  }

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3001";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/login/update-password`,
  });

  if (error) {
    redirect(
      `/login/forgot?error=${encodeURIComponent("Nao foi possivel enviar o email.")}`,
    );
  }

  redirect(
    `/login/forgot?ok=${encodeURIComponent("Se o email existir, enviaremos um link.")}`,
  );
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!isValidPassword(password)) {
    redirect(
      `/login/update-password?error=${encodeURIComponent(`A password precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)}`,
    );
  }
  if (password !== confirm) {
    redirect(
      `/login/update-password?error=${encodeURIComponent("As passwords nao coincidem.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(
      `/login/update-password?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/", "layout");
  redirect("/?ok=password");
}
