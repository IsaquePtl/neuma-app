import Image from "next/image";

import { SplashScreen } from "@/components/splash-screen";
import { AuthViewport } from "@/components/auth-viewport";
import { NeumaBackgroundWall } from "@/components/neuma-background-wall";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SplashScreen />
      <div className="auth-shell">
        <div className="auth-shell-panel auth-shell-panel--form">
          <AuthViewport scrollable>
            <Image
              src="/brand/mark-white.png"
              alt="Neuma"
              width={80}
              height={80}
              priority
              className="auth-shell-form-mark hidden desktop:block"
            />
            {children}
          </AuthViewport>
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
