"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type MobileNavItem = {
  label: string;
  href: string;
  match: (path: string) => boolean;
  icon?: LucideIcon;
  profileInitials?: string;
};

type MobileMenubarProps = {
  items: MobileNavItem[];
  onNavigate: () => void;
  compact: boolean;
};

/** Padding interno do track (p-2 = 8px). */
const PAD = 8;
/** Folga simétrica do pill dentro de cada slot. */
const PILL_INSET = 4;

function indexFromPath(items: MobileNavItem[], pathname: string) {
  const i = items.findIndex((item) => item.match(pathname));
  return i >= 0 ? i : 0;
}

export function MobileMenubar({
  items,
  onNavigate,
  compact,
}: MobileMenubarProps) {
  const pathname = usePathname();
  const count = Math.max(items.length, 1);
  const pathIndex = indexFromPath(items, pathname);
  // Índice visual otimista: atualiza no clique, não espera a navegação RSC.
  const [activeIndex, setActiveIndex] = useState(pathIndex);

  useEffect(() => {
    setActiveIndex(pathIndex);
  }, [pathIndex]);

  return (
    <nav
      aria-label="Navegacao principal"
      className={cn(
        "mobile-menubar fixed z-40 lg:hidden",
        "origin-bottom transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
        compact ? "scale-[0.86]" : "scale-100",
      )}
    >
      <div className="glass-nav relative flex w-full items-center rounded-full p-2">
        <span
          aria-hidden
          className="pointer-events-none absolute top-2 bottom-2 rounded-full neuma-gradient shadow-lg transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            // Inset simétrico: metade à esquerda, metade à direita do slot
            left: PAD + PILL_INSET / 2,
            width: `calc((100% - ${PAD * 2}px) / ${count} - ${PILL_INSET}px)`,
            transform: `translate3d(calc(${activeIndex} * (100% + ${PILL_INSET}px)), 0, 0)`,
          }}
        />

        {items.map((item, i) => {
          const active = i === activeIndex;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                setActiveIndex(i);
                onNavigate();
              }}
              className={cn(
                "relative z-10 grid h-14 min-w-0 flex-1 place-items-center rounded-full transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                active ? "text-white" : "text-muted-foreground",
              )}
            >
              {item.profileInitials ? (
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-xs font-semibold",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-gradient-to-br from-[var(--neuma-coral)] to-[var(--neuma-blue)] text-white",
                  )}
                >
                  {item.profileInitials}
                </span>
              ) : Icon ? (
                <Icon className="size-6" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
