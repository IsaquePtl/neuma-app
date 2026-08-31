"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StudentActivityToggleCard({
  title,
  subtitle,
  badge,
  accent = false,
  expanded,
  onToggle,
  disabled = false,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  accent?: boolean;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "group min-w-0 w-full max-w-full gap-0 overflow-hidden p-0 transition-[box-shadow,background-color] duration-200",
        !disabled && "cursor-pointer hover:bg-white/[0.03]",
        accent && "neuma-accent-top",
        expanded && "ring-1 ring-white/12",
        disabled && "cursor-default opacity-70",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={expanded}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 p-4 text-left sm:gap-4 sm:p-5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40 focus-visible:ring-inset",
          disabled ? "cursor-default" : "cursor-pointer",
        )}
      >
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="break-words font-heading text-base font-bold tracking-tight sm:text-lg">
            {title}
          </span>
          <span className="block break-words text-sm text-muted-foreground">
            {subtitle}
          </span>
        </span>
        {badge || !disabled ? (
          <span className="flex shrink-0 items-center gap-2">
            {badge ? (
              <span className="inline-flex shrink-0 items-center">{badge}</span>
            ) : null}
            {!disabled ? (
              <ChevronDown
                className={cn(
                  "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
                  expanded && "rotate-180",
                )}
                aria-hidden
              />
            ) : null}
          </span>
        ) : null}
      </button>
      {expanded && children ? (
        <div className="min-w-0 space-y-4 border-t border-white/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      ) : null}
    </Card>
  );
}
