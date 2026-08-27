import type { Metadata } from "next";
import Image from "next/image";

import { SplashScreen } from "@/components/splash-screen";
import { NeumaBackgroundWall } from "@/components/neuma-background-wall";

export const metadata: Metadata = {
  title: "Onboarding Neuma 1:1",
  description: "Onboarding Neuma 1:1 — conhece-nos e começa o teu percurso.",
};

export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SplashScreen />
      <div className="auth-shell auth-shell--soundworks">
        <div className="auth-shell-panel auth-shell-panel--form relative min-h-0 overflow-hidden">
          {children}
        </div>
        <div className="auth-shell-panel auth-shell-panel--visual hidden desktop:block">
          <NeumaBackgroundWall className="!absolute !inset-0 !h-full !w-full" />
          <div aria-hidden className="auth-shell-visual-wordmark">
            <Image
              src="/brand/wordmark-white.png"
              alt=""
              width={220}
              height={103}
              priority
            />
          </div>
        </div>
      </div>
    </>
  );
}
