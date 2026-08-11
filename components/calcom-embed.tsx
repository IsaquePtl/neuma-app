"use client";

import { useEffect, useId, useRef } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { ExternalLink, Phone } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
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

function publicCalUrl(calLink: string) {
  return `https://cal.com/${calLink.replace(/^\//, "")}`;
}

function extractBookingData(e: unknown): CalBookingSuccessData {
  const detail = (e as { detail?: { data?: CalBookingSuccessData } })?.detail;
  return detail?.data ?? {};
}

type CalBookButtonProps = CalLinkProps & {
  className?: string;
  label?: string;
  description?: string;
  showExternalLink?: boolean;
  size?: "default" | "lg";
  variant?: "default" | "secondary";
  onBookingSuccess?: (data: CalBookingSuccessData) => void | Promise<void>;
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
  showExternalLink = false,
  size = "default",
  variant = "default",
  onBookingSuccess,
}: CalBookButtonProps) {
  const reactId = useId().replace(/:/g, "");
  const ns = namespace ?? eventType ?? `cal-${reactId}`;
  const resolvedLink = resolveCalLink({ calLink, eventType });
  const fallbackHref = publicCalUrl(resolvedLink);
  const onSuccessRef = useRef(onBookingSuccess);
  onSuccessRef.current = onBookingSuccess;

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
          showExternalLink={false}
        />
      </div>
    </details>
  );
}
