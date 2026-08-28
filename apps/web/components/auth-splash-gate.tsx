"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { SplashScreen } from "@/components/splash-screen";
import { hasSignupFinishingCookie } from "@/lib/auth/signup-wizard";

/** Splash só na entrada inicial — não ao retomar passo 3 do signup. */
export function AuthSplashGate() {
  const pathname = usePathname();
  const [skipSplash, setSkipSplash] = useState(false);

  useEffect(() => {
    if (pathname === "/login/signup" && hasSignupFinishingCookie()) {
      setSkipSplash(true);
    }
  }, [pathname]);

  return <SplashScreen enabled={!skipSplash} />;
}
