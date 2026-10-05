"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { OnboardingForm } from "@/components/onboarding-form";
import { Button } from "@/components/ui/button";

const PATH_EMPTY_VIEWPORT =
  "neuma-mobile-viewport flex w-full flex-col items-center justify-center overflow-hidden overscroll-none pb-5 " +
  "desktop:min-h-0 desktop:flex-1 desktop:justify-center desktop:overflow-visible desktop:pb-4";

const PATH_FORM_VIEWPORT =
  "neuma-mobile-viewport flex w-full min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain pb-5 " +
  "desktop:min-h-0 desktop:flex-1 desktop:justify-center desktop:overflow-y-auto desktop:pb-4";

/**
 * Empty state em /path enquanto o aluno ainda não preencheu o onboarding.
 * "Fazer onboarding" abre o form no mesmo ecrã (?onboarding=1).
 */
export function PathOnboardingCard({
  studentId,
  initialName,
  initialEmail,
}: {
  studentId: string;
  initialName: string;
  initialEmail: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openForm = searchParams.get("onboarding") === "1";

  function openOnboarding() {
    router.replace("/path?onboarding=1", { scroll: false });
  }

  if (openForm) {
    return (
      <div className={PATH_FORM_VIEWPORT}>
        <OnboardingForm
          variant="inline"
          studentId={studentId}
          initialName={initialName}
          initialEmail={initialEmail}
          alreadySubmitted={false}
        />
      </div>
    );
  }

  return (
    <div className={PATH_EMPTY_VIEWPORT}>
      <div className="relative w-full shrink-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent p-6 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-[var(--neuma-orange)]/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-8 size-36 rounded-full bg-[var(--neuma-coral)]/10 blur-3xl"
        />

        <div className="relative space-y-5">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            O teu percurso
          </p>

          <div className="space-y-2">
            <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              Começa pelo onboarding
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
              Preenche o formulário para o mentor te conhecer e desenhar o teu
              percurso. Quando estiveres pronto, o mapa de níveis aparece aqui.
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={openOnboarding}
            className="h-12 w-full justify-between gap-3 rounded-2xl bg-[var(--neuma-orange)] px-5 text-base font-semibold text-white hover:bg-[var(--neuma-orange)]/90"
          >
            Fazer onboarding
            <ArrowRight className="size-4 opacity-90" />
          </Button>
        </div>
      </div>
    </div>
  );
}
