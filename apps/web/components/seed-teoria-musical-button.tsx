"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { seedTeoriaMusicalTemplate } from "@/lib/actions/teoria-musical";
import { Button } from "@/components/ui/button";

/** Optional draft template. Does not touch the live library or assign students. */
export function SeedTeoriaMusicalButton() {
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
            const result = await seedTeoriaMusicalTemplate();
            toast.success(
              `Rascunho Teoria Musical: ${result.nodeCount} níveis (não activa alunos).`,
            );
            router.refresh();
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Não foi possível criar o rascunho",
            );
          }
        });
      }}
    >
      {pending ? "A criar rascunho…" : "Rascunho Teoria Musical"}
    </Button>
  );
}

/** Optional draft template. Does not touch the live library or assign students. */
export function SeedTeoriaMusicalButton() {
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
            const result = await seedTeoriaMusicalTemplate();
            toast.success(
              `Rascunho Teoria Musical: ${result.nodeCount} níveis (não activa alunos).`,
            );
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Não foi possível criar o rascunho",
            );
          }
        });
      }}
    >
      {pending ? "A criar rascunho…" : "Rascunho Teoria Musical"}
    </Button>
  );
}
