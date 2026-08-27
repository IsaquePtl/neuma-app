"use client";

import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

export function profileInitials(
  name: string | null | undefined,
  email?: string | null,
) {
  const base = (name ?? email ?? "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase() || "?";
}

const sizeClass = {
  sm: "size-8 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-10 text-sm",
  xl: "size-12 text-lg",
} as const;

export function UserAvatar({
  name,
  email,
  avatarUrl,
  size = "md",
  className,
  rounded = "full",
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: keyof typeof sizeClass;
  className?: string;
  rounded?: "full" | "xl" | "2xl";
}) {
  const initials = profileInitials(name, email);
  const radius =
    rounded === "full"
      ? "rounded-full"
      : rounded === "xl"
        ? "rounded-xl"
        : "rounded-2xl";

  return (
    <Avatar
      className={cn(
        sizeClass[size],
        radius,
        "after:hidden shrink-0 overflow-hidden",
        className,
      )}
    >
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={name ?? email ?? ""} className={radius} />
      ) : null}
      <AvatarFallback
        className={cn(
          radius,
          "bg-gradient-to-br from-[var(--neuma-coral)] to-[var(--neuma-blue)] font-semibold text-white",
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
