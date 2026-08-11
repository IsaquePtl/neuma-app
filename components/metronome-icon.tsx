import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Metrónomo minimalista (pirâmide + pêndulo limpo).
 * Substitui o Metronome do Lucide, cujo ponteiro fica estranho em tamanho pequeno.
 */
export const MetronomeIcon = forwardRef<SVGSVGElement, LucideProps>(
  (
    {
      className,
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      color = "currentColor",
      ...props
    },
    ref,
  ) => {
    const computedStroke =
      absoluteStrokeWidth && typeof size === "number"
        ? (Number(strokeWidth) * 24) / size
        : strokeWidth;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={computedStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        {/* Corpo */}
        <path d="M8 20h8l-2.2-14H10.2L8 20Z" />
        {/* Base */}
        <path d="M6.5 20h11" />
        {/* Pêndulo simples */}
        <path d="M12 6.5v9.5" />
        {/* Peso */}
        <circle cx="12" cy="17" r="1.25" fill={color} stroke="none" />
      </svg>
    );
  },
);

MetronomeIcon.displayName = "MetronomeIcon";
