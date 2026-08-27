import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getAppOrigin } from "@/lib/auth/app-origin";
import { ensureDefaultMentorForStudent } from "@/lib/auth/default-mentor";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database.types";

type PendingCookie = { name: string; value: string; options: CookieOptions };

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/**
 * Troca o code OAuth/magic-link por sessão.
 * - intent=login: só contas já existentes (perfil em `profiles`); conta nova → signup
 * - intent=signup: cria/entra e volta a /login/signup?profile=1 (foto/bio)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const intent = searchParams.get("intent") === "signup" ? "signup" : "login";

  const requestOrigin = new URL(request.url).origin;
  const origin =
    requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1")
      ? requestOrigin
      : getAppOrigin(requestOrigin);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
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
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
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
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        networkish
          ? "Não foi possível contactar o servidor de autenticação. Verifica a rede e tenta outra vez."
          : "Falha no login. Tenta outra vez.",
      )}`,
    );
  }

  // Login social: só entra se já existir perfil (conta criada antes).
  // O heurístico created_at < 2min era frágil e rejeitava contas reais
  // (ex.: email/password + Google, ou re-login logo após o registo).
  if (intent === "login") {
    const userId = data.user.id;
    const email = data.user.email?.trim().toLowerCase() ?? null;

    let profileId: string | null = null;
    try {
      const admin = createAdminClient();
      const { data: byId } = await admin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      profileId = byId?.id ?? null;

      if (!profileId && email) {
        const { data: byEmail } = await admin
          .from("profiles")
          .select("id, email")
          .ilike("email", email)
          .maybeSingle();
        if (byEmail) {
          // Conta existe com este email, mas o Google criou um auth user novo
          // (identidades não ligadas). Não deixar entrar com o user órfão.
          await supabase.auth.signOut();
          try {
            await admin.auth.admin.deleteUser(userId);
          } catch {
            // ignore
          }
          const response = NextResponse.redirect(
            `${origin}/login?error=${encodeURIComponent(
              "Já tens conta com este email. Entra com email e password (ou regista-te com Google a partir de Criar conta se ainda não o fizeste).",
            )}`,
          );
          pendingCookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          return response;
        }
      }
    } catch {
      // Sem admin: cai para o select com a sessão do user.
      const { data: byId } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      profileId = byId?.id ?? null;
    }

    if (!profileId) {
      await supabase.auth.signOut();
      try {
        const admin = createAdminClient();
        await admin.auth.admin.deleteUser(userId);
      } catch {
        // Se a delete falhar, o user fica órfão — ainda assim não entra na app.
      }

      const response = NextResponse.redirect(
        `${origin}/login/signup?error=${encodeURIComponent(
          "Esta conta Google ainda não está registada. Cria a tua conta primeiro.",
        )}`,
      );
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
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

  const destination =
    intent === "signup"
      ? next.includes("profile=1")
        ? next
        : "/login/signup?profile=1"
      : next === "/"
        ? profile?.role === "mentor"
          ? "/studio"
          : "/home"
        : next;

  const response = NextResponse.redirect(`${origin}${destination}`);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
