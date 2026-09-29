import { redirect } from "next/navigation";

import { AuthViewport } from "@/components/auth-viewport";
import { CheckoutSuccessClient } from "@/components/checkout-success-client";
import { NeumaBackgroundWall } from "@/components/neuma-background-wall";
import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";
import Image from "next/image";

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    one_to_one?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const profile = await getCurrentProfile();
  const oneToOne = params.one_to_one === "1";

  if (oneToOne) {
    // Mesmo shell do signup — um só mark (desktop), sem logo extra no client.
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
            <CheckoutSuccessClient
              sessionId={params.session_id ?? null}
              oneToOne
              displayName={profile?.full_name ?? null}
            />
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

  return (
    <main className="neuma-app-bg flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <CheckoutSuccessClient
        sessionId={params.session_id ?? null}
        oneToOne={false}
        displayName={profile?.full_name ?? null}
      />
    </main>
  );
}
