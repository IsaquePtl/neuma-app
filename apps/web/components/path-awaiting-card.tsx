/**
 * Empty state elegante enquanto o mentor ainda não criou o percurso.
 */
export function PathAwaitingCard() {
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

      <div className="relative space-y-4">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          O teu percurso
        </p>

        <div className="space-y-2">
          <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            Está a ser preparado para ti
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
            Quando o teu percurso for criado, vai aparecer aqui. Terás acesso
            aos níveis, práticas e sessões pensadas e desenhadas com base no
            teu onboarding. Até lá, fica à vontade para conheceres um pouco da
            aplicação.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--neuma-orange)]/60 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--neuma-orange)]" />
          </span>
          <span className="text-xs text-muted-foreground">
            Em desenvolvimento
          </span>
        </div>
      </div>
    </div>
  );
}
