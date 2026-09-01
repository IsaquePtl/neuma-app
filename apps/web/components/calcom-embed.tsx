"use client";

import { useEffect, useId, useRef } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { Phone } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_CAL_USER =
  process.env.NEXT_PUBLIC_CALCOM_USERNAME || "isaque-portilho-nutfa9";

/** Config do botão element-click (oficial Cal.com). */
const CAL_DATA_CONFIG = JSON.stringify({
  layout: "month_view",
  useSlotsViewOnSmallScreen: "true",
  theme: "dark",
});

/** UI mínima — alinhada ao snippet Cal + dark para a app. */
const CAL_UI = {
  theme: "dark" as const,
  colorScheme: "dark",
  hideEventTypeDetails: false,
  layout: "month_view" as const,
};

export type CalBookingSuccessData = {
  uid?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  videoCallUrl?: string;
  isReschedule?: boolean;
  previousUid?: string | null;
};

export type CalBookingCancelledData = {
  uid?: string;
};

type CalLinkProps = {
  /** Ex.: `isaque-portilho-nutfa9/30min`. */
  calLink?: string;
  /** Namespace oficial Cal (`30min` | `sessao-de-duvidas`). */
  namespace?: string;
  eventType?: string;
};

function resolveCalLink({
  calLink,
  eventType = "30min",
}: Pick<CalLinkProps, "calLink" | "eventType">) {
  return calLink ?? `${DEFAULT_CAL_USER}/${eventType}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

function extractBookingData(e: unknown): CalBookingSuccessData {
  const detail = asRecord((e as { detail?: unknown })?.detail);
  const data = asRecord(detail?.data) ?? {};
  const booking = asRecord(data.booking);

  return {
    uid:
      asString(data.uid) ??
      asString(booking?.uid) ??
      asString(data.bookingUid),
    title: asString(data.title) ?? asString(booking?.title),
    startTime:
      asString(data.startTime) ??
      asString(booking?.startTime) ??
      asString(data.date),
    endTime: asString(data.endTime) ?? asString(booking?.endTime),
    status: asString(data.status) ?? asString(booking?.status),
    videoCallUrl:
      asString(data.videoCallUrl) ??
      asString(booking?.videoCallUrl) ??
      asString(asRecord(booking?.metadata)?.videoCallUrl as string | undefined),
    previousUid:
      asString(data.rescheduleUid) ??
      asString(data.previousUid) ??
      asString(booking?.rescheduleUid) ??
      asString(booking?.fromReschedule) ??
      null,
  };
}

function extractCancelledData(e: unknown): CalBookingCancelledData {
  const detail = asRecord((e as { detail?: unknown })?.detail);
  const data = asRecord(detail?.data) ?? asRecord(detail) ?? {};
  const booking = asRecord(data.booking) ?? asRecord(data.data);

  return {
    uid:
      asString(data.uid) ??
      asString(booking?.uid) ??
      asString(data.bookingUid) ??
      asString(booking?.bookingUid) ??
      asString(asRecord(data.event)?.uid),
  };
}

/** Posiciona o × do Cal (shadow DOM) no canto do modal — mobile e desktop. */
function isCalModalOpen(host: Element) {
  const el = host as HTMLElement;
  const state = host.getAttribute("state");
  if (state === "closed" || state === "prerendering") return false;
  if (el.style.visibility === "hidden") return false;
  return state === "loaded" || state === "reopening" || state === "loading";
}

function pinCalModalCloseButton(host: Element) {
  const root = (host as HTMLElement).shadowRoot;
  if (!root) return;

  const header = root.querySelector(".header");
  const modal = root.querySelector(".modal-box");
  if (!(header instanceof HTMLElement) || !(modal instanceof HTMLElement)) {
    return;
  }

  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  if (isDesktop) {
    if (header.parentNode !== root) {
      root.appendChild(header);
    }
  } else if (header.parentNode !== modal) {
    modal.style.position = "relative";
    modal.prepend(header);
  }

  const state = host.getAttribute("state");
  const embedReady = state === "loaded" || state === "reopening";
  const modalOpen = isCalModalOpen(host);
  header.dataset.neumaVisible = embedReady && modalOpen ? "true" : "false";

  let style = root.getElementById("neuma-cal-close-fix");
  if (!style) {
    style = document.createElement("style");
    style.id = "neuma-cal-close-fix";
    root.appendChild(style);
  }
  style.textContent = `
      .header {
        position: absolute !important;
        float: none !important;
        top: max(10px, env(safe-area-inset-top, 0px)) !important;
        right: 10px !important;
        left: auto !important;
        z-index: 50 !important;
        margin: 0 !important;
        display: none !important;
        pointer-events: none !important;
      }
      @media (min-width: 768px) {
        .header {
          position: fixed !important;
          top: max(10px, env(safe-area-inset-top, 0px)) !important;
          right: max(10px, env(safe-area-inset-right, 0px)) !important;
          left: auto !important;
          z-index: 2147483646 !important;
        }
      }
      .header[data-neuma-visible="true"] {
        display: block !important;
        pointer-events: auto !important;
      }
      .close {
        left: 0 !important;
        position: relative !important;
        font-size: 28px !important;
        line-height: 1 !important;
        width: 44px !important;
        height: 44px !important;
        display: grid !important;
        place-items: center !important;
        border-radius: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        color: #fff !important;
        cursor: pointer !important;
        padding: 0 !important;
        transition: opacity 150ms ease !important;
      }
      .close:hover {
        opacity: 0.85 !important;
      }
    `;
}

function watchCalModalCloseButtons() {
  const scan = () => {
    document.querySelectorAll("cal-modal-box").forEach(pinCalModalCloseButton);
  };
  scan();
  const obs = new MutationObserver(scan);
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["state", "style"],
  });
  const mq = window.matchMedia("(min-width: 768px)");
  const onBreakpointChange = () => scan();
  mq.addEventListener("change", onBreakpointChange);
  return () => {
    obs.disconnect();
    mq.removeEventListener("change", onBreakpointChange);
  };
}

type CalBookButtonProps = CalLinkProps & {
  className?: string;
  label?: string;
  description?: string;
  size?: "default" | "lg";
  variant?: "default" | "secondary";
  onBookingSuccess?: (data: CalBookingSuccessData) => void | Promise<void>;
  onBookingCancelled?: (data: CalBookingCancelledData) => void | Promise<void>;
};

/**
 * Botão Cal.com element-click (data-cal-*), como no snippet oficial React.
 * Mantém listeners de sucesso para actualizar a UI após agendar.
 */
export function CalBookButton({
  calLink,
  namespace,
  eventType = "30min",
  className,
  label = "Agendar chamada",
  description,
  size = "default",
  variant = "default",
  onBookingSuccess,
  onBookingCancelled,
}: CalBookButtonProps) {
  const reactId = useId().replace(/:/g, "");
  const ns = namespace ?? eventType ?? `cal-${reactId}`;
  const resolvedLink = resolveCalLink({ calLink, eventType });
  const onSuccessRef = useRef(onBookingSuccess);
  const onCancelledRef = useRef(onBookingCancelled);
  onSuccessRef.current = onBookingSuccess;
  onCancelledRef.current = onBookingCancelled;

  useEffect(() => {
    return watchCalModalCloseButtons();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cal = await getCalApi({ namespace: ns });
        if (cancelled) return;

        cal("ui", CAL_UI);

        cal("on", {
          action: "bookingSuccessfulV2",
          callback: (e: unknown) => {
            void onSuccessRef.current?.({
              ...extractBookingData(e),
              isReschedule: false,
            });
          },
        });
        cal("on", {
          action: "rescheduleBookingSuccessfulV2",
          callback: (e: unknown) => {
            void onSuccessRef.current?.({
              ...extractBookingData(e),
              isReschedule: true,
            });
          },
        });
        // API antiga / fallback
        cal("on", {
          action: "rescheduleBookingSuccessful",
          callback: (e: unknown) => {
            void onSuccessRef.current?.({
              ...extractBookingData(e),
              isReschedule: true,
            });
          },
        });
        cal("on", {
          action: "bookingCancelled",
          callback: (e: unknown) => {
            void onCancelledRef.current?.(extractCancelledData(e));
          },
        });
      } catch (err) {
        console.error("[cal:init]", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ns]);

  const lg = size === "lg";

  return (
    <div className={cn("space-y-3", className)}>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className={cn("flex flex-wrap gap-2", lg && "flex-col")}>
        {/* data-cal-* = API oficial element-click do Cal.com */}
        <button
          type="button"
          data-cal-namespace={ns}
          data-cal-link={resolvedLink}
          data-cal-config={CAL_DATA_CONFIG}
          className={cn(
            buttonVariants({
              variant,
              size: lg ? "lg" : "default",
            }),
            "gap-2",
            lg && "h-14 w-full gap-2 text-base font-semibold",
            !lg && "w-full sm:w-auto",
          )}
        >
          <Phone className={lg ? "size-5" : "size-4"} />
          {label}
        </button>
      </div>
    </div>
  );
}

type CalEmbedProps = CalLinkProps & {
  className?: string;
  compact?: boolean;
};

/** Inline embed — preferir `CalBookButton` (modal). */
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
        const cal = await getCalApi({ namespace });
        if (cancelled) return;
        cal("ui", CAL_UI);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [namespace]);

  return (
    <div
      className={cn(
        "cal-embed-frame relative w-full overflow-hidden",
        compact && "cal-embed-frame--compact",
        className,
      )}
    >
      <Cal
        key={`${namespace}-${resolvedLink}`}
        namespace={namespace}
        calLink={resolvedLink}
        style={{ width: "100%", height: "100%", overflow: "scroll" }}
        config={{
          layout: "month_view",
          useSlotsViewOnSmallScreen: "true",
          theme: "dark",
        }}
      />
    </div>
  );
}

export function CalEmbedDisclosure({
  calLink,
  namespace = "30min",
  eventType = "30min",
  summary = "Abrir agenda Cal.com",
  id = "agendar",
}: {
  calLink?: string;
  namespace?: string;
  eventType?: string;
  summary?: string;
  id?: string;
}) {
  return (
    <details id={id} className="group scroll-mt-24">
      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
        {summary}
      </summary>
      <div className="mt-3">
        <CalBookButton
          calLink={calLink}
          namespace={namespace}
          eventType={eventType}
        />
      </div>
    </details>
  );
}
