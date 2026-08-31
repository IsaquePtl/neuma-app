"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/** Matches Neuma `desktop:` / mobile menubar breakpoint. */
const DESKTOP_MQ = "(min-width: 850px)"

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_MQ)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_MQ).matches
}

function getServerDesktopSnapshot() {
  return true
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  )

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={isDesktop ? "bottom-right" : "bottom-center"}
      /* Sonner writes --offset-* / --mobile-offset-* as inline styles; CSS
       * alone cannot raise toasts. Use a token so globals can lift above the
       * floating menubar (≤849px) while desktop/auth keep Sonner defaults. */
      offset={{ bottom: "var(--neuma-toast-bottom, 24px)" }}
      mobileOffset={{ bottom: "var(--neuma-toast-bottom, 16px)" }}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
