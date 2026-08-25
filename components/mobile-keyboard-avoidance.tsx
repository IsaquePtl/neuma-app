"use client";

import { useEffect } from "react";

const GAP_PX = 20;

function isTextField(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = ((el as HTMLInputElement).type || "text").toLowerCase();
  return ![
    "button",
    "submit",
    "reset",
    "checkbox",
    "radio",
    "file",
    "hidden",
    "image",
    "range",
    "color",
  ].includes(type);
}

/**
 * Só mexe na camada UI (`[data-neuma-ui]`).
 * Zero transform, zero padding animado, zero CSS vars — o fundo não salta.
 */
export function MobileKeyboardAvoidance() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    let t1 = 0;
    let t2 = 0;

    const ui = () =>
      document.querySelector<HTMLElement>("[data-neuma-ui]");

    const ensure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Soundworks: página sem scroll — não mexer no shell
        if (document.querySelector(".auth-shell--soundworks")) return;

        const active = document.activeElement;
        if (!isTextField(active)) return;
        const shell = ui();
        if (!shell) return;

        const rect = active.getBoundingClientRect();
        const visibleBottom = vv.offsetTop + vv.height - GAP_PX;
        const visibleTop = vv.offsetTop + GAP_PX;

        if (rect.bottom > visibleBottom) {
          shell.scrollTop += rect.bottom - visibleBottom;
        } else if (rect.top < visibleTop) {
          shell.scrollTop -= visibleTop - rect.top;
        }
      });
    };

    const schedule = () => {
      ensure();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      t1 = window.setTimeout(ensure, 280);
      t2 = window.setTimeout(ensure, 480);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isTextField(e.target as Element)) schedule();
    };

    document.addEventListener("focusin", onFocusIn);
    vv.addEventListener("resize", () => {
      if (isTextField(document.activeElement)) ensure();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  return null;
}
