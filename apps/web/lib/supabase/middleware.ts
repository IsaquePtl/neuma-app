import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/types/database.types";
import { googleLoginShouldFinishSignup } from "@/lib/auth/signup-complete";
import { SIGNUP_FINISHING_COOKIE } from "@/lib/auth/signup-wizard";
import { isOneToOneInvitePath } from "@/lib/one-to-one/invite-path";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/login/forgot",
  "/login/signup",
  "/login/update-password",
  "/onboarding",
  "/soundworks",
  "/api/tally/webhook",
  "/api/cal/webhook",
  // A Stripe chama isto sem sessao; a autenticidade vem da assinatura.
  "/api/stripe/webhook",
  "/subscrever",
  "/subscrever/sucesso",
  "/privacidade",
  "/termos",
  "/robots.txt",
  "/sitemap.xml",
];

/** Pós-signup: autenticado pode ficar; anónimo é redireccionado para login. */
const AUTH_POST_SIGNUP_PATHS = new Set(["/login/welcome"]);

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem env o proxy não autentica. Abrir a app seria pior do que um 503.
  if (!url || !anonKey) {
    console.error(
      "[middleware] Faltam NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    return new NextResponse(
      "Serviço indisponível: configuração Supabase em falta.",
      { status: 503 },
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANTE: nao correr codigo entre createServerClient e getUser().
  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    // DNS/rede (ex.: ENOTFOUND) nao deve derrubar rotas publicas.
    console.error("[middleware] supabase.auth.getUser falhou:", err);
  }

  const path = request.nextUrl.pathname;
  const isPostSignup = AUTH_POST_SIGNUP_PATHS.has(path);
  const isPublic =
    PUBLIC_PATHS.includes(path) ||
    path.startsWith("/api/tally/") ||
    (path.startsWith("/login/") && !isPostSignup) ||
    path.startsWith("/auth/") ||
    path.startsWith("/.well-known/") ||
    path.startsWith("/1-1/") ||
    isOneToOneInvitePath(path);

  if (!user && !isPublic) {
    // APIs devem devolver JSON — nunca HTML do /login (quebra fetch().json()).
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && path === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  // Autenticado a terminar registo (plano / perfil) — cookie ou flag signup_incomplete.
  if (user && path === "/login/signup") {
    const { data: signupProfile } = await supabase
      .from("profiles")
      .select(
        "role, age, gender, signup_incomplete, onboarding_completed, created_at",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (signupProfile && !googleLoginShouldFinishSignup(signupProfile)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set(SIGNUP_FINISHING_COOKIE, "", {
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    const finishing =
      request.cookies.get(SIGNUP_FINISHING_COOKIE)?.value === "1";
    if (!finishing) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("signup_incomplete")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.signup_incomplete) {
        supabaseResponse.cookies.set(SIGNUP_FINISHING_COOKIE, "1", {
          path: "/",
          maxAge: 1800,
          sameSite: "lax",
          httpOnly: true,
        });
      } else {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/";
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return supabaseResponse;
}
