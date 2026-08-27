"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { completeSignupProfile } from "@/lib/actions/auth";
import {
  clearSignupProfileDraft,
  readSignupProfileDraft,
} from "@/lib/auth/signup-profile";

/**
 * Pós-signup (`?welcome=1`): sincroniza o draft OAuth e limpa o query —
 * sem overlay/splash; a app entra logo com o fade do shell.
 */
export function FirstVisitWelcome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shouldRun = searchParams.get("welcome") === "1";

  useEffect(() => {
    if (!shouldRun) return;

    let cancelled = false;

    async function run() {
      const draft = readSignupProfileDraft();
      if (draft) {
        const result = await completeSignupProfile(draft);
        if (result.ok) clearSignupProfileDraft();
      }
      if (cancelled) return;
      const next = new URLSearchParams(searchParams.toString());
      next.delete("welcome");
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [shouldRun, pathname, router, searchParams]);

  return null;
}
