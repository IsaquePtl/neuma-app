"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useCallback, type ComponentProps } from "react";

const warmed = new Set<string>();

export function warmHref(router: ReturnType<typeof useRouter>, href: string) {
  if (warmed.has(href)) return;
  warmed.add(href);
  void router.prefetch(href, { kind: PrefetchKind.FULL });
}

type IntentLinkProps = ComponentProps<typeof Link>;

/** Full prefetch on pointer intent. Viewport prefetch stays off so a list does not fetch every row. */
export function IntentLink({
  href,
  onPointerEnter,
  onFocus,
  prefetch = false,
  ...props
}: IntentLinkProps) {
  const router = useRouter();
  const warm = useCallback(() => {
    const target =
      typeof href === "string"
        ? href
        : href.pathname
          ? `${href.pathname}${href.search ?? ""}${href.hash ?? ""}`
          : null;
    if (!target) return;
    warmHref(router, target);
  }, [href, router]);

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      onPointerEnter={(event) => {
        warm();
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        warm();
        onFocus?.(event);
      }}
    />
  );
}
