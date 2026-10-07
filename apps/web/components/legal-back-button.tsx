"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function LegalBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push("/login");
      }}
      aria-label="Voltar"
      className="inline-flex items-center gap-0.5 rounded-full py-1 pr-2 pl-0.5 text-sm text-muted-foreground transition-colors active:text-foreground"
    >
      <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
      Voltar
    </button>
  );
}
