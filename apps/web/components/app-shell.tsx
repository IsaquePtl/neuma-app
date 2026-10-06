"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { requestJourneyEditLeave } from "@/lib/journey-path/edit-guard-store";
import {
  journeyPathBackHref,
  safeStudioReturnTo,
} from "@/lib/journey-path/routes";
import {
  Users,
  House,
  ClipboardList,
  Settings,
  LogOut,
  Route,
  Library,
  CalendarDays,
  ChevronLeft,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { LogoutForm } from "@/components/logout-form";
import { MusicStaffIcon } from "@/components/music-staff-icon";
import { NeumaLogo } from "@/components/neuma-logo";
import { MobileMenubar, type MobileNavItem } from "@/components/mobile-menubar";
import {
  MentorMobileDrawer,
  type MentorDrawerItem,
} from "@/components/mentor-mobile-drawer";
import { NavCountBadge } from "@/components/nav-count-badge";
import { ScreenLoader } from "@/components/screen-loader";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { MENTOR_BADGES_REFRESH_EVENT } from "@/lib/mentor-badges-client";
import { STUDENT_BADGES_REFRESH_EVENT } from "@/lib/student-badges-client";
import { cn } from "@/lib/utils";

type NavIcon = LucideIcon | typeof MusicStaffIcon;

type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  match: (path: string) => boolean;
};

/** Desktop sidebar — inclui Calendário. */
const mentorNavDesktop: NavItem[] = [
  {
    label: "Geral",
    href: "/studio",
    icon: House,
    match: (p) => p === "/studio",
  },
  {
    label: "Alunos",
    href: "/studio/students",
    icon: Users,
    match: (p) => p.startsWith("/studio/students"),
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
  },
  {
    label: "Biblioteca",
    href: "/studio/library",
    icon: Library,
    match: (p) =>
      p.startsWith("/studio/library") || p.startsWith("/studio/paths"),
  },
  {
    label: "Calendário",
    href: "/studio/calendar",
    icon: CalendarDays,
    match: (p) => p.startsWith("/studio/calendar"),
  },
];

const mentorExtraNav: NavItem[] = [
  {
    label: "Finanças",
    href: "/studio/finance",
    icon: Wallet,
    match: (p) => p.startsWith("/studio/finance"),
  },
  {
    label: "Recursos",
    href: "/studio/tools",
    icon: MusicStaffIcon,
    match: (p) => p.startsWith("/studio/tools"),
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
  },
  {
    label: "Percurso",
    href: "/path",
    icon: Route,
    match: (p) => p.startsWith("/path"),
  },
  {
    label: "Mentor",
    href: "/session",
    icon: ClipboardList,
    match: (p) => p.startsWith("/session") || p.startsWith("/checkins"),
  },
  {
    label: "Recursos",
    href: "/tools",
    icon: MusicStaffIcon,
    match: (p) => p.startsWith("/tools"),
  },
];

/** Tabs principais — mantêm logo + menu. Tudo o resto é «página interna». */
const STUDENT_ROOT_PATHS = new Set([
  "/home",
  "/path",
  "/session",
  "/tools",
  "/settings",
]);

const MENTOR_ROOT_PATHS = new Set([
  "/studio",
  "/studio/students",
  "/studio/journeys",
  "/studio/journeys/checkins",
  "/studio/journeys/onboardings",
  "/studio/library",
  "/studio/calendar",
  "/studio/agent",
  "/studio/tools",
  "/studio/finance",
  "/studio/finance/subscriptions",
  "/studio/finance/one-to-one",
  "/studio/settings",
]);

function isShellRootPage(
  pathname: string,
  role: "mentor" | "student",
  searchParams?: URLSearchParams | { get: (key: string) => string | null },
) {
  if (role === "student") {
    // Onboarding embutido — mesmo layout de página interna (ex. /session/review).
    if (
      (pathname === "/home" || pathname === "/path") &&
      searchParams?.get("onboarding") === "1"
    ) {
      return false;
    }
    return STUDENT_ROOT_PATHS.has(pathname);
  }
  return MENTOR_ROOT_PATHS.has(pathname);
}

function shellBackHref(
  pathname: string,
  role: "mentor" | "student",
  searchParams?: URLSearchParams | { get: (key: string) => string | null },
) {
  if (role === "student") {
    if (pathname === "/home" && searchParams?.get("onboarding") === "1") {
      return "/home";
    }
    if (pathname === "/path" && searchParams?.get("onboarding") === "1") {
      return "/path";
    }
    const quizMatch = pathname.match(/^\/path\/([^/]+)\/quiz\/?$/);
    if (quizMatch) return `/path/${quizMatch[1]}`;
    if (pathname.startsWith("/path/")) return "/path";
    if (pathname.startsWith("/session/")) return "/session";
    if (pathname === "/checkins" || pathname.startsWith("/checkins/new")) {
      const nodeId = searchParams?.get("node")?.trim();
      if (nodeId && pathname.startsWith("/checkins/new")) {
        return `/path/${nodeId}`;
      }
      return "/session";
    }
    if (pathname.startsWith("/checkins/")) return "/checkins";
    if (pathname === "/settings") return "/home";
    if (pathname.startsWith("/settings/")) return "/settings";
    return "/home";
  }

  if (pathname.startsWith("/studio/students/")) {
    const returnTo = safeStudioReturnTo(searchParams?.get("returnTo"));
    if (returnTo) return returnTo;
    return "/studio/students";
  }
  const journeyBack = journeyPathBackHref(pathname);
  if (journeyBack) return journeyBack;
  if (
    pathname.startsWith("/studio/library/") ||
    pathname.startsWith("/studio/paths/")
  ) {
    return "/studio/library";
  }
  if (pathname.startsWith("/studio/checkins")) {
    const from = searchParams?.get("from");
    const student = searchParams?.get("student");
    const path = searchParams?.get("path");
    if (from === "student" && student) return `/studio/students/${student}`;
    if (from === "journey" && path) return `/studio/journeys/${path}`;
    if (from === "dashboard") return "/studio";
    return "/studio/journeys/checkins";
  }
  if (pathname.startsWith("/studio/intake")) {
    return "/studio/journeys/onboardings";
  }
  if (pathname.startsWith("/studio/inbox")) return "/studio/journeys";
  if (pathname === "/studio/settings") return "/studio";
  return "/studio";
}

function getAppScrollEl(): HTMLElement | null {
  const tablet = document.querySelector<HTMLElement>(".neuma-tablet-scroll");
  if (tablet) {
    const overflowY = window.getComputedStyle(tablet).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return tablet;
  }
  return document.querySelector("[data-neuma-ui]");
}

function scrollToTop() {
  const shell = getAppScrollEl();
  if (shell) {
    shell.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export function AppShell({
  role,
  name,
  email,
  avatarUrl,
  children,
  badgeCounts,
  hydrateBadges = false,
}: {
  role: "mentor" | "student";
  name: string | null | undefined;
  email: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
  badgeCounts?: { checkins?: number; proposals?: number };
  /** Mentor: carrega badges depois do paint (não bloqueia o login). */
  hydrateBadges?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [navPending, startNavTransition] = useTransition();
  const nav =
    role === "mentor"
      ? [...mentorNavDesktop, ...mentorExtraNav]
      : studentNav;
  /** Menubar: sem Recursos (fica só na sidebar). */
  const mobileNav =
    role === "mentor"
      ? mentorNavMobile
      : studentNav.filter((item) => item.href !== "/tools");
  const settingsHref = role === "mentor" ? "/studio/settings" : "/settings";
  const settingsActive =
    pathname === settingsHref || pathname.startsWith(`${settingsHref}/`);
  const home = role === "mentor" ? "/studio" : "/home";
  const [navCompact, setNavCompact] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Destino optimista — o header muda já no clique (voltar → logo/menu). */
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [badges, setBadges] = useState({
    checkins: badgeCounts?.checkins ?? 0,
    onboardings: 0,
    proposals: badgeCounts?.proposals ?? 0,
  });

  useEffect(() => {
    setBadges((prev) => ({
      ...prev,
      checkins: badgeCounts?.checkins ?? 0,
      proposals: badgeCounts?.proposals ?? 0,
    }));
  }, [badgeCounts?.checkins, badgeCounts?.proposals]);

  useEffect(() => {
    if (!hydrateBadges || role !== "mentor") return;
    let cancelled = false;

    function refreshBadges() {
      void import("@/lib/actions/mentor-badges").then(
        ({ fetchMentorBadgeCounts }) =>
          fetchMentorBadgeCounts().then((next) => {
            if (!cancelled) setBadges(next);
          }),
      );
    }

    refreshBadges();
    window.addEventListener(MENTOR_BADGES_REFRESH_EVENT, refreshBadges);
    return () => {
      cancelled = true;
      window.removeEventListener(MENTOR_BADGES_REFRESH_EVENT, refreshBadges);
    };
  }, [hydrateBadges, role]);

  useEffect(() => {
    if (role !== "student") return;
    let cancelled = false;

    function refreshStudentBadge() {
      void import("@/lib/actions/student-badges").then(({ fetchStudentNavBadge }) =>
        fetchStudentNavBadge().then((count) => {
          if (!cancelled) {
            setBadges((prev) => ({ ...prev, checkins: count }));
          }
        }),
      );
    }

    window.addEventListener(STUDENT_BADGES_REFRESH_EVENT, refreshStudentBadge);
    return () => {
      cancelled = true;
      window.removeEventListener(STUDENT_BADGES_REFRESH_EVENT, refreshStudentBadge);
    };
  }, [role]);

  const journeysBadge = badges.checkins + badges.onboardings;

  const mobileItems = useMemo<MobileNavItem[]>(() => {
    const items: MobileNavItem[] = mobileNav.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      match: item.match,
      badge:
        item.href === "/studio/journeys" && journeysBadge
          ? journeysBadge
          : item.href === "/session" && badges.checkins
            ? badges.checkins
            : undefined,
    }));
    items.push({
      label: "Perfil",
      href: settingsHref,
      match: (p) => p === settingsHref || p.startsWith(`${settingsHref}/`),
      profileAvatarUrl: avatarUrl,
      profileName: name,
      profileEmail: email,
    });
    return items;
  }, [mobileNav, settingsHref, name, email, avatarUrl, badges, journeysBadge]);

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
      badge:
        item.href === "/studio/journeys" && journeysBadge
          ? journeysBadge
          : undefined,
    }));
    core.push({
      label: "Perfil",
      href: settingsHref,
      icon: Settings,
      match: (p) => p === settingsHref || p.startsWith(`${settingsHref}/`),
      subtitle: name ?? email,
      profileAvatarUrl: avatarUrl,
      profileName: name,
      profileEmail: email,
    });
    return core;
  }, [role, settingsHref, name, email, avatarUrl, badges, journeysBadge]);

  const studentDrawerItems = useMemo<MentorDrawerItem[]>(() => {
    if (role !== "student") return [];
    const core: MentorDrawerItem[] = studentNav.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      match: item.match,
      badge:
        item.href === "/session" && badges.checkins
          ? badges.checkins
          : undefined,
    }));
    core.push({
      label: "Perfil",
      href: settingsHref,
      icon: Settings,
      match: (p) => p === settingsHref || p.startsWith(`${settingsHref}/`),
      subtitle: name ?? email,
      profileAvatarUrl: avatarUrl,
      profileName: name,
      profileEmail: email,
    });
    return core;
  }, [role, settingsHref, name, email, avatarUrl, badges]);

  const drawerItems =
    role === "mentor" ? mentorDrawerItems : studentDrawerItems;
  // Com pendingHref (nav optimista) não há query — trata como destino limpo.
  const isRootPage = pendingHref
    ? isShellRootPage(pendingHref, role)
    : isShellRootPage(pathname, role, searchParams);
  const backHref = shellBackHref(pathname, role, searchParams);

  useEffect(() => {
    try {
      setSidebarCollapsed(
        window.localStorage.getItem("neuma-sidebar-collapsed") === "1",
      );
    } catch {
      // ignore
    }
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          "neuma-sidebar-collapsed",
          next ? "1" : "0",
        );
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Prefetch agressivo no mount removido — cada prefetch re-corria middleware + layout.
  useEffect(() => {
    scrollToTop();
    setNavCompact(false);
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!navPending) setPendingHref(null);
  }, [navPending]);

  useEffect(() => {
    const shell = getAppScrollEl();
    let lastY = shell?.scrollTop ?? 0;

    const onScroll = () => {
      const y = Math.max(0, shell?.scrollTop ?? window.scrollY);
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

    const target: HTMLElement | Window = shell ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  function onNavClick(href?: string) {
    scrollToTop();
    setNavCompact(false);
    if (!href) return;

    const [targetPath, targetSearch = ""] = href.split("?");
    const currentSearch = searchParams.toString();
    const samePlace =
      targetPath === pathname && targetSearch === currentSearch;
    if (samePlace) return;

    setPendingHref(targetPath);
    startNavTransition(() => {
      router.push(href);
    });
  }

  function onBackClick(href: string) {
    void requestJourneyEditLeave(href).then((proceed) => {
      if (proceed) onNavClick(href);
    });
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col desktop:flex-row">
      <aside
        className={cn(
          "neuma-enter neuma-tablet-top-sidebar fixed left-0 top-0 z-30 hidden h-dvh p-3 transition-[width] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] desktop:block",
          sidebarCollapsed ? "w-[5.625rem]" : "w-64",
        )}
      >
        {/* Contorno completo (incl. direita). Conteúdo interior em largura fixa — ícones/logo não se mexem. */}
        <div className="glass-panel relative h-full w-full overflow-hidden rounded-3xl">
          <div className="absolute inset-y-0 left-0 flex w-[calc(16rem-1.5rem)] flex-col p-3">
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              aria-label={
                sidebarCollapsed ? "Maximizar menu" : "Minimizar menu"
              }
              aria-pressed={sidebarCollapsed}
              title={sidebarCollapsed ? "Maximizar menu" : "Minimizar menu"}
              className="flex shrink-0 items-center justify-start rounded-xl px-2 py-3"
            >
              <NeumaLogo withWordmark={false} size={28} />
            </button>
            <div
              className="neuma-hairline mt-1 w-full shrink-0"
              style={{
                clipPath: sidebarCollapsed
                  ? "inset(0 calc(100% - 2.5rem) 0 1px)"
                  : "inset(0 0 0 0)",
                transition:
                  "clip-path 200ms cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            />

            <nav className="mt-4 min-h-0 flex-1 space-y-1">
              {nav.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                const badge =
                  item.href === "/studio/journeys" && journeysBadge
                    ? journeysBadge
                    : item.href === "/session" && badges.checkins
                      ? badges.checkins
                      : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={sidebarCollapsed ? item.label : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavClick(item.href);
                    }}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-0",
                        active
                          ? "bg-white/[0.12]"
                          : "bg-transparent group-hover:bg-white/5",
                      )}
                      style={{
                        clipPath: sidebarCollapsed
                          ? "inset(0 calc(100% - 2.5rem) 0 1px round 1.25rem)"
                          : "inset(0 0 0 0 round 1.25rem)",
                        transition:
                          "clip-path 200ms cubic-bezier(0.32, 0.72, 0, 1)",
                      }}
                    />
                    <span className="relative z-10 grid size-[18px] shrink-0 place-items-center">
                      <Icon className="size-[18px] shrink-0" />
                      <NavCountBadge count={badge} active={active} />
                    </span>
                    <span
                      className={cn(
                        "relative z-10 min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-opacity duration-100 ease-out",
                        sidebarCollapsed && "pointer-events-none opacity-0",
                      )}
                      aria-hidden={sidebarCollapsed}
                    >
                      <span className="block">{item.label}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            <Link
              href={settingsHref}
              prefetch
              title={sidebarCollapsed ? "Perfil" : undefined}
              aria-label={sidebarCollapsed ? "Perfil" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavClick(settingsHref);
              }}
              className={cn(
                "group relative mt-2 flex h-10 shrink-0 items-center gap-3 rounded-2xl px-3",
                settingsActive ? "text-foreground" : "text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0",
                  settingsActive
                    ? "bg-white/[0.12]"
                    : "bg-transparent group-hover:bg-white/5",
                )}
                style={{
                  clipPath: sidebarCollapsed
                    ? "inset(0 calc(100% - 2.5rem) 0 1px round 1.25rem)"
                    : "inset(0 0 0 0 round 1.25rem)",
                  transition:
                    "clip-path 200ms cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              />
              <span className="relative z-10 size-[18px] shrink-0">
                <UserAvatar
                  name={name}
                  email={email}
                  avatarUrl={avatarUrl}
                  size="md"
                  className={cn(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                    settingsActive && "ring-2 ring-white/25",
                  )}
                />
              </span>
              <div
                className={cn(
                  "relative z-10 min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-opacity duration-100 ease-out",
                  sidebarCollapsed && "pointer-events-none opacity-0",
                )}
                aria-hidden={sidebarCollapsed}
              >
                <p className="truncate text-sm font-medium">{name ?? email}</p>
                <p
                  className={cn(
                    "truncate text-xs",
                    settingsActive
                      ? "text-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  Perfil
                </p>
              </div>
              <Settings
                className={cn(
                  "relative z-10 size-4 shrink-0 transition-opacity duration-100 ease-out",
                  settingsActive
                    ? "text-foreground/70"
                    : "text-muted-foreground",
                  sidebarCollapsed && "pointer-events-none opacity-0",
                )}
                aria-hidden={sidebarCollapsed}
              />
            </Link>
            <LogoutForm className="shrink-0">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                title={sidebarCollapsed ? "Sair" : undefined}
                aria-label={sidebarCollapsed ? "Sair" : undefined}
                className="relative mt-3 !h-10 w-full !justify-start !gap-3 !px-3 text-muted-foreground hover:!bg-transparent"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-transparent group-hover/button:bg-white/5"
                  style={{
                    clipPath: sidebarCollapsed
                      ? "inset(0 calc(100% - 2.5rem) 0 1px round 1.25rem)"
                      : "inset(0 0 0 0 round 1.25rem)",
                    transition:
                      "clip-path 200ms cubic-bezier(0.32, 0.72, 0, 1)",
                  }}
                />
                <span className="relative z-10 grid size-[18px] shrink-0 place-items-center">
                  <LogOut className="size-4" />
                </span>
                <span
                  className={cn(
                    "relative z-10 whitespace-nowrap transition-opacity duration-100 ease-out",
                    sidebarCollapsed && "pointer-events-none opacity-0",
                  )}
                  aria-hidden={sidebarCollapsed}
                >
                  Sair
                </span>
              </Button>
            </LogoutForm>
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "neuma-tablet-scroll flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          sidebarCollapsed ? "desktop:pl-[5.625rem]" : "desktop:pl-64",
        )}
      >
        <header
          className={cn(
            "neuma-enter fixed inset-x-0 top-0 z-20 flex items-center bg-transparent desktop:hidden",
            /* Safe-area no header fixed (root já não faz pt) */
            "h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)]",
            isRootPage ? "justify-center" : "justify-start px-2",
          )}
        >
          <MentorMobileDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            items={drawerItems}
            onNavigate={onNavClick}
            pending={navPending}
            showMenuButton={isRootPage}
            homeHref={home}
          />
          {isRootPage ? (
            <Link
              href={home}
              aria-label="Neuma"
              prefetch
              onClick={(e) => {
                e.preventDefault();
                onNavClick(home);
              }}
            >
              <NeumaLogo size={36} withWordmark={false} />
            </Link>
          ) : (
            <Link
              href={backHref}
              aria-label="Voltar"
              prefetch
              onClick={(e) => {
                e.preventDefault();
                onBackClick(backHref);
              }}
              className="ml-0.5 grid size-12 place-items-center rounded-full text-foreground transition-colors active:bg-white/10"
            >
              <ChevronLeft className="size-8" strokeWidth={2.25} />
            </Link>
          )}
        </header>
        {/* Spacer = altura do header fixed (barra + safe-top) */}
        <div
          className="h-[calc(4rem+env(safe-area-inset-top,0px))] shrink-0 desktop:hidden"
          aria-hidden
        />

        <main className="neuma-enter neuma-enter-delay-1 neuma-tablet-top-main flex w-full min-w-0 flex-1 flex-col px-4 pt-4 pb-0 desktop:px-10 desktop:pb-14 desktop:pt-10">
          {navPending ? (
            <ScreenLoader />
          ) : (
            <>
              {!isRootPage ? (
                <div className="mb-4 hidden desktop:block">
                  <Link
                    href={backHref}
                    aria-label="Voltar"
                    prefetch
                    onClick={(e) => {
                      e.preventDefault();
                      onBackClick(backHref);
                    }}
                    className="-ml-2 inline-grid size-12 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <ChevronLeft className="size-8" strokeWidth={2.25} />
                  </Link>
                </div>
              ) : null}
              {children}
            </>
          )}
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
