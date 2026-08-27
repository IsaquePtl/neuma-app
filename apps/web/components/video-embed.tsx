import { ExternalLink, Play } from "lucide-react";

import { cn } from "@/lib/utils";

/** Converte um link de vídeo em URL de embed. Devolve null se não for suportado. */
export function toEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" && parts[0]) {
    return `https://www.youtube.com/embed/${parts[0]}`;
  }
  if (host.endsWith("youtube.com")) {
    const v = url.searchParams.get("v");
    if (v) return `https://www.youtube.com/embed/${v}`;
    if ((parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") && parts[1]) {
      return `https://www.youtube.com/embed/${parts[1]}`;
    }
  }
  if (host.endsWith("vimeo.com")) {
    const id = parts.find((p) => /^\d+$/.test(p));
    if (id) return `https://player.vimeo.com/video/${id}`;
  }
  if (host.endsWith("loom.com") && parts[0] === "share" && parts[1]) {
    return `https://www.loom.com/embed/${parts[1]}`;
  }
  if (host === "drive.google.com" && parts[0] === "file" && parts[2]) {
    return `https://drive.google.com/file/d/${parts[2]}/preview`;
  }

  return null;
}

/** Player embutido para o vídeo de um bloco; cai para link externo se não for suportado. */
export function VideoEmbed({
  url,
  title,
  className,
  fallbackLabel = "Abrir vídeo",
}: {
  url: string | null | undefined;
  title?: string;
  className?: string;
  fallbackLabel?: string;
}) {
  if (!url) return null;
  const embed = toEmbedUrl(url);

  if (!embed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm transition-colors hover:bg-white/[0.06]",
          className,
        )}
      >
        <Play className="size-4 text-[var(--neuma-coral)]" />
        {fallbackLabel}
        <ExternalLink className="size-3.5 text-muted-foreground" />
      </a>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40",
        className,
      )}
    >
      <iframe
        src={embed}
        title={title ?? "Vídeo"}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 size-full"
      />
    </div>
  );
}
