"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Auth: fundo absoluto (parede) + lift só do card quando o teclado tapa o input.
 */
export function AuthViewport({
  children,
  scrollable = false,
}: {
  children: ReactNode;
  /** Só para páginas públicas longas (ex. Soundworks). Login mantém overflow hidden. */
  scrollable?: boolean;
}) {
  const liftRef = useRef<HTMLDivElement>(null);
  const [liftY, setLiftY] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const GAP = 16;

    const update = () => {
      const active = document.activeElement as HTMLElement | null;
      const isField =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT");

      if (!isField || !liftRef.current) {
        setLiftY(0);
        return;
      }

      const rect = active.getBoundingClientRect();
      const visibleBottom = vv.offsetTop + vv.height;
      const overflow = rect.bottom + GAP - visibleBottom;
      setLiftY(overflow > 0 ? -overflow : 0);
    };

    const onFocusOut = () => {
      window.setTimeout(update, 40);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex touch-manipulation items-center justify-center overscroll-none desktop:static desktop:z-auto desktop:h-full desktop:w-full",
        scrollable
          ? "overflow-x-hidden overflow-y-auto"
          : "overflow-hidden",
      )}
    >
      <div
        ref={liftRef}
        className="relative z-10 flex w-full max-w-md flex-col items-center px-4 py-6 transition-transform duration-200 ease-out desktop:items-start desktop:px-10 desktop:py-10"
        style={{
          transform: liftY ? `translateY(${liftY}px)` : undefined,
          paddingTop: "max(1.5rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        {children}
      </div>
    </div>
  );
}
