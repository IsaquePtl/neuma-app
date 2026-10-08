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
      className="ml-0.5 grid size-12 place-items-center rounded-full text-foreground transition-colors active:bg-white/10"
    >
      <ChevronLeft className="size-8" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
