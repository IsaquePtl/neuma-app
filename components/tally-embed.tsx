"use client";

import { useCallback, useEffect, useRef } from "react";
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
  url.searchParams.set("transparentBackground", "1");

  const dynamicHeight = params?.dynamicHeight;
  if (dynamicHeight === undefined) {
    url.searchParams.set("dynamicHeight", "1");
  }

  const hideTitle = params?.hideTitle;
  if (hideTitle === undefined) {
    url.searchParams.set("hideTitle", "1");
  }

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (key === "hideTitle") {
        if (value === "0" || value === "false") {
          url.searchParams.delete("hideTitle");
        } else if (value) {
          url.searchParams.set("hideTitle", value);
        }
        continue;
      }
      if (key === "dynamicHeight") {
        if (value === "0" || value === "false") {
          url.searchParams.delete("dynamicHeight");
          url.searchParams.set("dynamicHeight", "0");
        } else if (value) {
          url.searchParams.set("dynamicHeight", value);
        }
        continue;
      }
      if (value) url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function loadTallyEmbeds() {
  window.Tally?.loadEmbeds();
}

/** Embed Tally: `src` no iframe (carrega sempre) + script só para dynamicHeight. */
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
  height?: number | string;
  params?: Record<string, string | null | undefined>;
  onReady?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const src = tallyEmbedUrl(formId, params);

  const markReady = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    readyRef.current = false;

    function onMessage(event: MessageEvent) {
      if (typeof event.data !== "string") return;
      try {
        const payload = JSON.parse(event.data) as { event?: string };
        if (payload.event === "Tally.FormLoaded") markReady();
      } catch {
        /* ignore */
      }
    }

    window.addEventListener("message", onMessage);
    loadTallyEmbeds();

    const poll = window.setInterval(() => {
      if (!window.Tally) return;
      window.clearInterval(poll);
      loadTallyEmbeds();
    }, 50);
    const stopPoll = window.setTimeout(() => window.clearInterval(poll), 8_000);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
      window.clearTimeout(stopPoll);
    };
  }, [src, markReady]);

  return (
    <>
      <Script
        id="tally-embed-js"
        src={TALLY_EMBED_JS}
        strategy="afterInteractive"
        onLoad={loadTallyEmbeds}
        onReady={loadTallyEmbeds}
      />
      <iframe
        ref={iframeRef}
        src={src}
        loading="eager"
        width="100%"
        height={height}
        title={title}
        onLoad={() => {
          const current = iframeRef.current?.src ?? "";
          if (current.includes("tally.so/embed")) markReady();
        }}
        className={cn(
          "tally-embed-frame block w-full border-0 bg-transparent",
          className,
        )}
        allow="camera; microphone; clipboard-write"
      />
    </>
  );
}
