import Image from "next/image";
import Link from "next/link";

/** Instant shell during in-app navigation — no spinner, no artificial delay. */
export default function OnboardingLoading() {
  return (
    <div className="auth-flow-instant h-full min-h-0">
      <div className="soundworks-stage absolute inset-0 z-10 flex touch-manipulation flex-col overflow-hidden overscroll-none">
        <Link
          href="/home"
          className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-20 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Ir para a app
        </Link>

        <div className="mx-auto flex h-full w-full max-w-md min-h-0 flex-col px-4 pt-[18lvh] pb-[max(1rem,env(safe-area-inset-bottom,0px))] desktop:pt-[24%]">
          <Image
            src="/brand/mark-white.png"
            alt="Neuma"
            width={80}
            height={80}
            priority
            className="mb-4 h-16 w-16 shrink-0 self-start desktop:mb-5 desktop:h-20 desktop:w-20"
          />
          <div
            aria-hidden
            className="soundworks-embed-frame min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-white/[0.04]"
          />
        </div>
      </div>
    </div>
  );
}
