"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutTemplate,
  Link2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { claimUnassignedPath } from "@/lib/actions/agent-proposals";
import { deletePath } from "@/lib/actions/paths";
import { savePathAsTemplate } from "@/lib/actions/path-templates";
import type { StudentOption } from "@/components/tally-submission-row-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

export function JourneyPathRowActions({
  path,
  students,
}: {
  path: {
    id: string;
    title: string;
    student_id: string | null;
  };
  students: StudentOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkOpen, setLinkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [studentId, setStudentId] = useState("");

  function confirmDelete() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", path.id);
        fd.set("student_id", path.student_id ?? "");
        await deletePath(fd);
        toast.success("Percurso apagado");
        setDeleteOpen(false);
        router.refresh();
      } catch {
        toast.error("Não foi possível apagar o percurso");
      }
    });
  }

  function onSaveTemplate() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("path_id", path.id);
        await savePathAsTemplate(fd);
        toast.success("Adicionado aos templates");
        router.refresh();
      } catch {
        toast.error("Não foi possível criar o template");
      }
    });
  }

  function onLinkStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      toast.error("Escolhe um aluno");
      return;
    }
    startTransition(async () => {
      try {
        await claimUnassignedPath(path.id, studentId);
        toast.success("Percurso vinculado ao aluno");
        setLinkOpen(false);
        setStudentId("");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível vincular",
        );
      }
    });
  }

  const editHref = `/studio/journeys/${path.id}/edit`;

  return (
    <>
      <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1 desktop:flex">
        <Button
          render={<Link href={editHref} />}
          nativeButton={false}
          size="sm"
          variant="ghost"
          className="gap-1"
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
        {!path.student_id ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={pending}
            onClick={() => setLinkOpen(true)}
          >
            <Link2 className="size-3.5" />
            Vincular
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1"
          disabled={pending}
          onClick={onSaveTemplate}
        >
          <LayoutTemplate className="size-3.5" />
          Template
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1 text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5" />
          Remover
        </Button>
      </div>

      <div className="flex items-center justify-end desktop:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" />}
            aria-label="Ações"
            title="Ações"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => router.push(editHref)}>
              <Pencil className="size-4" />
              Editar
            </DropdownMenuItem>
            {!path.student_id ? (
              <DropdownMenuItem
                disabled={pending}
                onClick={() => setLinkOpen(true)}
              >
                <Link2 className="size-4" />
                Vincular
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={pending} onClick={onSaveTemplate}>
              <LayoutTemplate className="size-4" />
              Template
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Remover percurso?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={confirmDelete}
            >
              {pending ? "A remover…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular a aluno</DialogTitle>
            <DialogDescription>
              Atribui “{path.title}” a um aluno e activa o primeiro nível.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onLinkStudent} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`link-student-${path.id}`}>Aluno</Label>
              <select
                id={`link-student-${path.id}`}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              >
                <option value="">Escolher…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.email ?? s.id}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || !studentId}>
                Vincular
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
