"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Inbox,
  ClipboardList,
  Music,
  Route,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import { logout } from "@/lib/actions/auth";
import { NeumaLogo } from "@/components/neuma-logo";
import { MobileMenubar, type MobileNavItem } from "@/components/mobile-menubar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
};

const mentorNav: NavItem[] = [
  { label: "Inicio", href: "/studio", icon: LayoutDashboard, match: (p) => p === "/studio" },
  { label: "Alunos", href: "/studio/students", icon: Users, match: (p) => p.startsWith("/studio/students") },
  { label: "Check-ins", href: "/studio/checkins", icon: Inbox, match: (p) => p.startsWith("/studio/checkins") },
  { label: "Forms", href: "/studio/forms", icon: ClipboardList, match: (p) => p.startsWith("/studio/forms") },
  { label: "Tools", href: "/studio/tools", icon: Music, match: (p) => p.startsWith("/studio/tools") },
];

const studentNav: NavItem[] = [
  { label: "Percurso", href: "/path", icon: Route, match: (p) => p === "/path" },
  { label: "Check-ins", href: "/checkins", icon: Inbox, match: (p) => p.startsWith("/checkins") },
  { label: "Tools", href: "/tools", icon: Music, match: (p) => p.startsWith("/tools") },
];

function initials(name: string | null | undefined, email: string) {
  const base = (name ?? email).trim();
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export function AppShell({
  role,
  name,
  email,
  children,
}: {
  role: "mentor" | "student";
  name: string | null | undefined;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = role === "mentor" ? mentorNav : studentNav;
  const settingsHref = role === "mentor" ? "/studio/settings" : "/settings";
  const settingsActive = pathname === settingsHref;
  const home = role === "mentor" ? "/studio" : "/path";
  const [headerHidden, setHeaderHidden] = useState(false);
  const [navCompact, setNavCompact] = useState(false);

  const mobileItems = useMemo<MobileNavItem[]>(() => {
    const items: MobileNavItem[] = nav
      .filter((item) => !item.href.endsWith("/tools"))
      .map((item) => ({
        label: item.label,
        href: item.href,
        icon: item.icon,
        match: item.match,
      }));
    items.push({
      label: "Perfil e definicoes",
      href: settingsHref,
      match: (p) => p === settingsHref,
      profileInitials: initials(name, email),
    });
    return items;
  }, [nav, settingsHref, name, email]);

  useEffect(() => {
    scrollToTop();
    setHeaderHidden(false);
    setNavCompact(false);
  }, [pathname]);

  useEffect(() => {
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      if (y < 8) {
        setHeaderHidden(false);
        setNavCompact(false);
      } else if (y > lastY + 6) {
        setHeaderHidden(true);
        setNavCompact(true);
      } else if (y < lastY - 6) {
        setHeaderHidden(false);
        setNavCompact(false);
      }
      lastY = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onNavClick() {
    scrollToTop();
    setHeaderHidden(false);
    setNavCompact(false);
  }

  return (
    <div className="relative flex min-h-dvh flex-col lg:flex-row">
      {/* ---- Sidebar flutuante (desktop) ---- */}
      <aside className="fixed left-0 top-0 z-30 hidden h-dvh w-64 p-3 lg:block">
        <div className="glass-panel flex h-full w-full flex-col rounded-3xl p-4">
          <Link href={home} className="px-2 py-3" onClick={onNavClick}>
            <NeumaLogo />
          </Link>
          <div className="neuma-hairline mx-2 mt-1 rounded-full opacity-70" />

          <nav className="mt-4 flex-1 space-y-1">
            {nav.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                    active
                      ? "bg-white/8 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <span className="neuma-gradient absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full" />
                  ) : null}
                  <Icon className="size-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href={settingsHref}
            onClick={onNavClick}
            className={cn(
              "mt-2 flex items-center gap-3 rounded-2xl p-2 transition-colors",
              settingsActive ? "bg-white/8" : "hover:bg-white/5",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--neuma-coral)] to-[var(--neuma-blue)] text-xs font-semibold text-white">
              {initials(name, email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name ?? email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {role === "mentor" ? "Mentor" : "Aluno"}
              </p>
            </div>
            <Settings className="size-4 text-muted-foreground" />
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

      {/* ---- Coluna principal ---- */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <header
          className={cn(
            "fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-center transition-transform duration-300 ease-out lg:hidden",
            headerHidden ? "-translate-y-full" : "translate-y-0",
          )}
        >
          <Link href={home} aria-label="Neuma" onClick={onNavClick}>
            <NeumaLogo size={28} withWordmark={false} />
          </Link>
        </header>
        <div className="h-14 shrink-0 lg:hidden" aria-hidden />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 lg:px-10 lg:pb-14 lg:pt-10">
          {children}
        </main>
      </div>

      <MobileMenubar
        items={mobileItems}
        onNavigate={onNavClick}
        compact={navCompact}
      />
    </div>
  );
}
