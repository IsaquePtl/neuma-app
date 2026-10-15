"use client";

import { useSyncExternalStore } from "react";

import { ScreenLoader } from "@/components/screen-loader";

let hideForDrawerNav = false;
const listeners = new Set<() => void>();

/** A sidebar já mostra o spinner no item. O loading ao centro fica oculto. */
export function setDrawerNavLoading(hide: boolean) {
  if (hideForDrawerNav === hide) return;
  hideForDrawerNav = hide;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function RouteScreenLoader() {
  const hidden = useSyncExternalStore(
    subscribe,
    () => hideForDrawerNav,
    () => false,
  );
  if (hidden) return null;
  return <ScreenLoader />;
}
