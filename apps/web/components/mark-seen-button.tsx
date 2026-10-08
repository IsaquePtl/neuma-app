"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function MarkSeenButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? "A marcar como visto" : undefined}
      className="h-14 w-full text-base font-semibold disabled:opacity-100"
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : (
        "Marcar como visto"
      )}
    </Button>
  );
}
