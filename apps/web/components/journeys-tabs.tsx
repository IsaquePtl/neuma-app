"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Route, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/studio/journeys",
    label: "Percursos",
    icon: Route,
    match: (p: string) =>
      p === "/studio/journeys" ||
      (/^\/studio\/journeys\/[^/]+$/.test(p) &&
        !p.endsWith("/checkins") &&
        !p.endsWith("/onboardings")),
  },
  {
    href: "/studio/journeys/checkins",
    label: "Check-ins",
    icon: ClipboardList,
    match: (p: string) => p.startsWith("/studio/journeys/checkins"),
  },
  {
    href: "/studio/journeys/onboardings",
    label: "Onboardings",
    icon: Sparkles,
    match: (p: string) => p.startsWith("/studio/journeys/onboardings"),
  },
] as const;

export function JourneysTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-white/10 pb-px">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm transition-colors",
              active
                ? "border-b-2 border-[var(--neuma-coral)] font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
