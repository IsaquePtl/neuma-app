"use client";

import { useEffect, useRef, useState } from "react";

import { getBrowserAppOrigin } from "@/lib/auth/app-origin";
import {
  parseAge,
  parseGender,
  type SignupProfileDraft,
  writeSignupProfileDraft,
} from "@/lib/auth/signup-profile";
import {
  setSignupFinishingCookie,
  writeSignupWizardStep,
} from "@/lib/auth/signup-wizard";
import {
  OAUTH_SHEET_CHANNEL,
  OAUTH_SHEET_WINDOW,
  prefersOauthSheet,
  safeOauthNext,
} from "@/lib/auth/oauth-sheet";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type OAuthProvider = "google" | "apple";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("size-5", className)}>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("size-5", className)}>
      <path
        fill="currentColor"
        d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </svg>
  );
}

const OAUTH_BUTTON_CLASS =
  "h-11 flex-1 border border-white/12 bg-white/[0.06] text-foreground hover:bg-white/12";

/**
 * No iPad/iOS o toque no Google faz o visualViewport (barra do Safari) deslocar
 * o documento para cima. A parede é absolute, por isso vai atrás e deixa de
 * cobrir o ecrã. Travamos o tamanho em px e anulamos esse offset.
 */
let oauthLockBaseTop = 0;
let oauthLockBaseLeft = 0;
let oauthLockFrame = 0;
let oauthLockListening = false;

function lockBox(el: HTMLElement, width: number, height: number) {
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.minWidth = `${width}px`;
  el.style.minHeight = `${height}px`;
  el.style.maxWidth = `${width}px`;
  el.style.maxHeight = `${height}px`;
}

function freezePaintedBox(el: HTMLElement) {
  if (el.dataset.frozen === "1") return;
  const cs = getComputedStyle(el);
  if (cs.display === "none") return;
  el.dataset.frozen = "1";
  el.style.top = cs.top;
  el.style.left = cs.left;
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.width = cs.width;
  el.style.height = cs.height;
  el.style.maxWidth = cs.width;
  el.style.maxHeight = cs.height;
  el.style.transform = cs.transform;
}

function holdAuthViewport() {
  const vv = window.visualViewport;
  const dy = Math.round((vv?.offsetTop ?? 0) - oauthLockBaseTop);
  const dx = Math.round((vv?.offsetLeft ?? 0) - oauthLockBaseLeft);
  document.body.style.transform =
    dx || dy ? `translate3d(${dx}px, ${dy}px, 0)` : "";
  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo(0, 0);
  }
}

function freezeAuthBackground() {
  const root = document.documentElement;
  if (!root.classList.contains("oauth-leaving")) {
    const vv = window.visualViewport;
    oauthLockBaseTop = vv?.offsetTop ?? 0;
    oauthLockBaseLeft = vv?.offsetLeft ?? 0;
    const width = Math.round(vv?.width || root.clientWidth);
    const height = Math.round(vv?.height || root.clientHeight);
    lockBox(root, width, height);
    lockBox(document.body, width, height);
    document.querySelectorAll<HTMLElement>(".neuma-bg").forEach((bg) => {
      freezePaintedBox(bg);
      bg.querySelectorAll<HTMLElement>("*").forEach(freezePaintedBox);
    });
    root.classList.add("oauth-leaving");
  }

  holdAuthViewport();

  if (!oauthLockListening) {
    oauthLockListening = true;
    window.visualViewport?.addEventListener("scroll", holdAuthViewport);
    window.visualViewport?.addEventListener("resize", holdAuthViewport);
    window.addEventListener("scroll", holdAuthViewport, { passive: true });
    const tick = () => {
      holdAuthViewport();
      oauthLockFrame = requestAnimationFrame(tick);
    };
    oauthLockFrame = requestAnimationFrame(tick);
  }
}

function releaseAuthBackground() {
  cancelAnimationFrame(oauthLockFrame);
  oauthLockFrame = 0;
  if (oauthLockListening) {
    oauthLockListening = false;
    window.visualViewport?.removeEventListener("scroll", holdAuthViewport);
    window.visualViewport?.removeEventListener("resize", holdAuthViewport);
    window.removeEventListener("scroll", holdAuthViewport);
  }
  document.documentElement.classList.remove("oauth-leaving");
  for (const el of [document.documentElement, document.body]) {
    el.style.width = "";
    el.style.height = "";
    el.style.minWidth = "";
    el.style.minHeight = "";
    el.style.maxWidth = "";
    el.style.maxHeight = "";
  }
  document.body.style.transform = "";
  document.querySelectorAll<HTMLElement>("[data-frozen='1']").forEach((el) => {
    delete el.dataset.frozen;
    el.style.top = "";
    el.style.left = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.width = "";
    el.style.height = "";
    el.style.maxWidth = "";
    el.style.maxHeight = "";
    el.style.transform = "";
  });
}

export function OAuthSignInButtons({
  intent = "login",
  nextPath = "/",
  dividerLabel = "ou continuar com",
  layout = "stack",
  getSignupDraft,
  signupNextStep = "identity",
  onBeforeRedirect,
}: {
  intent?: "login" | "signup";
  nextPath?: string;
  dividerLabel?: string;
  /** `row` = Google + Apple lado a lado (login). */
  layout?: "stack" | "row";
  getSignupDraft?: () => SignupProfileDraft | null;
  /** Passo do wizard a retomar após OAuth no signup. */
  signupNextStep?: "identity" | "plan" | "profile" | "credentials";
  /** Chamado antes do redirect OAuth (ex.: guardar passo do wizard). */
  onBeforeRedirect?: () => void;
} = {}) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigating = useRef(false);
  const sheetWatch = useRef<number | null>(null);
  const sheetChannel = useRef<BroadcastChannel | null>(null);

  function stopSheetWatch() {
    if (sheetWatch.current != null) {
      window.clearInterval(sheetWatch.current);
      sheetWatch.current = null;
    }
    sheetChannel.current?.close();
    sheetChannel.current = null;
  }

  useEffect(() => stopSheetWatch, []);

  // No telemóvel e no iPad, voltar do Google restaura a página com o botão
  // ainda desativado. Sem isto, o toque deixa de chegar ao botão.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        navigating.current = false;
        setPending(null);
        releaseAuthBackground();
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  function failSignIn(sheet: Window | null, message: string) {
    navigating.current = false;
    setPending(null);
    releaseAuthBackground();
    sheet?.close();
    setError(message);
  }

  function watchOauthSheet(sheet: Window, fallbackNext: string) {
    stopSheetWatch();
    let settled = false;
    const channel = new BroadcastChannel(OAUTH_SHEET_CHANNEL);
    sheetChannel.current = channel;

    const succeed = (next: string) => {
      if (settled) return;
      settled = true;
      stopSheetWatch();
      window.location.assign(next);
    };

    channel.onmessage = (event) => {
      const payload = event.data as { next?: unknown } | null;
      const next = safeOauthNext(payload?.next) ?? fallbackNext;
      succeed(next);
    };

    let closing = false;
    sheetWatch.current = window.setInterval(() => {
      if (settled || closing || !sheet.closed) return;
      closing = true;
      window.setTimeout(async () => {
        if (settled) return;
        const { data } = await createClient().auth.getSession();
        if (data.session) {
          succeed(fallbackNext);
          return;
        }
        settled = true;
        stopSheetWatch();
        navigating.current = false;
        setPending(null);
        releaseAuthBackground();
      }, 400);
    }, 400);
  }

  async function signIn(provider: OAuthProvider) {
    setError(null);

    if (intent === "signup") {
      if (!getSignupDraft) {
        setError("Preenche o formulário antes de continuar.");
        return;
      }
      const draft = getSignupDraft();
      if (!draft) {
        setError("Preenche nome, idade e sexo antes de continuar com Google.");
        return;
      }
      writeSignupProfileDraft(draft);
      writeSignupWizardStep(signupNextStep);
      setSignupFinishingCookie();
      onBeforeRedirect?.();
    }

    // No telemóvel e no iPad a folha tem de abrir já no toque, antes do await.
    // Um URL externo faz o iOS mostrar a aba por cima da app, em vez de
    // substituir o ecrã. No desktop continua na mesma janela.
    const useSheet = prefersOauthSheet();
    const sheet = useSheet
      ? window.open("https://accounts.google.com/", OAUTH_SHEET_WINDOW)
      : null;

    navigating.current = true;
    setPending(provider);
    if (!sheet) freezeAuthBackground();

    const supabase = createClient();
    const redirectTo = `${getBrowserAppOrigin()}/auth/callback?intent=${intent}&next=${encodeURIComponent(nextPath)}${sheet ? "&sheet=1" : ""}`;

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        ...(provider === "google"
          ? { queryParams: { prompt: "select_account" } }
          : {}),
        ...(provider === "apple" ? { scopes: "name email" } : {}),
      },
    });

    if (oauthError || !data?.url) {
      failSignIn(sheet, "Não foi possível iniciar sessão. Tenta outra opção.");
      return;
    }

    if (sheet) {
      sheet.location.replace(data.url);
      watchOauthSheet(sheet, nextPath);
      return;
    }

    requestAnimationFrame(() => {
      window.location.assign(data.url);
    });
  }

  const buttons = (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={pending !== null}
        aria-label={
          pending === "google" ? "A abrir Google…" : "Continuar com Google"
        }
        onPointerDown={() => {
          if (!prefersOauthSheet()) freezeAuthBackground();
        }}
        onPointerCancel={() => {
          if (!navigating.current) releaseAuthBackground();
        }}
        onClick={() => signIn("google")}
        className={cn(
          OAUTH_BUTTON_CLASS,
          layout === "stack" && "h-12 w-full",
          pending === "google" && "opacity-70",
        )}
      >
        <GoogleIcon />
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled
        aria-disabled="true"
        aria-label="Apple — em breve"
        title="Em breve"
        className={cn(
          OAUTH_BUTTON_CLASS,
          "cursor-not-allowed opacity-40",
          layout === "stack" && "h-12 w-full",
        )}
      >
        <AppleIcon />
      </Button>
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-sm text-muted-foreground">{dividerLabel}</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      {layout === "row" ? (
        <div className="flex gap-2">{buttons}</div>
      ) : (
        <div className="space-y-3">{buttons}</div>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function buildSignupDraftFromFields(fields: {
  firstName: string;
  lastName: string;
  age: string;
  gender: string;
}): SignupProfileDraft | null {
  const firstName = fields.firstName.trim();
  const lastName = fields.lastName.trim();
  const age = parseAge(fields.age);
  const gender = parseGender(fields.gender);
  if (!firstName || !lastName || age == null || !gender) return null;
  return { firstName, lastName, age, gender };
}
