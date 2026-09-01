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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto my-auto flex w-full max-w-md flex-col">
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
              className="soundworks-embed-frame min-h-[12rem] w-full overflow-hidden rounded-xl bg-white/[0.04]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
