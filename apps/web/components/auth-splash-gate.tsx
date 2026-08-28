"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { SplashScreen } from "@/components/splash-screen";

/** Splash só na entrada inicial — não após OAuth para passo foto/bio. */
export function AuthSplashGate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipProfileStep =
    pathname === "/login/signup" && searchParams.get("profile") === "1";

  return <SplashScreen enabled={!skipProfileStep} />;
}
