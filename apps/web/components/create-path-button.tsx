"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createDraftPath } from "@/lib/actions/paths";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CreatePathButton({
  label = "Criar Percurso",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onCreate() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("title", "Novo percurso");
        const id = await createDraftPath(fd);
        router.push(`/studio/journeys/${id}/edit?new=1`);
      } catch {
        toast.error("Não foi possível criar o percurso");
      }
    });
  }

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={onCreate}
      className={cn("h-12 gap-2 px-6 text-sm", className)}
    >
      <Plus className="size-4" />
      {pending ? "A criar…" : label}
    </Button>
  );
}
