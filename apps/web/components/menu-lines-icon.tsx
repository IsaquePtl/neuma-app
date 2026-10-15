import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

/** Menu de duas linhas — o ícone de três riscas sem a do meio. */
export const MenuLinesIcon = forwardRef<SVGSVGElement, LucideProps>(
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
        <line x1="4" x2="20" y1="8" y2="8" />
        <line x1="4" x2="20" y1="16" y2="16" />
      </svg>
    );
  },
);

MenuLinesIcon.displayName = "MenuLinesIcon";
