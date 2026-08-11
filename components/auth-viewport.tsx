"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Auth shell: fundo fixo (não sobe com o teclado) + levantamento do card
 * só o necessário para o input focado ficar acima do teclado.
 */
export function AuthViewport({ children }: { children: ReactNode }) {
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

      // Com interactive-widget=overlays-content o layout não encolhe;
      // vv.height é a área visível acima do teclado.
      const rect = active.getBoundingClientRect();
      const visibleBottom = vv.offsetTop + vv.height;
      const overflow = rect.bottom + GAP - visibleBottom;
      setLiftY(overflow > 0 ? -overflow : 0);
    };

    const onFocusOut = () => {
      // Deixa o blur aplicar antes de recalcular
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
    <div className="fixed inset-0 z-10 flex h-[100dvh] max-h-[100dvh] w-screen touch-manipulation items-center justify-center overflow-hidden overscroll-none">
      {/* Fundo próprio do auth — igual ao splash; não se move com o teclado */}
      <div
        aria-hidden
        className="neuma-bg pointer-events-none !absolute !inset-0 !z-0 !h-full !w-full !min-h-full"
      />
      <div
        ref={liftRef}
        className="relative z-10 flex w-full max-w-md flex-col items-center px-4 py-6 transition-transform duration-200 ease-out will-change-transform"
        style={{
          transform: `translateY(${liftY}px)`,
          paddingTop: "max(1.5rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        {children}
      </div>
    </div>
  );
}
