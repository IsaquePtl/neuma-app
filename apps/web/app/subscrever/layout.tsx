import Image from "next/image";

import { AuthViewport } from "@/components/auth-viewport";
import { NeumaBackgroundWall } from "@/components/neuma-background-wall";

export default function SubscribeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="auth-shell auth-flow-instant">
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
  );
}
