"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import {
  TallyEmbed,
  type TallyFormSubmittedPayload,
} from "@/components/tally-embed";
import { confirmOnboardingSubmission } from "@/lib/actions/onboarding";
import { cn } from "@/lib/utils";

const ONBOARDING_FORM_ID =
  process.env.NEXT_PUBLIC_TALLY_ONBOARDING_FORM_ID || "44RJrA";

const SIGNUP_HREF = "/login/signup";

const FADE_MS = 700;
/** Keep Tally’s final screen visible before fade-out (logged-in path only). */
const POST_SUBMIT_HOLD_MS = 2000;

type Phase = "form" | "fadingOut" | "thankYou";

/**
 * Mesmo posicionamento que Soundworks (pt / logo / frame).
 * `studentId` is injected by the server from the session only (not from URL).
 * Com login: hidden student_id + source=neuma; thank-you after submit.
 * Sem login: no student_id + source=public; redirect to signup after submit.
 */
export function OnboardingNeumaEmbed({
  studentId,
  alreadySubmitted = false,
  backHref = "/home",
  backLabel = "Ir para a app",
}: {
  studentId?: string | null;
  alreadySubmitted?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const isLoggedIn = Boolean(studentId);
  const [ready, setReady] = useState(alreadySubmitted || isLoggedIn);
  const [phase, setPhase] = useState<Phase>(
    alreadySubmitted ? "thankYou" : "form",
  );
  const [thanksVisible, setThanksVisible] = useState(alreadySubmitted);

  const [holdAfterSubmit, setHoldAfterSubmit] = useState(false);

  useEffect(() => {
    if (ready || isLoggedIn) return;
    const t = window.setTimeout(() => setReady(true), 4000);
    return () => window.clearTimeout(t);
  }, [ready, isLoggedIn]);

  useEffect(() => {
    const ui = document.querySelector<HTMLElement>("[data-neuma-ui]");
    const prev = ui?.style.overflow ?? "";
    if (ui) {
      ui.style.overflow = "hidden";
      ui.scrollTop = 0;
    }
    return () => {
      if (ui) ui.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!holdAfterSubmit) return;
    const t = window.setTimeout(() => {
      setHoldAfterSubmit(false);
      setPhase("fadingOut");
    }, POST_SUBMIT_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [holdAfterSubmit]);

  useEffect(() => {
    if (phase !== "fadingOut") return;
    const t = window.setTimeout(() => {
      setPhase("thankYou");
      router.refresh();
    }, FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase, router]);

  useEffect(() => {
    if (phase !== "thankYou" || thanksVisible) return;
    const t = window.requestAnimationFrame(() => setThanksVisible(true));
    return () => window.cancelAnimationFrame(t);
  }, [phase, thanksVisible]);

  const handleFormSubmitted = useCallback(
    (payload: TallyFormSubmittedPayload) => {
      if (isLoggedIn) {
        setHoldAfterSubmit(true);
        // Persist from embed answers (works without Tally webhook / localhost).
        void confirmOnboardingSubmission(payload).then(() => {
          router.refresh();
        });
        return;
      }
      router.replace(SIGNUP_HREF);
    },
    [isLoggedIn, router],
  );

  const showThanks = phase === "thankYou";
  const formVisible = phase === "form" || phase === "fadingOut";

  return (
    <div className="soundworks-stage absolute inset-0 z-10 flex touch-manipulation flex-col overflow-hidden overscroll-none">
      {formVisible ? (
        <>
          <Link
            href={isLoggedIn ? backHref : SIGNUP_HREF}
            className={cn(
              "absolute right-4 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-20 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
              isLoggedIn
                ? "opacity-100"
                : cn(
                    "transition-opacity duration-700 ease-out",
                    ready && phase === "form" ? "opacity-100" : "opacity-0",
                  ),
            )}
          >
            {isLoggedIn ? backLabel : "Criar conta"}
          </Link>

          <div
            className={cn(
              "mx-auto flex h-full w-full max-w-md min-h-0 flex-col px-4",
              "pt-[18lvh] pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
              "desktop:pt-[24%]",
              isLoggedIn
                ? "opacity-100"
                : cn(
                    "transition-opacity duration-700 ease-out",
                    ready && phase === "form" ? "opacity-100" : "opacity-0",
                  ),
            )}
          >
            <Image
              src="/brand/mark-white.png"
              alt="Neuma"
              width={80}
              height={80}
              priority
              className="mb-4 h-16 w-16 shrink-0 self-start desktop:mb-5 desktop:h-20 desktop:w-20"
            />

            <div className="soundworks-embed-frame min-h-0 w-full flex-1 overflow-hidden">
              <TallyEmbed
                formId={ONBOARDING_FORM_ID}
                title="Onboarding Neuma 1:1"
                height="100%"
                className="h-full min-h-0"
                params={{
                  hideTitle: "0",
                  dynamicHeight: "0",
                  student_id: studentId ?? undefined,
                  source: studentId ? "neuma" : "public",
                }}
                onReady={() => setReady(true)}
                onSubmit={handleFormSubmitted}
              />
            </div>
          </div>
        </>
      ) : null}

      {showThanks ? (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 text-center",
            "transition-opacity duration-700 ease-out",
            thanksVisible ? "opacity-100" : "opacity-0",
          )}
        >
          <CheckCircle2 className="size-12 text-foreground" />
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {alreadySubmitted
                ? "Já preencheste o onboarding"
                : "Onboarding enviado"}
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Tudo recebido. Vou analisar o teu perfil para estruturar como
              vamos aplicar este 1:1 à tua realidade. Assim que o plano estiver
              desenhado, avanço com o teu percurso. Até lá, sente-te à vontade
              para explorar o resto da Neuma.
            </p>
          </div>
          <Link
            href={backHref}
            className="mt-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white/15"
          >
            Voltar ao Geral
          </Link>
        </div>
      ) : null}
    </div>
  );
}
