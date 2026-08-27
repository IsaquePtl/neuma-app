import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Metrónomo minimalista (pirâmide um pouco mais larga + pêndulo limpo).
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
        {/* Corpo mais largo */}
        <path d="M5.5 20h13L15.2 5.5H8.8L5.5 20Z" />
        {/* Base */}
        <path d="M4.5 20h15" />
        {/* Pêndulo */}
        <path d="M12 6.5v9" />
        {/* Peso */}
        <circle cx="12" cy="16.75" r="1.35" fill={color} stroke="none" />
      </svg>
    );
  },
);

MetronomeIcon.displayName = "MetronomeIcon";
