"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createForm } from "@/lib/actions/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateFormDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createForm(fd);
        // createForm redirects — keep toast for optimistic feel if slow
      } catch {
        toast.error("Nao foi possivel criar o formulario");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-2" />}>
        <Plus className="size-4" /> Novo formulario
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo formulario</DialogTitle>
          <DialogDescription>
            Cria o questionario e depois adiciona as perguntas uma a uma.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="form-title">Titulo</Label>
            <Input
              id="form-title"
              name="title"
              placeholder="Ex: Diagnostico inicial"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="form-description">Descricao</Label>
            <Textarea
              id="form-description"
              name="description"
              rows={2}
              placeholder="Contexto que o aluno ve antes de responder..."
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="is_onboarding"
              className="size-4 accent-[var(--neuma-coral)]"
            />
            Usar como formulario de onboarding
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? "A criar..." : "Criar e editar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
