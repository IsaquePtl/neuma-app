"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  FileText,
  Loader2,
  Play,
} from "lucide-react";

import { MediaVideoPlayer } from "@/components/media-video-player";
import { isPlayableVideoUrl, toEmbedUrl } from "@/components/video-embed";
import { cn } from "@/lib/utils";

/** Botão estilo to-do: vídeo embutido expande; ficheiro abre link. */
export function SupportMediaToggle({
  url,
  title,
  label = "Abrir anexo de apoio",
}: {
  url: string;
  title?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const embed = toEmbedUrl(url);
  const isVideo = isPlayableVideoUrl(url);
  const isIframeEmbed = Boolean(embed);

  useEffect(() => {
    if (!open) {
      setReady(false);
      setLoading(false);
    }
  }, [open]);

  if (!isVideo) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm transition-colors hover:bg-white/[0.07]"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
          <FileText className="size-3.5 text-[var(--neuma-coral)]" />
        </span>
        <span className="min-w-0 truncate font-medium">{label}</span>
      </a>
    );
  }

  function toggle() {
    if (open || loading) {
      setOpen(false);
      setLoading(false);
      setReady(false);
      return;
    }
    if (isIframeEmbed) {
      setLoading(true);
      setReady(false);
      setOpen(true);
      return;
    }
    // Native / hosted file — MediaVideoPlayer mounts immediately.
    setOpen(true);
    setReady(true);
    setLoading(false);
  }

  const expanded = open && ready;
  const loadingState = loading && !ready;

  return (
    <div className="min-w-0 w-full max-w-full space-y-2">
      <button
        type="button"
        onClick={toggle}
        disabled={loadingState}
        aria-expanded={expanded}
        aria-busy={loadingState}
        aria-label={expanded ? "Fechar anexo de apoio" : label}
        className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-sm transition-colors hover:bg-white/[0.07] disabled:opacity-80"
      >
        {expanded ? (
          <span className="min-w-0 flex-1" aria-hidden />
        ) : (
          <span className="inline-flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
              {loadingState ? (
                <Loader2 className="size-3.5 animate-spin text-[var(--neuma-coral)]" />
              ) : (
                <Play className="size-3.5 fill-current text-[var(--neuma-coral)]" />
              )}
            </span>
            <span className="truncate font-medium">
              {loadingState ? "A carregar…" : label}
            </span>
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
            loadingState && "opacity-0",
          )}
        />
      </button>

      {open && isIframeEmbed ? (
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-xl",
            ready
              ? "aspect-video border border-white/10"
              : "pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0",
          )}
          aria-hidden={!ready}
        >
          <iframe
            src={embed!}
            title={title ?? "Anexo de apoio"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => {
              setReady(true);
              setLoading(false);
            }}
            className={cn(
              "border-0",
              ready ? "absolute inset-0 size-full" : "size-px",
            )}
          />
        </div>
      ) : null}

      {open && !isIframeEmbed ? (
        <MediaVideoPlayer
          url={url}
          title={title}
          size="full"
          fallbackLabel={label}
        />
      ) : null}
    </div>
  );
}
