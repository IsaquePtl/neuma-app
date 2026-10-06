import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { redirectUrlForRequest } from "@/lib/auth/app-origin";
import { ensureDefaultMentorForStudent } from "@/lib/auth/default-mentor";
import { googleLoginShouldFinishSignup } from "@/lib/auth/signup-complete";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database.types";
import { SIGNUP_FINISHING_COOKIE } from "@/lib/auth/signup-wizard";

type PendingCookie = { name: string; value: string; options: CookieOptions };

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  pendingCookies: PendingCookie[],
  options?: { signupFinishing?: boolean },
) {
  const response = NextResponse.redirect(redirectUrlForRequest(request, pathname));
  pendingCookies.forEach(({ name, value, options: cookieOptions }) => {
    response.cookies.set(name, value, cookieOptions);
  });
  if (options?.signupFinishing) {
    response.cookies.set(SIGNUP_FINISHING_COOKIE, "1", {
      path: "/",
      maxAge: 1800,
      sameSite: "lax",
      httpOnly: true,
    });
  }
  return response;
}

/**
 * Troca o code OAuth/magic-link por sessão.
 * - intent=login: só contas já existentes (perfil em `profiles`); conta nova → signup
 * - intent=signup: cria/entra e volta a /login/signup (plano ou perfil)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const intent = searchParams.get("intent") === "signup" ? "signup" : "login";
  const sheet = searchParams.get("sheet") === "1";

  function authRedirect(
    pathname: string,
    cookies: PendingCookie[] = [],
    options?: { signupFinishing?: boolean },
  ) {
    const target = sheet
      ? `/auth/sheet-return?next=${encodeURIComponent(pathname)}`
      : pathname;
    if (cookies.length === 0 && !options?.signupFinishing) {
      return NextResponse.redirect(redirectUrlForRequest(request, target));
    }
    return redirectWithCookies(request, target, cookies, options);
  }

  if (!code) {
    return authRedirect("/login?error=auth");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return authRedirect("/login?error=auth");
  }

  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  let data: Awaited<
    ReturnType<typeof supabase.auth.exchangeCodeForSession>
  >["data"];
  let error: Awaited<
    ReturnType<typeof supabase.auth.exchangeCodeForSession>
  >["error"];
  try {
    ({ data, error } = await supabase.auth.exchangeCodeForSession(code));
  } catch (err) {
    console.error("[auth.callback] exchangeCodeForSession falhou:", err);
    return authRedirect(
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
    return authRedirect(
      `/login?error=${encodeURIComponent(
        networkish
          ? "Não foi possível contactar o servidor de autenticação. Verifica a rede e tenta outra vez."
          : "Falha no login. Tenta outra vez.",
      )}`,
    );
  }

  // Login social: contas novas ou perfil incompleto → terminar registo em /login/signup.
  if (intent === "login") {
    const userId = data.user.id;
    const email = data.user.email?.trim().toLowerCase() ?? null;

    type ProfileRow = {
      id: string;
      role: string | null;
      age: number | null;
      gender: string | null;
      signup_incomplete: boolean;
      onboarding_completed: boolean;
      created_at: string;
    };

    let profileRow: ProfileRow | null = null;

    try {
      const admin = createAdminClient();
      const { data: byId } = await admin
        .from("profiles")
        .select(
          "id, role, age, gender, signup_incomplete, onboarding_completed, created_at",
        )
        .eq("id", userId)
        .maybeSingle();
      profileRow = byId ?? null;

      if (!profileRow && email) {
        const { data: byEmail } = await admin
          .from("profiles")
          .select("id, email")
          .ilike("email", email)
          .maybeSingle();
        if (byEmail) {
          await supabase.auth.signOut();
          try {
            await admin.auth.admin.deleteUser(userId);
          } catch {
            // ignore
          }
          return authRedirect(
            `/login?error=${encodeURIComponent(
              "Já tens conta com este email. Usa email e password, ou entra com Google se criaste conta assim.",
            )}`,
            pendingCookies,
          );
        }
      }
    } catch {
      const { data: byId } = await supabase
        .from("profiles")
        .select(
          "id, role, age, gender, signup_incomplete, onboarding_completed, created_at",
        )
        .eq("id", userId)
        .maybeSingle();
      profileRow = byId ?? null;
    }

    if (googleLoginShouldFinishSignup(profileRow)) {
      if (profileRow?.role === "student" || !profileRow) {
        await ensureDefaultMentorForStudent(userId);
      }
      return authRedirect("/login/signup?oauth=1", pendingCookies, {
        signupFinishing: true,
      });
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.role === "student" || (!profile && intent === "signup")) {
    await ensureDefaultMentorForStudent(data.user.id);
  }

  // Signup OAuth: marcar incompleto até pagar (evita /subscrever).
  if (intent === "signup") {
    try {
      const { isBillingEnabled } = await import("@/lib/billing/access");
      if (isBillingEnabled()) {
        const admin = createAdminClient();
        await admin
          .from("profiles")
          .update({ signup_incomplete: true })
          .eq("id", data.user.id);
      }
    } catch (err) {
      console.error("[auth.callback] signup_incomplete:", err);
    }
  }

  await supabase.auth.getSession();

  const destination =
    intent === "signup"
      ? "/login/signup"
      : next === "/"
        ? profile?.role === "mentor"
          ? "/studio"
          : "/home"
        : next;

  return authRedirect(destination, pendingCookies, {
    signupFinishing: intent === "signup",
  });
}
