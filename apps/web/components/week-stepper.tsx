"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/** − N unidade + ; the value never leaves [min, max]. */
export function WeekStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = "md",
  unit = (n) => (n === 1 ? "semana" : "semanas"),
  label,
  maxReachedHint,
  name,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  size?: "sm" | "md" | "lg" | "compact";
  unit?: (n: number) => string;
  /** Accessible name, e.g. "Semanas do nível 3". */
  label: string;
  /** Tooltip on + when it is blocked by `max`. */
  maxReachedHint?: string;
  /** Mirrors the value into a hidden input for plain form posts. */
  name?: string;
  className?: string;
}) {
  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;
  const button = cn(
    "grid shrink-0 place-items-center text-foreground transition-colors",
    "hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--neuma-blue)_55%,white)]",
    size === "compact"
      ? "size-8 rounded-lg"
      : size === "lg"
        ? "size-11 rounded-xl"
        : "rounded-full",
    size === "sm" ? "size-7" : size === "md" ? "size-9" : null,
  );

  return (
    <div
      role="group"
      aria-label={label}
      data-no-drag
      className={cn(
        "inline-flex items-center",
        size === "compact"
          ? "gap-px rounded-lg border border-white/10 bg-white/5 p-px"
          : size === "lg"
            ? "gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
            : "gap-0.5 rounded-full border border-white/12 bg-black/25 p-0.5",
        disabled && "opacity-60",
        className,
      )}
    >
      <button
        type="button"
        className={button}
        disabled={!canDec}
        aria-label={`Menos 1 ${unit(1)}`}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className={size === "compact" || size === "sm" ? "size-3.5" : "size-4"} />
      </button>
      <span
        aria-live="polite"
        className={cn(
          "min-w-[5.5rem] px-1 text-center font-medium tabular-nums",
          size === "compact"
            ? "min-w-[4.25rem] text-xs"
            : size === "lg"
              ? "min-w-[6.5rem] text-sm"
              : size === "sm"
                ? "text-xs"
                : "text-sm",
        )}
      >
        {value} {unit(value)}
      </span>
      <button
        type="button"
        className={button}
        disabled={!canInc}
        aria-label={`Mais 1 ${unit(1)}`}
        title={!canInc && !disabled && maxReachedHint ? maxReachedHint : undefined}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className={size === "compact" || size === "sm" ? "size-3.5" : "size-4"} />
      </button>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
