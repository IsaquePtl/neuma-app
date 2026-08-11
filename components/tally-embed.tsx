"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

import { cn } from "@/lib/utils";

const TALLY_EMBED_JS = "https://tally.so/widgets/embed.js";

declare global {
  interface Window {
    Tally?: {
      loadEmbeds: () => void;
    };
  }
}

export function tallyEmbedUrl(
  formId: string,
  params?: Record<string, string | null | undefined>,
) {
  const url = new URL(`https://tally.so/embed/${formId}`);
  url.searchParams.set("alignLeft", "1");
  url.searchParams.set("hideTitle", "1");
  url.searchParams.set("transparentBackground", "1");
  url.searchParams.set("dynamicHeight", "1");

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function loadTallyEmbeds() {
  if (typeof window === "undefined") return;
  if (window.Tally) {
    window.Tally.loadEmbeds();
    return;
  }
  document
    .querySelectorAll<HTMLIFrameElement>("iframe[data-tally-src]:not([src])")
    .forEach((iframe) => {
      const src = iframe.dataset.tallySrc;
      if (src) iframe.src = src;
    });
}

/** Embed oficial Tally: data-tally-src + widgets/embed.js (dynamicHeight). */
export function TallyEmbed({
  formId,
  title,
  className,
  height = 500,
  params,
  onReady,
}: {
  formId: string;
  title: string;
  className?: string;
  height?: number;
  params?: Record<string, string | null | undefined>;
  onReady?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const src = tallyEmbedUrl(formId, params);

  useEffect(() => {
    readyRef.current = false;
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.removeAttribute("src");
    iframe.setAttribute("data-tally-src", src);
    loadTallyEmbeds();
  }, [src]);

  function markReady() {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady?.();
  }

  return (
    <>
      <Script
        src={TALLY_EMBED_JS}
        strategy="afterInteractive"
        onLoad={loadTallyEmbeds}
        onError={loadTallyEmbeds}
      />
      <iframe
        ref={iframeRef}
        data-tally-src={src}
        loading="eager"
        width="100%"
        height={height}
        frameBorder={0}
        marginHeight={0}
        marginWidth={0}
        title={title}
        onLoad={markReady}
        className={cn("block w-full border-0 bg-transparent", className)}
        allow="camera; microphone; clipboard-write"
      />
    </>
  );
}
