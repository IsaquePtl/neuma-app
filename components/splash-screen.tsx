"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const HOLD_MS = 3000;
const FADE_OUT_MS = 1200;

export function SplashScreen() {
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), HOLD_MS);
    const t2 = setTimeout(() => setShow(false), HOLD_MS + FADE_OUT_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex h-dvh max-h-dvh w-full items-center justify-center overflow-hidden bg-background transition-opacity duration-[1200ms] ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Mesmo fundo da app — absolute para não escapar do stacking do splash */}
      <div aria-hidden className="neuma-bg !absolute !inset-0 !z-0" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <Image
          src="/brand/wordmark-white.png"
          alt="Neuma"
          width={220}
          height={103}
          priority
          className="h-auto w-[220px] animate-fade-up"
        />
        <span className="animate-fade-up delay-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          1:1 premium
        </span>
      </div>
    </div>
  );
}
