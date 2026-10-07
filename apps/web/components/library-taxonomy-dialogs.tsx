"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  archiveLibraryAsset,
  createLibraryCategory,
  createLibraryTopic,
  deleteLibraryAsset,
  deleteLibraryTopic,
  deleteLibraryCategory,
  moveLibraryTopic,
  renameLibraryCategory,
  updateLibraryTopic,
} from "@/lib/actions/library";
import { LIBRARY_PATH } from "@/lib/library-routes";
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
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const searchParams = useSearchParams();
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
        if (searchParams.get("category") === category.id) {
          router.push(LIBRARY_PATH);
        } else {
          router.refresh();
        }
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
  defaultCategoryId,
  triggerSize = "default",
}: {
  categories: { id: string; name: string }[];
  defaultCategoryId?: string;
  triggerSize?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const selectedCategoryId =
    defaultCategoryId && categories.some((c) => c.id === defaultCategoryId)
      ? defaultCategoryId
      : categories[0]?.id;

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
            size={triggerSize}
            className="gap-1.5"
            disabled={categories.length === 0}
          />
        }
      >
        <FolderPlus className={triggerSize === "sm" ? "size-3.5" : "size-4"} />{" "}
        Tópico
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
              defaultValue={selectedCategoryId}
              key={selectedCategoryId ?? "topic-cat"}
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


export function LibraryTopicActions({
  topic,
  categories,
  itemCount,
  isFirst,
  isLast,
}: {
  topic: { id: string; name: string; category_id: string };
  categories: { id: string; name: string }[];
  itemCount: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", topic.id);
    startTransition(async () => {
      const result = await updateLibraryTopic(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tópico atualizado");
      setEditOpen(false);
      router.refresh();
    });
  }

  function onMove(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveLibraryTopic(topic.id, direction);
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  function onDelete() {
    const message =
      itemCount > 0
        ? `Eliminar o tópico “${topic.name}” e os ${itemCount} item(s) dentro dele?`
        : `Eliminar o tópico “${topic.name}”?`;
    if (!window.confirm(message)) return;
    const fd = new FormData();
    fd.set("id", topic.id);
    startTransition(async () => {
      try {
        await deleteLibraryTopic(fd);
        toast.success("Tópico eliminado");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao eliminar");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" disabled={pending} />}
          aria-label={`Ações do tópico ${topic.name}`}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Renomear / mover
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isFirst} onClick={() => onMove("up")}>
            <ArrowUp className="size-4" />
            Subir
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isLast} onClick={() => onMove("down")}>
            <ArrowDown className="size-4" />
            Descer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
            Eliminar tópico
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar tópico</DialogTitle>
            <DialogDescription>
              Muda o nome ou move o tópico (com os itens) para outra categoria.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`topic-rename-${topic.id}`}>Nome</Label>
              <Input
                id={`topic-rename-${topic.id}`}
                name="name"
                required
                autoFocus
                defaultValue={topic.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`topic-cat-${topic.id}`}>Categoria</Label>
              <select
                id={`topic-cat-${topic.id}`}
                name="category_id"
                defaultValue={topic.category_id}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
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

export function LibraryItemMenu({
  assetId,
  title,
}: {
  assetId: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: (fd: FormData) => Promise<void | { fileRemoved: boolean | null }>,
    success: string,
  ) {
    const fd = new FormData();
    fd.set("id", assetId);
    startTransition(async () => {
      try {
        const result = await action(fd);
        toast.success(
          result && "fileRemoved" in result && result.fileRemoved === false
            ? "Item eliminado. O ficheiro ficou na Cloudflare porque ainda está num nível."
            : success,
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" disabled={pending} />}
        aria-label={`Mais ações para ${title}`}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem
          onClick={() => run(archiveLibraryAsset, "Item arquivado")}
        >
          <Archive className="size-4" />
          Arquivar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (!window.confirm(`Eliminar “${title}” definitivamente?`)) return;
            run(deleteLibraryAsset, "Item eliminado");
          }}
        >
          <Trash2 className="size-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LibraryTopicDeleteButton({
  topicId,
  compactOnMobile = false,
}: {
  topicId: string;
  /** Icon-only below `sm`; “Eliminar” label from `sm` up. */
  compactOnMobile?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label="Eliminar tópico"
      className={cn(
        "text-destructive",
        compactOnMobile && "size-7 shrink-0 px-0 sm:h-7 sm:w-auto sm:px-2.5",
      )}
      disabled={pending}
      onClick={() => {
        if (!confirm("Eliminar este tópico e os seus assets?")) return;
        const fd = new FormData();
        fd.set("id", topicId);
        startTransition(async () => {
          try {
            await deleteLibraryTopic(fd);
            toast.success("Tópico eliminado");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha");
          }
        });
      }}
    >
      <Trash2
        className={cn("size-3.5", compactOnMobile ? "sm:hidden" : "hidden")}
      />
      <span className={cn(compactOnMobile && "hidden sm:inline")}>Eliminar</span>
    </Button>
  );
}

export function LibraryAssetDeleteButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("Eliminar definitivamente?")) return;
        const fd = new FormData();
        fd.set("id", assetId);
        startTransition(async () => {
          try {
            const result = await deleteLibraryAsset(fd);
            toast.success(
              result.fileRemoved
                ? "Asset eliminado"
                : "Item eliminado. O ficheiro ficou na Cloudflare porque ainda está num nível.",
            );
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha");
          }
        });
      }}
    >
      Eliminar
    </Button>
  );
}
