"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  composeFullName,
  parseAge,
  parseGender,
} from "@/lib/auth/signup-profile";
import { getAppOrigin } from "@/lib/auth/app-origin";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/validation";
import { ensureDefaultMentorForStudent } from "@/lib/auth/default-mentor";
import type { ProfileGender } from "@/lib/types/database.types";

export type CreateSignupResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Cria a conta email/password e garante sessão (cookies).
 * Fase inicial: sem confirmação de email — se o projecto exigir confirm,
 * confirmamos via admin e fazemos sign-in para o passo de perfil na mesma página.
 */
export async function createSignupAccount(
  formData: FormData,
): Promise<CreateSignupResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
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
  if (!isValidPassword(password)) {
    return {
      ok: false,
      error: `A password precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    };
  }

  const fullName = composeFullName(firstName, lastName);
  const hdrs = await headers();
  const origin = getAppOrigin(hdrs.get("origin"));
  const userMeta = {
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    age,
    gender,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/login/signup?profile=1")}`,
      data: userMeta,
    },
  });

  if (error) {
    const already =
      /already|registered|exists|já existe/i.test(error.message) ||
      error.message.toLowerCase().includes("user already");
    return {
      ok: false,
      error: already
        ? "Já existe uma conta com este email."
        : error.message || "Não foi possível criar a conta.",
    };
  }

  // Conta já existente (Supabase devolve user “falso” sem identities / sem sessão).
  if (
    data.user &&
    !data.session &&
    (data.user.identities?.length ?? 0) === 0
  ) {
    return { ok: false, error: "Já existe uma conta com este email." };
  }

  let userId = data.user?.id ?? null;

  // Sem sessão = "Confirm email" activo no Dashboard. Confirmamos e iniciamos sessão.
  if (!data.session) {
    try {
      const admin = createAdminClient();
      if (userId) {
        const { error: confirmErr } = await admin.auth.admin.updateUserById(
          userId,
          { email_confirm: true, user_metadata: userMeta },
        );
        if (confirmErr) {
          return {
            ok: false,
            error:
              confirmErr.message ||
              "Não foi possível activar a conta. Tenta outra vez.",
          };
        }
      } else {
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: userMeta,
          });
        if (createErr || !created.user) {
          return {
            ok: false,
            error:
              createErr?.message || "Não foi possível criar a conta.",
          };
        }
        userId = created.user.id;
      }

      const { data: signedIn, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signedIn.session || !signedIn.user) {
        return {
          ok: false,
          error:
            "Conta criada, mas não foi possível iniciar sessão. Tenta entrar com o mesmo email.",
        };
      }
      userId = signedIn.user.id;
    } catch (err) {
      console.error("[auth.createSignupAccount] sessão pós-signup falhou:", err);
      return {
        ok: false,
        error:
          "Não foi possível concluir o registo. Verifica a configuração do servidor.",
      };
    }
  }

  // Garante perfil actualizado mesmo se o trigger já correu com metadata parcial.
  if (userId) {
    await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        age,
        gender,
        email,
      })
      .eq("id", userId);
    await ensureDefaultMentorForStudent(userId);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Guarda bio (opcional) após o passo de perfil do signup. Avatar via `uploadAvatar`. */
export async function finishSignupProfileExtras(input: {
  bio?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sessão expirada. Entra novamente." };
  }

  const bio = (input.bio ?? "").trim();
  if (bio) {
    const { error } = await supabase
      .from("profiles")
      .update({ bio })
      .eq("id", user.id);
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeSignupProfile(input: {
  firstName: string;
  lastName: string;
  age: number;
  gender: ProfileGender;
}) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const age = parseAge(input.age);
  const gender = parseGender(input.gender);

  if (!firstName || !lastName || age == null || !gender) {
    return { ok: false as const, error: "Dados de perfil incompletos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "Sessão expirada. Entra novamente." };
  }

  const fullName = composeFullName(firstName, lastName);
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      age,
      gender,
      email: user.email ?? null,
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  await ensureDefaultMentorForStudent(user.id);

  await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      age,
      gender,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}

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
  let data: Awaited<
    ReturnType<typeof supabase.auth.signInWithPassword>
  >["data"];
  let error: Awaited<
    ReturnType<typeof supabase.auth.signInWithPassword>
  >["error"];
  try {
    ({ data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    }));
  } catch (err) {
    console.error("[auth.login] signInWithPassword falhou:", err);
    redirect(
      `/login?error=${encodeURIComponent(
        "Não foi possível contactar o servidor de autenticação. Verifica a rede e tenta outra vez.",
      )}`,
    );
  }

  if (error || !data.user) {
    const networkish =
      error?.name === "AuthRetryableFetchError" ||
      /fetch failed|network|ENOTFOUND|ECONNREFUSED/i.test(
        error?.message ?? "",
      );
    redirect(
      `/login?error=${encodeURIComponent(
        networkish
          ? "Não foi possível contactar o servidor de autenticação. Verifica a rede e tenta outra vez."
          : "Credenciais invalidas.",
      )}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.role === "student") {
    await ensureDefaultMentorForStudent(data.user.id);
  }

  revalidatePath("/", "layout");
  redirect(profile?.role === "mentor" ? "/studio" : "/home");
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
  const origin = getAppOrigin(hdrs.get("origin"));

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
