import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Duas notas com ligadura — ícone de Recursos (linha fina e limpa).
 */
export const MusicStaffIcon = forwardRef<SVGSVGElement, LucideProps>(
  (
    {
      className,
      size = 24,
      strokeWidth = 1.75,
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
        {/* Cabeças (ligeiramente ovais, alinhadas) */}
        <ellipse cx="7" cy="18" rx="2.4" ry="1.85" fill={color} stroke="none" />
        <ellipse cx="15" cy="18" rx="2.4" ry="1.85" fill={color} stroke="none" />
        {/* Hastes verticais */}
        <path d="M9.4 18V6" />
        <path d="M17.4 18V6" />
        {/* Ligadura horizontal */}
        <path d="M9.4 6h8" strokeLinecap="butt" />
      </svg>
    );
  },
);

MusicStaffIcon.displayName = "MusicStaffIcon";
