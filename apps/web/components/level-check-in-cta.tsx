"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";

import type { LevelCheckInSummary } from "@/lib/feedbacks/student-shared";
import { cn } from "@/lib/utils";

export function LevelCheckInCta({
  href,
  summary,
}: {
  href: string;
  summary: LevelCheckInSummary;
}) {
  const hasNews = summary.unviewedCount > 0;
  const showBadge = hasNews || summary.actionNeeded;
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [bleed, setBleed] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const link = linkRef.current;
    if (!link) return;
    const sync = () => {
      const rect = link.getBoundingClientRect();
      setBleed({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <div className="neuma-quiz-cta-host">
      {bleed && typeof document !== "undefined"
        ? createPortal(
            <span
              aria-hidden
              className="pointer-events-none fixed z-30"
              style={{
                top: bleed.top,
                left: bleed.left,
                width: bleed.width,
                height: bleed.height,
              }}
            >
              <span className="absolute top-1/2 left-1/2 h-[calc(100%+0.35rem)] w-[calc(100%+1.15rem)] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] bg-[var(--neuma-coral)] opacity-45 blur-md" />
              {showBadge ? (
                <span
                  className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center"
                  aria-label={
                    hasNews
                      ? `${summary.unviewedCount} feedback por ver`
                      : "Check-in por fazer"
                  }
                >
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/60" />
                  <span className="relative flex size-6 items-center justify-center rounded-full bg-white text-xs font-bold tabular-nums text-[var(--neuma-coral)] shadow-md">
                    {hasNews ? summary.unviewedCount : "!"}
                  </span>
                </span>
              ) : null}
            </span>,
            document.body,
          )
        : null}
      <Link
        ref={linkRef}
        href={href}
        prefetch
        className={cn(
          "group relative z-10 flex w-full min-w-0 items-center gap-3 rounded-2xl",
          "border border-white/10 bg-[var(--neuma-coral)] px-4 py-3 text-left text-white sm:gap-3.5 sm:px-5",
          "shadow-[inset_0_1px_0_0_oklch(1_0_0/18%)]",
          "hover:bg-[color-mix(in_oklch,var(--neuma-coral)_92%,black)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/14 to-transparent" />
        </span>

        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-white/15">
          <MessageSquareText className="size-5" aria-hidden />
        </span>

        <span className="relative flex min-w-0 flex-1 items-center gap-2.5 font-heading text-base font-semibold tracking-tight sm:text-lg">
          <span>Check-in</span>
          <span
            aria-hidden
            className="size-1 shrink-0 rounded-full bg-current opacity-80"
          />
          <span>Feedback</span>
        </span>

        <ArrowRight
          className="relative size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </div>
  );
}
