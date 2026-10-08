"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { markNodeSeen } from "@/lib/actions/journey-level";
import { Button } from "@/components/ui/button";

export function MarkSeenButton({ nodeId }: { nodeId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? "A marcar como visto" : "Marcar como visto"}
      className="h-14 w-full text-base font-semibold disabled:opacity-100"
      onClick={() => {
        const formData = new FormData();
        formData.set("node_id", nodeId);
        startTransition(async () => {
          const result = await markNodeSeen(formData);
          if (result?.error) toast.error(result.error);
        });
      }}
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : (
        "Marcar como visto"
      )}
    </Button>
  );
}
