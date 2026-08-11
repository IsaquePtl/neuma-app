"use client";

import { useEffect, useId, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { CalendarClock, ExternalLink, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_CAL_USER =
  process.env.NEXT_PUBLIC_CALCOM_USERNAME || "isaque-portilho-nutfa9";

/** Fundo escuro oficial do booker Cal (evita canvas branco no iframe). */
const CAL_DARK_BG = "#101010";

/**
 * UI dark completo. `colorScheme: "dark"` alinha o color-scheme do iframe
 * com a página (viewport dark) — sem isto o browser pinta um fundo branco
 * atrás do body transparente do embed.
 */
const CAL_UI = {
  theme: "dark" as const,
  colorScheme: "dark",
  hideEventTypeDetails: false,
  layout: "month_view" as const,
  styles: {
    body: { background: CAL_DARK_BG },
  },
  cssVarsPerTheme: {
    light: {
      "cal-bg": CAL_DARK_BG,
    },
    dark: {
      "cal-bg": CAL_DARK_BG,
      "cal-bg-muted": "#171717",
      "cal-bg-subtle": "#1c1c1c",
      "cal-bg-emphasis": "#262626",
    },
  },
};

/** Tema via config = query param síncrono (sem flash light→dark). */
const CAL_CONFIG = {
  layout: "month_view" as const,
  theme: "dark" as const,
  "ui.color-scheme": "dark",
  useSlotsViewOnSmallScreen: "true",
};

type CalLinkProps = {
  /** Ex.: `isaque-portilho-nutfa9/30min` ou só o username (usa eventType). */
  calLink?: string;
  namespace?: string;
  eventType?: string;
};

function resolveCalLink({
  calLink,
  eventType = "30min",
}: Pick<CalLinkProps, "calLink" | "eventType">) {
  return calLink ?? `${DEFAULT_CAL_USER}/${eventType}`;
}

function publicCalUrl(calLink: string) {
  return `https://cal.com/${calLink.replace(/^\//, "")}`;
}

async function applyCalUi(namespace: string) {
  const cal = await getCalApi({ namespace });
  cal("ui", CAL_UI);
  return cal;
}

type CalBookButtonProps = CalLinkProps & {
  className?: string;
  label?: string;
  description?: string;
  /** Esconde o botão “Abrir no Cal.com”. */
  showExternalLink?: boolean;
  /** Botão grande (estilo session / nível). */
  size?: "default" | "lg";
};

/**
 * CTA instantâneo + modal Cal.com com prerender (sem iframe inline).
 * Fallback: abrir cal.com noutra aba se o script falhar.
 */
export function CalBookButton({
  calLink,
  namespace,
  eventType = "30min",
  className,
  label = "Agendar chamada",
  description = "Escolhe um horário — abre de imediato.",
  showExternalLink = true,
  size = "default",
}: CalBookButtonProps) {
  const reactId = useId().replace(/:/g, "");
  const ns = namespace ?? `cal-book-${reactId}`;
  const resolvedLink = resolveCalLink({ calLink, eventType });
  const fallbackHref = publicCalUrl(resolvedLink);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cal = await applyCalUi(ns);
        if (cancelled) return;
        cal("prerender", {
          calLink: resolvedLink,
          type: "modal",
        });
        if (!cancelled) setScriptReady(true);
      } catch {
        if (!cancelled) setScriptReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ns, resolvedLink]);

  const openModal = async () => {
    try {
      const cal = await applyCalUi(ns);
      cal("modal", {
        calLink: resolvedLink,
        config: CAL_CONFIG,
      });
    } catch {
      window.open(fallbackHref, "_blank", "noopener,noreferrer");
    }
  };

  const lg = size === "lg";

  return (
    <div className={cn("space-y-3", className)}>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className={cn("flex flex-wrap gap-2", lg && "flex-col")}>
        <Button
          type="button"
          size={lg ? "lg" : "default"}
          className={cn(
            "gap-2",
            lg && "h-14 w-full gap-2 text-base font-semibold",
          )}
          onClick={openModal}
        >
          <Phone className={lg ? "size-5" : "size-4"} />
          {label}
        </Button>
        {showExternalLink ? (
          <Button
            render={
              <a href={fallbackHref} target="_blank" rel="noopener noreferrer" />
            }
            nativeButton={false}
            variant="secondary"
            className="gap-2"
          >
            <ExternalLink className="size-4" />
            Abrir no Cal.com
          </Button>
        ) : null}
      </div>
      {!scriptReady && !lg ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          A preparar agenda em segundo plano…
        </p>
      ) : null}
    </div>
  );
}

type CalEmbedProps = CalLinkProps & {
  className?: string;
  /** Viewport compacto (cabe no ecrã; scroll interno do Cal). */
  compact?: boolean;
};

/**
 * Inline embed Cal.com — lento (iframe da app Cal). Preferir `CalBookButton`.
 * Montar só quando o contentor estiver visível (não dentro de `<details>` fechado).
 */
export function CalEmbed({
  calLink,
  namespace = "30min",
  eventType = "30min",
  className,
  compact = true,
}: CalEmbedProps) {
  const resolvedLink = resolveCalLink({ calLink, eventType });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await applyCalUi(namespace);
      } catch {
        // O iframe ainda pode carregar; UI theme é best-effort.
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [namespace]);

  return (
    <div
      className={cn(
        "cal-embed-frame relative w-full overflow-hidden rounded-2xl",
        compact && "cal-embed-frame--compact",
        className,
      )}
    >
      <Cal
        key={`${namespace}-${resolvedLink}`}
        namespace={namespace}
        calLink={resolvedLink}
        style={{
          width: "100%",
          height: "100%",
          overflow: "scroll",
          background: CAL_DARK_BG,
        }}
        config={CAL_CONFIG}
      />
    </div>
  );
}

/** Embed atrás de um `<details>` — só monta quando aberto (evita iframe a 0×0). */
export function CalEmbedDisclosure({
  calLink,
  namespace = "cal-disclosure",
  eventType = "30min",
  summary = "Abrir embed Cal.com (marcar sessão)",
  id = "agendar",
}: {
  calLink?: string;
  namespace?: string;
  eventType?: string;
  summary?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromHash = () => {
      if (window.location.hash.replace(/^#/, "") === id) {
        setOpen(true);
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [id]);

  return (
    <details
      id={id}
      className="group scroll-mt-24"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
        {summary}
      </summary>
      {open ? (
        <div className="mt-3">
          <CalBookButton
            calLink={calLink}
            namespace={namespace}
            eventType={eventType}
          />
        </div>
      ) : null}
    </details>
  );
}
