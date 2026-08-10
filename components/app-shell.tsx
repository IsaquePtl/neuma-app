"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Music,
  House,
  Headphones,
  Settings,
  LogOut,
  Route,
  Library,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

import { logout } from "@/lib/actions/auth";
import { NeumaLogo } from "@/components/neuma-logo";
import { MobileMenubar, type MobileNavItem } from "@/components/mobile-menubar";
import {
  MentorMobileDrawer,
  type MentorDrawerItem,
} from "@/components/mentor-mobile-drawer";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  subtitle?: string;
};

/** Desktop sidebar — inclui Calendário. */
const mentorNavDesktop: NavItem[] = [
  {
    label: "Geral",
    href: "/studio",
    icon: House,
    match: (p) => p === "/studio",
    subtitle: "Menu e Dashboard",
  },
  {
    label: "Alunos",
    href: "/studio/students",
    icon: Users,
    match: (p) => p.startsWith("/studio/students"),
    subtitle: "Fichas e perfil",
  },
  {
    label: "Percursos",
    href: "/studio/journeys",
    icon: Route,
    match: (p) =>
      p.startsWith("/studio/journeys") ||
      p.startsWith("/studio/inbox") ||
      p.startsWith("/studio/checkins") ||
      p.startsWith("/studio/intake"),
    subtitle: "Check-ins e feedback",
  },
  {
    label: "Biblioteca",
    href: "/studio/paths",
    icon: Library,
    match: (p) => p.startsWith("/studio/paths"),
    subtitle: "Templates e conteúdos",
  },
  {
    label: "Calendário",
    href: "/studio/calendar",
    icon: CalendarDays,
    match: (p) => p.startsWith("/studio/calendar"),
    subtitle: "Sessões e prazos",
  },
];

const mentorExtraNav: NavItem[] = [
  {
    label: "Ferramentas",
    href: "/studio/tools",
    icon: Music,
    match: (p) => p.startsWith("/studio/tools"),
    subtitle: "Metrónomo e campo harmónico",
  },
];

/** Mobile bottom bar — 4 + Perfil = 5; Calendário e extras no drawer. */
const mentorNavMobile: NavItem[] = mentorNavDesktop.filter(
  (item) => item.href !== "/studio/calendar",
);

const studentNav: NavItem[] = [
  {
    label: "Geral",
    href: "/home",
    icon: House,
    match: (p) => p === "/home",
    subtitle: "O teu panorama",
  },
  {
    label: "Percurso",
    href: "/path",
    icon: Route,
    match: (p) => p.startsWith("/path"),
    subtitle: "Níveis e progresso",
  },
  {
    label: "1:1",
    href: "/session",
    icon: Headphones,
    match: (p) => p.startsWith("/session") || p.startsWith("/checkins"),
    subtitle: "Sessões e check-ins",
  },
  {
    label: "Ferramentas",
    href: "/tools",
    icon: Music,
    match: (p) => p.startsWith("/tools"),
    subtitle: "Metrónomo e campo harmónico",
  },
];

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export function AppShell({
  role,
  name,
  email,
  avatarUrl,
  children,
  badgeCounts,
}: {
  role: "mentor" | "student";
  name: string | null | undefined;
  email: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
  badgeCounts?: { checkins?: number };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navPending, startNavTransition] = useTransition();
  const nav = role === "mentor" ? mentorNavDesktop : studentNav;
  const mobileNav = role === "mentor" ? mentorNavMobile : studentNav;
  const settingsHref = role === "mentor" ? "/studio/settings" : "/settings";
  const settingsActive = pathname === settingsHref;
  const home = role === "mentor" ? "/studio" : "/home";
  const [navCompact, setNavCompact] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mobileItems = useMemo<MobileNavItem[]>(() => {
    const items: MobileNavItem[] = mobileNav.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      match: item.match,
      badge:
        (item.href === "/session" || item.href === "/studio/journeys") &&
        badgeCounts?.checkins
          ? badgeCounts.checkins
          : undefined,
    }));
    items.push({
      label: "Perfil",
      href: settingsHref,
      match: (p) => p === settingsHref,
      profileAvatarUrl: avatarUrl,
      profileName: name,
      profileEmail: email,
    });
    return items;
  }, [mobileNav, settingsHref, name, email, avatarUrl, badgeCounts]);

  const mentorDrawerItems = useMemo<MentorDrawerItem[]>(() => {
    if (role !== "mentor") return [];
    const core: MentorDrawerItem[] = [
      ...mentorNavDesktop,
      ...mentorExtraNav,
    ].map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      match: item.match,
      subtitle: item.subtitle,
      badge:
        item.href === "/studio/journeys" && badgeCounts?.checkins
          ? badgeCounts.checkins
          : undefined,
    }));
    core.push({
      label: "Perfil",
      href: settingsHref,
      icon: Settings,
      match: (p) => p === settingsHref,
      subtitle: name ?? email,
      profileAvatarUrl: avatarUrl,
      profileName: name,
      profileEmail: email,
    });
    return core;
  }, [role, settingsHref, name, email, avatarUrl, badgeCounts]);

  const studentDrawerItems = useMemo<MentorDrawerItem[]>(() => {
    if (role !== "student") return [];
    const core: MentorDrawerItem[] = studentNav.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      match: item.match,
      subtitle: item.subtitle,
      badge:
        item.href === "/session" && badgeCounts?.checkins
          ? badgeCounts.checkins
          : undefined,
    }));
    core.push({
      label: "Perfil",
      href: settingsHref,
      icon: Settings,
      match: (p) => p === settingsHref,
      subtitle: name ?? email,
      profileAvatarUrl: avatarUrl,
      profileName: name,
      profileEmail: email,
    });
    return core;
  }, [role, settingsHref, name, email, avatarUrl, badgeCounts]);

  const drawerItems =
    role === "mentor" ? mentorDrawerItems : studentDrawerItems;

  useEffect(() => {
    for (const item of mobileItems) router.prefetch(item.href);
    for (const item of nav) router.prefetch(item.href);
    router.prefetch(settingsHref);
    if (role === "mentor") {
      router.prefetch("/studio/calendar");
      router.prefetch("/studio/tools");
    }
    if (role === "student") {
      router.prefetch("/path");
    }
  }, [mobileItems, nav, router, settingsHref, role]);

  useEffect(() => {
    scrollToTop();
    setNavCompact(false);
  }, [pathname]);

  useEffect(() => {
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;

      // Só compacta a menubar; o logo no topo fica estável para evitar overlap.
      if (y < 24) {
        setNavCompact(false);
      } else if (delta > 12) {
        setNavCompact(true);
      } else if (delta < -12) {
        setNavCompact(false);
      }
      lastY = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onNavClick(href?: string) {
    scrollToTop();
    setNavCompact(false);
    if (href && href !== pathname) {
      startNavTransition(() => {
        router.push(href);
      });
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col desktop:flex-row">
      <aside className="fixed left-0 top-0 z-30 hidden h-dvh w-64 p-3 desktop:block">
        <div className="glass-panel flex h-full w-full flex-col rounded-3xl p-4">
          <Link
            href={home}
            className="px-2 py-3"
            prefetch
            onClick={(e) => {
              e.preventDefault();
              onNavClick(home);
            }}
          >
            <NeumaLogo withWordmark={false} />
          </Link>
          <div className="neuma-hairline mx-2 mt-1 rounded-full opacity-70" />

          <nav className="mt-4 flex-1 space-y-1">
            {nav.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              const badge =
                (item.href === "/session" || item.href === "/studio/journeys") &&
                badgeCounts?.checkins
                  ? badgeCounts.checkins
                  : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={(e) => {
                    e.preventDefault();
                    onNavClick(item.href);
                  }}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    active
                      ? "neuma-gradient text-white shadow-md"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon className="size-[18px]" />
                    {badge > 0 ? (
                      <span
                        className={cn(
                          "absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full px-1 text-[9px] font-semibold text-white",
                          active ? "bg-white/25" : "bg-[var(--neuma-coral)]",
                        )}
                      >
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{item.label}</span>
                    {item.subtitle ? (
                      <span
                        className={cn(
                          "block truncate text-[11px]",
                          active ? "text-white/70" : "text-muted-foreground/80",
                        )}
                      >
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </nav>

          <Link
            href={settingsHref}
            prefetch
            onClick={(e) => {
              e.preventDefault();
              onNavClick(settingsHref);
            }}
            className={cn(
              "mt-2 flex items-center gap-3 rounded-2xl p-2 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              settingsActive
                ? "neuma-gradient text-white shadow-md"
                : "hover:bg-white/5",
            )}
          >
            <UserAvatar
              name={name}
              email={email}
              avatarUrl={avatarUrl}
              size="md"
              className={cn(settingsActive && "ring-2 ring-white/30")}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name ?? email}</p>
              <p
                className={cn(
                  "truncate text-xs",
                  settingsActive
                    ? "text-white/75"
                    : "text-muted-foreground",
                )}
              >
                Perfil
              </p>
            </div>
            <Settings
              className={cn(
                "size-4",
                settingsActive ? "text-white/80" : "text-muted-foreground",
              )}
            />
          </Link>
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start gap-2 text-muted-foreground"
            >
              <LogOut className="size-4" /> Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col desktop:pl-64">
        <header
          className={cn(
            "fixed inset-x-0 top-0 z-20 flex items-center justify-center bg-transparent desktop:hidden",
            "h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)]",
          )}
        >
          <MentorMobileDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            items={drawerItems}
            onNavigate={onNavClick}
            pending={navPending}
          />
          <Link
            href={home}
            aria-label="Neuma"
            prefetch
            onClick={(e) => {
              e.preventDefault();
              onNavClick(home);
            }}
          >
            <NeumaLogo size={28} withWordmark={false} />
          </Link>
        </header>
        <div
          className="h-[calc(3.5rem+env(safe-area-inset-top,0px))] shrink-0 desktop:hidden"
          aria-hidden
        />

        <main
          className={cn(
            "mx-auto w-full flex-1 px-4 pt-4 pb-[calc(5.75rem+14px)] transition-opacity duration-150 desktop:px-10 desktop:pb-14 desktop:pt-10",
            role === "mentor" ? "max-w-7xl" : "max-w-5xl",
            navPending && "opacity-70",
          )}
        >
          {children}
        </main>
      </div>

      <MobileMenubar
        items={mobileItems}
        onNavigate={onNavClick}
        compact={navCompact}
        pending={navPending}
        hidden={drawerOpen}
      />
    </div>
  );
}
