"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/studio/finance",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (p: string) => p === "/studio/finance",
  },
  {
    href: "/studio/finance/subscriptions",
    label: "Subscrições",
    icon: Users,
    match: (p: string) => p.startsWith("/studio/finance/subscriptions"),
  },
  {
    href: "/studio/finance/one-to-one",
    label: "Neuma 1:1",
    icon: UserRound,
    match: (p: string) => p.startsWith("/studio/finance/one-to-one"),
  },
] as const;

export function FinanceTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex w-full flex-nowrap gap-0 border-b border-white/10 pb-px desktop:w-auto desktop:gap-0.5 sm:gap-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-t-lg px-2 py-3 text-sm transition-colors sm:gap-2 sm:px-3 sm:py-3.5",
              "desktop:min-w-0 desktop:flex-none desktop:shrink-0 desktop:justify-start desktop:gap-1.5 desktop:px-3 desktop:py-2 desktop:text-sm",
              active
                ? "border-b-2 border-[var(--neuma-coral)] font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 sm:size-[1.125rem] desktop:size-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
