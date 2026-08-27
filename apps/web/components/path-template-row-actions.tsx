"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deletePathTemplate } from "@/lib/actions/path-templates";
import { LinkTemplateToStudentDialog } from "@/components/link-template-to-student-dialog";
import type { StudentOption } from "@/components/tally-submission-row-actions";
import { Button } from "@/components/ui/button";

export type PathTemplateRow = {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_label: string | null;
};

export function PathTemplateRowActions({
  template,
  students,
}: {
  template: PathTemplateRow;
  students: StudentOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkOpen, setLinkOpen] = useState(false);

  function onDelete() {
    if (
      !window.confirm(
        `Apagar o template “${template.title}”? Deixa de aparecer na lista.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", template.id);
        fd.set("redirect", "0");
        await deletePathTemplate(fd);
        toast.success("Template apagado");
        router.refresh();
      } catch {
        toast.error("Não foi possível apagar o template");
      }
    });
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Button
          render={<Link href={`/studio/paths?compose=${template.id}`} />}
          nativeButton={false}
          size="sm"
          variant="ghost"
          className="gap-1"
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
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
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1 text-destructive hover:text-destructive"
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
          Apagar
        </Button>
      </div>

      <LinkTemplateToStudentDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        template={template}
        students={students}
      />
    </>
  );
}
