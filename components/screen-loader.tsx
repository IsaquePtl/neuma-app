import { cn } from "@/lib/utils";

/** Spinner circular suave — loading de página / transição. */
export function ScreenLoader({
  className,
  label = "A carregar",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex w-full flex-1 items-center justify-center",
        "min-h-[min(24rem,calc(100dvh-12rem))]",
        className,
      )}
    >
      <span
        className="size-9 animate-spin rounded-full border-2 border-white/15 border-t-white/85"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
