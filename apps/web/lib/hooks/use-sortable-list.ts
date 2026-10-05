"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const INTERACTIVE =
  "button, a, input, textarea, select, label, [role='button'], [role='menuitem'], [contenteditable='true'], [data-no-drag]";
const MOUSE_THRESHOLD = 6;
const TOUCH_HOLD_MS = 260;
const TOUCH_SLOP = 8;
const EDGE = 72;
const MAX_SCROLL_SPEED = 18;

export type SortableDragState = {
  id: string;
  fromIndex: number;
  /** Final index of the dragged item if dropped now. */
  toIndex: number;
  dy: number;
  /** Drop line position, relative to the list element. */
  indicatorTop: number;
};

type Session = {
  id: string;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  lastY: number;
  startScroll: number;
  active: boolean;
  holdTimer: number | null;
  scroller: HTMLElement;
  /** Document-space (scroller content) geometry captured on activation. */
  rest: Array<{ top: number; bottom: number; mid: number }>;
  listTop: number;
  fromIndex: number;
  raf: number | null;
  state: SortableDragState | null;
};

function scrollParent(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

function scrollerTop(scroller: HTMLElement): number {
  return scroller === document.scrollingElement
    ? 0
    : scroller.getBoundingClientRect().top;
}

/**
 * Press-and-drag reordering for a vertical list. Mouse drags after a small
 * move; touch needs a short hold so normal scrolling keeps working.
 */
export function useSortableList({
  ids,
  canDrag,
  onDrop,
  disabled = false,
}: {
  ids: string[];
  canDrag: (id: string) => boolean;
  onDrop: (id: string, toIndex: number) => void;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState<SortableDragState | null>(null);
  const items = useRef(new Map<string, HTMLElement>());
  const listRef = useRef<HTMLElement | null>(null);
  const session = useRef<Session | null>(null);
  const latest = useRef({ ids, onDrop });
  useEffect(() => {
    latest.current = { ids, onDrop };
  });

  const itemRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) items.current.set(id, el);
      else items.current.delete(id);
    },
    [],
  );

  const teardown = useRef<() => void>(() => {});

  const update = useCallback((clientY: number) => {
    const s = session.current;
    if (!s?.active) return;
    s.lastY = clientY;
    const scroll = s.scroller.scrollTop;
    const pointer = clientY - scrollerTop(s.scroller) + scroll;
    let toIndex = 0;
    for (const r of s.rest) if (pointer > r.mid) toIndex += 1;
    const indicator =
      s.rest.length === 0
        ? 0
        : toIndex < s.rest.length
          ? s.rest[toIndex].top
          : s.rest[s.rest.length - 1].bottom;
    s.state = {
      id: s.id,
      fromIndex: s.fromIndex,
      toIndex,
      dy: clientY - s.startY + (scroll - s.startScroll),
      indicatorTop: indicator - s.listTop,
    };
    setDrag(s.state);
  }, []);

  const autoScroll = useCallback(() => {
    const tick = () => {
      const s = session.current;
      if (!s?.active) return;
      const viewTop = scrollerTop(s.scroller);
      const viewBottom =
        s.scroller === document.scrollingElement
          ? window.innerHeight
          : s.scroller.getBoundingClientRect().bottom;
      let speed = 0;
      if (s.lastY < viewTop + EDGE) {
        speed = -MAX_SCROLL_SPEED * Math.min(1, (viewTop + EDGE - s.lastY) / EDGE);
      } else if (s.lastY > viewBottom - EDGE) {
        speed = MAX_SCROLL_SPEED * Math.min(1, (s.lastY - (viewBottom - EDGE)) / EDGE);
      }
      if (speed !== 0) {
        s.scroller.scrollTop += speed;
        update(s.lastY);
      }
      s.raf = requestAnimationFrame(tick);
    };
    tick();
  }, [update]);

  const activate = useCallback(() => {
    const s = session.current;
    const list = listRef.current;
    if (!s || s.active || !list) return;
    const order = latest.current.ids;
    const fromIndex = order.indexOf(s.id);
    if (fromIndex < 0) return;
    const scroll = s.scroller.scrollTop;
    const offset = scrollerTop(s.scroller);
    s.rest = order
      .filter((id) => id !== s.id)
      .map((id) => {
        const rect = items.current.get(id)?.getBoundingClientRect();
        const top = (rect?.top ?? 0) - offset + scroll;
        const bottom = (rect?.bottom ?? 0) - offset + scroll;
        return { top, bottom, mid: (top + bottom) / 2 };
      });
    s.listTop = list.getBoundingClientRect().top - offset + scroll;
    s.startScroll = scroll;
    s.fromIndex = fromIndex;
    s.active = true;
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    if (s.pointerType !== "mouse") navigator.vibrate?.(8);
    update(s.lastY);
    autoScroll();
  }, [autoScroll, update]);

  const onPointerDown = useCallback(
    (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || session.current || e.button !== 0 || !e.isPrimary) return;
      if (!canDrag(id)) return;
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;

      const el = items.current.get(id);
      if (!el) return;
      const s: Session = {
        id,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
        lastY: e.clientY,
        startScroll: 0,
        active: false,
        holdTimer: null,
        scroller: scrollParent(el),
        rest: [],
        listTop: 0,
        fromIndex: -1,
        raf: null,
        state: null,
      };
      session.current = s;

      const isMouse = e.pointerType === "mouse";
      if (!isMouse) s.holdTimer = window.setTimeout(activate, TOUCH_HOLD_MS);

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== s.pointerId) return;
        const dist = Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY);
        if (!s.active) {
          if (isMouse && dist > MOUSE_THRESHOLD) activate();
          else if (!isMouse && dist > TOUCH_SLOP) {
            finish(false);
            return;
          }
          if (!s.active) return;
        }
        ev.preventDefault();
        update(ev.clientY);
      };
      const blockTouchScroll = (ev: TouchEvent) => {
        if (s.active) ev.preventDefault();
      };
      const blockContextMenu = (ev: Event) => {
        if (s.active || s.holdTimer != null) ev.preventDefault();
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") finish(false);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== s.pointerId) return;
        finish(ev.type === "pointerup");
      };

      const finish = (commit: boolean) => {
        if (s.holdTimer != null) window.clearTimeout(s.holdTimer);
        s.holdTimer = null;
        if (s.raf != null) cancelAnimationFrame(s.raf);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("touchmove", blockTouchScroll);
        window.removeEventListener("contextmenu", blockContextMenu);
        window.removeEventListener("keydown", onKey);
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";

        const wasActive = s.active;
        const last = s.state;
        session.current = null;
        teardown.current = () => {};
        setDrag(null);
        if (wasActive && commit && last && last.toIndex !== last.fromIndex) {
          latest.current.onDrop(last.id, last.toIndex);
        }
        if (wasActive) {
          // Swallow the click that follows a drag so buttons/links don't fire.
          const swallow = (ev: MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
          };
          window.addEventListener("click", swallow, { capture: true, once: true });
          window.setTimeout(
            () => window.removeEventListener("click", swallow, { capture: true }),
            0,
          );
        }
      };

      teardown.current = () => finish(false);
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("touchmove", blockTouchScroll, { passive: false });
      window.addEventListener("contextmenu", blockContextMenu);
      window.addEventListener("keydown", onKey);
    },
    [activate, canDrag, disabled, update],
  );

  useEffect(() => () => teardown.current(), []);

  const setList = useCallback((el: HTMLElement | null) => {
    listRef.current = el;
  }, []);

  return { drag, listRef: setList, itemRef, onPointerDown };
}
