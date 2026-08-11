"use client";

import { useEffect } from "react";

/**
 * Fundo edge-to-edge. A altura é fixada a window.innerHeight no load /
 * orientationchange — não acompanha o encolher do visualViewport do teclado iOS,
 * para o fundo não “subir” com o teclado.
 */
export function AppBackground() {
  useEffect(() => {
    const lock = () => {
      document.documentElement.style.setProperty(
        "--neuma-frame-height",
        `${window.innerHeight}px`,
      );
    };
    lock();
    window.addEventListener("orientationchange", lock);
    // Só em resize “real” (rotação / janela), não no teclado
    const onResize = () => {
      if (Math.abs(window.innerHeight - (window.visualViewport?.height ?? window.innerHeight)) < 80) {
        lock();
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("orientationchange", lock);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="neuma-bg pointer-events-none fixed inset-0 z-0 w-screen"
      style={{
        height: "var(--neuma-frame-height, 100dvh)",
        minHeight: "var(--neuma-frame-height, 100dvh)",
      }}
    />
  );
}
