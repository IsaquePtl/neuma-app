"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { seedQaAnaPath } from "@/lib/actions/qa-path";
import { Button } from "@/components/ui/button";

/** QA only. Creates Ana Ribeiro path. Does not activate Eduardo/Márcio/Bernardo. */
export function SeedQaAnaPathButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await seedQaAnaPath(false);
            toast.success(
              `QA Ana: ${result.nodeCount} níveis (path ${result.reused ? "reutilizado" : "criado"}).`,
            );
            router.refresh();
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Não foi possível criar o percurso QA",
            );
          }
        });
      }}
    >
      {pending ? "A criar QA Ana…" : "Seed QA Ana Ribeiro"}
    </Button>
  );
}
