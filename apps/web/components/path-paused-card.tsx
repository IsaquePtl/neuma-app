import { cn } from "@/lib/utils";

type PathPausedCardProps = {
  /** Versão mais compacta (ex.: pré-visualização na Geral). */
  compact?: boolean;
};

/**
 * Estado quando o mentor pausou o percurso do aluno.
 */
export function PathPausedCard({ compact = false }: PathPausedCardProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent",
        compact
          ? "rounded-2xl p-5 sm:p-6"
          : "rounded-[1.75rem] p-6 sm:p-7",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute rounded-full bg-amber-500/10 blur-3xl",
          compact ? "-right-8 -top-10 size-28" : "-right-10 -top-12 size-40",
        )}
      />

      <div className={cn("relative", compact ? "space-y-2.5" : "space-y-4")}>
        {!compact ? (
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            O teu percurso
          </p>
        ) : null}

        <div className="space-y-1.5">
          <h2
            className={cn(
              "font-heading font-semibold tracking-tight",
              compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
            )}
          >
            O teu percurso está em pausa
          </h2>
          <p
            className={cn(
              "text-muted-foreground",
              compact
                ? "text-sm leading-relaxed"
                : "max-w-md text-sm leading-relaxed sm:text-[0.95rem]",
            )}
          >
            O teu mentor reactivará quando estiver pronto.
          </p>
        </div>
      </div>
    </div>
  );
}
