"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

export type MobileNavItem = {
  label: string;
  href: string;
  match: (path: string) => boolean;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  profileAvatarUrl?: string | null;
  profileName?: string | null;
  profileEmail?: string | null;
  badge?: number;
};

type MobileMenubarProps = {
  items: MobileNavItem[];
  onNavigate: (href?: string) => void;
  compact: boolean;
  pending?: boolean;
  hidden?: boolean;
};

const PAD = 10;
const PILL_INSET = 4;

function indexFromPath(items: MobileNavItem[], pathname: string) {
  const i = items.findIndex((item) => item.match(pathname));
  return i >= 0 ? i : 0;
}

function isProfileItem(item: MobileNavItem) {
  return Boolean(
    item.profileAvatarUrl !== undefined ||
      item.profileName !== undefined ||
      item.profileEmail !== undefined,
  );
}

export function MobileMenubar({
  items,
  onNavigate,
  compact,
  pending = false,
  hidden = false,
}: MobileMenubarProps) {
  const pathname = usePathname();
  const count = Math.max(items.length, 1);
  const pathIndex = indexFromPath(items, pathname);
  const [activeIndex, setActiveIndex] = useState(pathIndex);

  useEffect(() => {
    setActiveIndex(pathIndex);
  }, [pathIndex]);

  return (
    <nav
      aria-label="Navegacao principal"
      aria-busy={pending || undefined}
      aria-hidden={hidden || undefined}
      className={cn(
        "mobile-menubar desktop:hidden",
        "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        hidden
          ? "pointer-events-none translate-y-[calc(100%+1.5rem)] scale-95 opacity-0"
          : compact
            ? "translate-y-0 scale-[0.86] opacity-100"
            : "translate-y-0 scale-100 opacity-100",
      )}
    >
      <div className="glass-nav relative flex w-full items-center rounded-full p-2.5">
        <span
          aria-hidden
          className="pointer-events-none absolute top-2.5 bottom-2.5 rounded-full bg-white/[0.12] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            left: PAD + PILL_INSET / 2,
            width: `calc((100% - ${PAD * 2}px) / ${count} - ${PILL_INSET}px)`,
            transform: `translate3d(calc(${activeIndex} * (100% + ${PILL_INSET}px)), 0, 0)`,
          }}
        />

        {items.map((item, i) => {
          const active = i === activeIndex;
          const Icon = item.icon;
          const profile = isProfileItem(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setActiveIndex(i);
                onNavigate(item.href);
              }}
              className={cn(
                "relative z-10 grid h-[3.75rem] min-w-0 flex-1 place-items-center rounded-full transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {profile ? (
                <UserAvatar
                  name={item.profileName}
                  email={item.profileEmail}
                  avatarUrl={item.profileAvatarUrl}
                  size="sm"
                  className={cn(active && "ring-2 ring-white/25")}
                />
              ) : Icon ? (
                <span className="relative">
                  <Icon className="size-[1.625rem]" />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full bg-[var(--neuma-coral)] px-1 text-[10px] font-semibold text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
