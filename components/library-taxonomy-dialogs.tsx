"use client";

import { useState, useTransition } from "react";
import { FolderPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createLibraryCategory,
  createLibraryTopic,
  deleteLibraryCategory,
  renameLibraryCategory,
} from "@/lib/actions/library";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CategoryThemePicker,
} from "@/components/category-theme-icon";
import type { CategoryTheme } from "@/lib/brand-themes";

export function LibraryCategoryDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createLibraryCategory(fd);
        toast.success("Categoria criada");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao criar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="gap-2" />}>
        <FolderPlus className="size-4" /> Categoria
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <DialogDescription>
            Ex.: Teclado, Setup & Produção Musical, Harmonia.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nome</Label>
            <Input id="cat-name" name="name" required autoFocus />
          </div>
          <CategoryThemePicker />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "A criar..." : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LibraryCategoryActions({
  category,
}: {
  category: {
    id: string;
    name: string;
    slug?: string | null;
    theme?: CategoryTheme | null;
  };
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", category.id);
    startTransition(async () => {
      try {
        await renameLibraryCategory(fd);
        toast.success("Categoria atualizada");
        setEditOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível guardar",
        );
      }
    });
  }

  function onDelete() {
    if (
      !window.confirm(
        `Apagar a categoria “${category.name}”? Os tópicos desta categoria também serão removidos.`,
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "Confirma que queres apagar de forma permanente? Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", category.id);
        await deleteLibraryCategory(fd);
        toast.success("Categoria apagada");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível apagar",
        );
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label="Ações da categoria"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
            Apagar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
            <DialogDescription>Altera o nome e o tema visual.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`cat-rename-${category.id}`}>Nome</Label>
              <Input
                id={`cat-rename-${category.id}`}
                name="name"
                required
                autoFocus
                defaultValue={category.name}
              />
            </div>
            <CategoryThemePicker value={category.theme ?? null} />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "A guardar…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LibraryTopicDialog({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createLibraryTopic(fd);
        toast.success("Tópico criado");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao criar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="gap-2"
            disabled={categories.length === 0}
          />
        }
      >
        <FolderPlus className="size-4" /> Tópico
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo tópico</DialogTitle>
          <DialogDescription>
            Dentro de uma categoria — ex.: Acordes, Escalas, Groove.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic-cat">Categoria</Label>
            <select
              id="topic-cat"
              name="category_id"
              required
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-name">Nome</Label>
            <Input id="topic-name" name="name" required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "A criar..." : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
