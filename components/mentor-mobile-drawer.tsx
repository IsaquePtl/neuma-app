"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Menu, X, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { NeumaLogo } from "@/components/neuma-logo";
import { UserAvatar } from "@/components/user-avatar";

export type MentorDrawerItem = {
  label: string;
  href: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  subtitle?: string;
  match: (path: string) => boolean;
  badge?: number;
  profileAvatarUrl?: string | null;
  profileName?: string | null;
  profileEmail?: string | null;
};

function isProfileItem(item: MentorDrawerItem) {
  return (
    item.profileAvatarUrl !== undefined ||
    item.profileName !== undefined ||
    item.profileEmail !== undefined
  );
}

export function MentorMobileDrawer({
  open,
  onOpenChange,
  items,
  onNavigate,
  pending = false,
  showMenuButton = true,
  homeHref = "/home",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MentorDrawerItem[];
  onNavigate: (href?: string) => void;
  pending?: boolean;
  /** Em páginas internas o header mostra só «voltar». */
  showMenuButton?: boolean;
  homeHref?: string;
}) {
  const pathname = usePathname();
  const [targetHref, setTargetHref] = useState<string | null>(null);
  const sawPending = useRef(false);
  const footerItem = items.find((item) => isProfileItem(item));
  const mainItems = items.filter((item) => !isProfileItem(item));

  // Fecha só depois da transição de navegação terminar.
  useEffect(() => {
    if (pending) sawPending.current = true;
  }, [pending]);

  useEffect(() => {
    if (!targetHref || !sawPending.current) return;
    if (pending) return;
    sawPending.current = false;
    setTargetHref(null);
    onOpenChange(false);
  }, [pending, targetHref, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setTargetHref(null);
      sawPending.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange, pending]);

  function closeIfIdle() {
    if (pending || targetHref) return;
    onOpenChange(false);
  }

  function handleNavigate(href: string, isCurrent: boolean) {
    if (isCurrent) {
      setTargetHref(null);
      onOpenChange(false);
      return;
    }
    setTargetHref(href);
    onNavigate(href);
  }

  return (
    <>
      {showMenuButton && !open ? (
        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={false}
          onClick={() => onOpenChange(true)}
          className={cn(
            "fixed left-3 z-[55] grid size-12 place-items-center rounded-full",
            "top-[calc(env(safe-area-inset-top,0px)+0.625rem)]",
            "bg-white/5 text-foreground transition-colors hover:bg-white/10",
            "desktop:hidden",
          )}
        >
          <Menu className="size-6" />
        </button>
      ) : null}

      <button
        type="button"
        aria-label="Fechar"
        tabIndex={open && !pending ? 0 : -1}
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-40 bg-black/55 backdrop-blur-md desktop:hidden",
          "transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
          pending && "pointer-events-none",
        )}
        onClick={closeIfIdle}
      />

      <aside
        aria-busy={pending || undefined}
        className={cn(
          "fixed left-0 z-50 flex w-[min(18rem,88vw)] flex-col p-3 desktop:hidden",
          /* Alinhado ao header (logo / botão menu), não sob o status bar */
          "top-[calc(env(safe-area-inset-top,0px)+0.5rem)] bottom-3",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
          open ? "translate-x-0" : "-translate-x-[110%]",
        )}
      >
        <div className="mentor-mobile-drawer-panel relative flex h-full flex-col overflow-hidden rounded-3xl p-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={homeHref}
              aria-label="Neuma"
              prefetch
              className="px-2 py-3"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate(homeHref, pathname === homeHref);
              }}
            >
              <NeumaLogo withWordmark={false} />
            </Link>
            <button
              type="button"
              aria-label="Fechar"
              disabled={pending}
              onClick={closeIfIdle}
              className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/10 disabled:opacity-40"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="neuma-hairline mx-2 mt-1" />
          <nav className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {mainItems.map((item) => (
              <DrawerLink
                key={item.href}
                item={item}
                pathname={pathname}
                targetHref={targetHref}
                pending={pending}
                onNavigate={handleNavigate}
              />
            ))}
          </nav>
          {footerItem ? (
            <div className="mt-2 shrink-0 space-y-2">
              <DrawerLink
                item={footerItem}
                pathname={pathname}
                targetHref={targetHref}
                pending={pending}
                onNavigate={handleNavigate}
              />
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function DrawerLink({
  item,
  pathname,
  targetHref,
  pending,
  onNavigate,
}: {
  item: MentorDrawerItem;
  pathname: string;
  targetHref: string | null;
  pending: boolean;
  onNavigate: (href: string, isCurrent: boolean) => void;
}) {
  const Icon = item.icon;
  const isCurrent = item.match(pathname);
  const isTarget = targetHref === item.href;
  const active = isTarget || (!targetHref && isCurrent);

  return (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? "page" : undefined}
      aria-busy={isTarget && pending ? true : undefined}
      onClick={(e) => {
        e.preventDefault();
        if (pending && !isTarget) return;
        onNavigate(item.href, isCurrent);
      }}
      className={cn(
        "flex items-center gap-3.5 rounded-2xl px-3.5 py-4 transition-colors",
        active
          ? "bg-white/[0.12] text-foreground"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        pending && !isTarget && "pointer-events-none opacity-45",
      )}
    >
      {isProfileItem(item) ? (
        isTarget && pending ? (
          <span className="grid size-10 shrink-0 place-items-center">
            <Loader2 className="size-5 animate-spin" />
          </span>
        ) : (
          <UserAvatar
            name={item.profileName}
            email={item.profileEmail}
            avatarUrl={item.profileAvatarUrl}
            size="lg"
            className={cn(active && "ring-2 ring-white/30")}
          />
        )
      ) : (
        <span className="relative shrink-0">
          {isTarget && pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Icon className="size-5" />
          )}
          {item.badge && item.badge > 0 && !(isTarget && pending) ? (
            <span
              className={cn(
                "absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full px-1 text-[9px] font-semibold text-white",
                active ? "bg-white/25" : "bg-[var(--neuma-coral)]",
              )}
            >
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          ) : null}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-base font-medium">{item.label}</span>
        {item.subtitle && !(isTarget && pending) ? (
          <span
            className={cn(
              "block truncate text-sm",
              active ? "text-foreground/70" : "text-muted-foreground",
            )}
          >
            {item.subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
