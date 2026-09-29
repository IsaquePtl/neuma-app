import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Empty state em /path enquanto o aluno ainda não preencheu o onboarding.
 */
export function PathOnboardingCard() {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent p-6 sm:p-7">
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
          render={<Link href="/onboarding" />}
          nativeButton={false}
          size="lg"
          className="h-12 w-full justify-between gap-3 rounded-2xl bg-[var(--neuma-orange)] px-5 text-base font-semibold text-white hover:bg-[var(--neuma-orange)]/90"
        >
          Fazer onboarding
          <ArrowRight className="size-4 opacity-90" />
        </Button>
      </div>
    </div>
  );
}
