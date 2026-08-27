import Image from "next/image";

import {
  CATEGORY_THEMES,
  inferCategoryTheme,
  type CategoryTheme,
} from "@/lib/brand-themes";
import { cn } from "@/lib/utils";

export function CategoryThemeIcon({
  theme,
  slug,
  name,
  size = 28,
  className,
}: {
  theme?: string | null;
  slug?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const key = inferCategoryTheme({ theme, slug, name });
  if (!key) return null;
  const spec = CATEGORY_THEMES[key];
  return (
    <Image
      src={spec.icon}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-lg", className)}
    />
  );
}

export function CategoryThemePicker({
  value,
  name = "theme",
}: {
  value?: CategoryTheme | null;
  name?: string;
}) {
  const options: (CategoryTheme | "")[] = ["", "piano", "acoustic", "electric"];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Tema visual</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((key) => {
          const selected = (value ?? "") === key;
          const spec = key ? CATEGORY_THEMES[key] : null;
          return (
            <label
              key={key || "none"}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-center text-[11px] leading-tight transition-colors",
                selected
                  ? "border-white/25 bg-white/[0.08] text-foreground"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={key}
                defaultChecked={selected}
                className="sr-only"
              />
              {spec ? (
                <Image
                  src={spec.icon}
                  alt=""
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
              ) : (
                <span className="grid size-10 place-items-center rounded-lg border border-dashed border-white/15 text-xs">
                  —
                </span>
              )}
              {spec ? spec.label : "Sem tema"}
            </label>
          );
        })}
      </div>
    </div>
  );
}
