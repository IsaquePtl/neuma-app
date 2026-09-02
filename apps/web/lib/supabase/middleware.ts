import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/types/database.types";
import { SIGNUP_FINISHING_COOKIE } from "@/lib/auth/signup-wizard";

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
];

/** Pós-signup: autenticado pode ficar; anónimo é redireccionado para login. */
const AUTH_POST_SIGNUP_PATHS = new Set(["/login/welcome"]);

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem env no Vercel o createServerClient rebenta → MIDDLEWARE_INVOCATION_FAILED.
  if (!url || !anonKey) {
    console.error(
      "[middleware] Faltam NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    return NextResponse.next({ request });
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
    path.startsWith("/auth/");

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

  // Autenticado a terminar registo (passo 3) — cookie definido antes do OAuth ou ao criar conta.
  if (user && path === "/login/signup") {
    const finishing =
      request.cookies.get(SIGNUP_FINISHING_COOKIE)?.value === "1";
    if (!finishing) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
