import Image from "next/image";
import Link from "next/link";

import { LegalBackButton } from "@/components/legal-back-button";

export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="legal-shell absolute inset-0 z-10 flex flex-col overflow-hidden bg-[#161616] text-foreground">
      <div className="legal-back shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <LegalBackButton />
      </div>
      <div className="legal-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl px-5 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
          <Link href="/login" className="mb-10 inline-flex items-center gap-3">
            <Image
              src="/brand/mark-white.png"
              alt="Neuma"
              width={36}
              height={36}
            />
            <span className="text-sm font-medium text-muted-foreground">
              Comunidade Neuma
            </span>
          </Link>
          <article className="space-y-5 text-sm leading-relaxed text-muted-foreground [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-foreground [&_h2]:pt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            {children}
          </article>
          <nav className="mt-12 flex gap-5 border-t border-white/10 pt-6 text-xs text-muted-foreground">
            <Link href="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Entrar
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
