"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  OAUTH_SHEET_CHANNEL,
  OAUTH_SHEET_WINDOW,
  safeOauthNext,
} from "@/lib/auth/oauth-sheet";

function SheetReturnInner() {
  const params = useSearchParams();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const next = safeOauthNext(params.get("next")) ?? "/";
    const namedSheet = window.name === OAUTH_SHEET_WINDOW;
    let hasOpener = false;
    try {
      hasOpener = !!window.opener && window.opener !== window;
    } catch {
      hasOpener = true;
    }

    // O iOS, na app instalada, devolve o callback à janela da Neuma.
    // Aí não há sheet para fechar: segue para o destino.
    if (!namedSheet && !hasOpener) {
      window.location.replace(next);
      return;
    }

    try {
      const channel = new BroadcastChannel(OAUTH_SHEET_CHANNEL);
      channel.postMessage({ next });
      channel.close();
    } catch {
      // BroadcastChannel pode falhar em webviews antigas.
    }

    try {
      if (hasOpener) window.opener.location.assign(next);
    } catch {
      // O opener pode ter sido cortado pelo Google. O canal trata disso.
    }

    window.close();
    const timer = window.setTimeout(() => setStuck(true), 1200);
    return () => window.clearTimeout(timer);
  }, [params]);

  return (
    <main className="grid min-h-[100lvh] place-items-center bg-[#161616] px-6 text-center text-white">
      <p className="text-sm text-white/80">
        {stuck
          ? "Já podes fechar esta janela e voltar à Neuma."
          : "A entrar na Neuma…"}
      </p>
    </main>
  );
}

export default function SheetReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[100lvh] place-items-center bg-[#161616]" />
      }
    >
      <SheetReturnInner />
    </Suspense>
  );
}
