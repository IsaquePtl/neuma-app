"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { SplashScreen } from "@/components/splash-screen";
import { hasSignupFinishingCookie } from "@/lib/auth/signup-wizard";
import { isOneToOneInvitePath } from "@/lib/one-to-one/invite-path";

/** Splash só na entrada inicial — não ao retomar signup ou convite 1:1. */
export function AuthSplashGate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [skipSplash, setSkipSplash] = useState(false);

  useEffect(() => {
    if (pathname === "/login/signup" && hasSignupFinishingCookie()) {
      setSkipSplash(true);
      return;
    }
    if (
      isOneToOneInvitePath(pathname) &&
      (searchParams.get("cancelado") === "1" ||
        searchParams.get("perfil") === "1")
    ) {
      setSkipSplash(true);
    }
  }, [pathname, searchParams]);

  return <SplashScreen enabled={!skipSplash} />;
}
