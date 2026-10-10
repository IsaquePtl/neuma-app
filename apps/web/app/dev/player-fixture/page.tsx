import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MediaVideoPlayer } from "@/components/media-video-player";

export const metadata: Metadata = {
  title: "Player fixture",
  robots: { index: false, follow: false },
};

/**
 * Unauthenticated harness for the custom player.
 * Hidden on Vercel (production and preview); available for local tests.
 */
export default function PlayerFixturePage() {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production" || vercelEnv === "preview") notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <MediaVideoPlayer
        url="/dev/player-fixture.webm"
        title="Vídeo de teste"
        size="full"
      />
    </main>
  );
}
