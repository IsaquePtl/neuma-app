"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { TallyEmbed } from "@/components/tally-embed";
import { cn } from "@/lib/utils";

const SOUNDWORKS_FORM_ID = "ODqoZM";

/**
 * Sem scroll / sem salto com teclado: usa lvh (viewport estável), não dvh.
 * Desktop: um pouco mais abaixo, mais ao centro.
 */
export function SoundworksEmbed() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setReady(true), 4000);
    return () => window.clearTimeout(t);
  }, [ready]);

  // Bloqueia scroll residual (iOS) enquanto esta página está montada
  useEffect(() => {
    const ui = document.querySelector<HTMLElement>("[data-neuma-ui]");
    const prev = ui?.style.overflow ?? "";
    if (ui) {
      ui.style.overflow = "hidden";
      ui.scrollTop = 0;
    }
    return () => {
      if (ui) ui.style.overflow = prev;
    };
  }, []);

  return (
    <div className="soundworks-stage absolute inset-0 z-10 flex touch-manipulation flex-col overflow-hidden overscroll-none">
      <div
        className={cn(
          "mx-auto flex h-full w-full max-w-md min-h-0 flex-col px-4",
          // lvh = estável com teclado (dvh saltava ao abrir/fechar)
          "pt-[18lvh] pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
          // Desktop: desce um pouco para ficar mais ao centro
          "desktop:pt-[24%]",
          "transition-opacity duration-700 ease-out",
          ready ? "opacity-100" : "opacity-0",
        )}
      >
        <Image
          src="/brand/mark-white.png"
          alt="Neuma"
          width={80}
          height={80}
          priority
          className="mb-4 h-16 w-16 shrink-0 self-start desktop:mb-5 desktop:h-20 desktop:w-20"
        />

        <div className="soundworks-embed-frame min-h-0 w-full flex-1 overflow-hidden">
          <TallyEmbed
            formId={SOUNDWORKS_FORM_ID}
            title="Neuma Soundworks"
            height="100%"
            className="h-full min-h-0"
            params={{ hideTitle: "0", dynamicHeight: "0" }}
            onReady={() => setReady(true)}
          />
        </div>
      </div>
    </div>
  );
}
