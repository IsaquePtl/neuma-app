"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Route, Sparkles } from "lucide-react";

import { NavCountBadge } from "@/components/nav-count-badge";
import { useMentorBadgeCounts } from "@/lib/mentor-badges-client";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/studio/journeys",
    label: "Percursos",
    icon: Route,
    badgeKey: null,
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
    badgeKey: "checkins" as const,
    match: (p: string) => p.startsWith("/studio/journeys/checkins"),
  },
  {
    href: "/studio/journeys/onboardings",
    label: "Onboardings",
    icon: Sparkles,
    badgeKey: "onboardings" as const,
    match: (p: string) => p.startsWith("/studio/journeys/onboardings"),
  },
] as const;

export function JourneysTabs() {
  const pathname = usePathname();
  const badges = useMentorBadgeCounts();

  return (
    <nav className="flex w-full flex-nowrap gap-0 border-b border-white/10 pb-px desktop:w-auto desktop:gap-0.5 sm:gap-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        const badge =
          tab.badgeKey === "checkins"
            ? badges.checkins
            : tab.badgeKey === "onboardings"
              ? badges.onboardings
              : 0;
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
            <span className="relative">
              <Icon className="size-4 sm:size-[1.125rem] desktop:size-3.5" />
              <NavCountBadge count={badge} active={active} />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
