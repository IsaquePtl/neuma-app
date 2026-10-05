"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Remove ?onboarding=1 da URL (ex. após submissão, quando o form já não está activo). */
export function ClearOnboardingQuery({ href }: { href: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("onboarding") === "1") {
      router.replace(href, { scroll: false });
    }
  }, [href, router, searchParams]);

  return null;
}
