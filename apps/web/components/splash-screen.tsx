"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { NeumaBackgroundWall } from "@/components/neuma-background-wall";

const HOLD_MS = 3000;
const FADE_OUT_MS = 1200;
const DESKTOP_MQ = "(min-width: 850px)";

export function SplashScreen({ enabled = true }: { enabled?: boolean }) {
  const [show, setShow] = useState(enabled);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setShow(false);
      return;
    }

    if (window.matchMedia(DESKTOP_MQ).matches) {
      setShow(false);
      return;
    }

    setShow(true);
    setLeaving(false);

    const t1 = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const t2 = window.setTimeout(() => setShow(false), HOLD_MS + FADE_OUT_MS);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [enabled]);

  if (!show) return null;

  return (
    <div
      className={`splash-screen fixed inset-0 z-[100] flex h-[100dvh] w-screen max-h-[100dvh] touch-manipulation items-center justify-center overflow-hidden overscroll-none transition-opacity duration-[1200ms] desktop:hidden ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Mesmo fundo da app — edge-to-edge sob notch / home indicator */}
      <NeumaBackgroundWall className="pointer-events-none !absolute !inset-0 !z-0 !h-full !w-full !min-h-full" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <Image
          src="/brand/wordmark-white.png"
          alt="Neuma"
          width={220}
          height={103}
          priority
          className="h-auto w-[220px] animate-fade-up"
          style={{ animationDelay: "180ms", opacity: 0 }}
        />
      </div>
    </div>
  );
}
