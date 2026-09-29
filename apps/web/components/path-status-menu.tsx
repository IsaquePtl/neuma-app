"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setPathStatus } from "@/lib/actions/paths";
import { pathStatusLabel } from "@/lib/labels";
import type { PathStatus } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

const STATUS_ACTIONS: { status: PathStatus; label: string }[] = [
  { status: "draft", label: "Rascunho" },
  { status: "active", label: "Ativar" },
  { status: "paused", label: "Pausar" },
  { status: "completed", label: "Concluir" },
];

export function PathStatusMenu({
  pathId,
  studentId,
  status,
  className,
}: {
  pathId: string;
  studentId: string;
  status: PathStatus;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(next: PathStatus) {
    if (next === status) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", pathId);
        fd.set("student_id", studentId);
        fd.set("status", next);
        await setPathStatus(fd);
        toast.success(`Estado: ${pathStatusLabel[next]}`);
        router.refresh();
      } catch {
        toast.error("Não foi possível alterar o estado");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className={cn(
              "h-11 min-w-[11rem] justify-between gap-2 px-4 text-sm font-semibold",
              className,
            )}
          />
        }
      >
        <span>{pending ? "A atualizar…" : pathStatusLabel[status]}</span>
        <ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[11rem]">
        {STATUS_ACTIONS.map((item) => (
          <DropdownMenuItem
            key={item.status}
            disabled={pending || item.status === status}
            onClick={() => changeStatus(item.status)}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
