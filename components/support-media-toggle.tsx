"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Paperclip, Play } from "lucide-react";

import { VideoEmbed, toEmbedUrl } from "@/components/video-embed";
import { cn } from "@/lib/utils";

/** Botão estilo to-do: se for vídeo embeddável, expande/minimiza; senão abre link. */
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
  const embeddable = Boolean(toEmbedUrl(url));

  if (!embeddable) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm transition-colors hover:bg-white/[0.07]"
      >
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
            <Paperclip className="size-3.5 text-[var(--neuma-coral)]" />
          </span>
          <span className="truncate font-medium">{label}</span>
        </span>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-sm transition-colors hover:bg-white/[0.07]"
      >
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
            {open ? (
              <ChevronDown className="size-3.5 text-[var(--neuma-coral)]" />
            ) : (
              <Play className="size-3.5 fill-current text-[var(--neuma-coral)]" />
            )}
          </span>
          <span className="truncate font-medium">
            {open ? "Minimizar vídeo" : label}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <VideoEmbed
          url={url}
          title={title}
          className="aspect-video w-full overflow-hidden rounded-xl border border-white/10"
          fallbackLabel="Abrir vídeo"
        />
      ) : null}
    </div>
  );
}
