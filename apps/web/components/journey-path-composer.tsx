"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";

import { NodeDialog, NodeEditorForm } from "@/components/node-dialog";
import { PathForm } from "@/components/path-form";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import {
  PathStatusBadge,
} from "@/components/status-badges";
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
  activateNode,
  deleteNode,
  moveNode,
} from "@/lib/actions/nodes";
import { deletePath, setPathStatus } from "@/lib/actions/paths";
import { useJourneyEditDirty } from "@/lib/journey-path/edit-dirty-context";
import { formatDate, nodeKindLabel } from "@/lib/labels";
import type { StudentNode, StudentPath } from "@/lib/students/queries";
import type { NodeKind } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import {
  Dumbbell,
  Flag,
  Phone,
  Video,
} from "lucide-react";

function kindIcon(kind: NodeKind) {
  switch (kind) {
    case "call":
      return Phone;
    case "lesson":
    case "resource":
      return Video;
    case "milestone":
      return Flag;
    default:
      return Dumbbell;
  }
}

function stepClass(status: StudentNode["status"]) {
  if (status === "active") return "student-path-step--active";
  if (status === "completed") return "student-path-step--done";
  return "student-path-step--locked";
}

export function JourneyPathComposer({
  studentId,
  studentName,
  path,
  nodes,
  libraryCategories = [],
  libraryTopics = [],
  libraryAssets = [],
}: {
  studentId: string;
  studentName: string;
  path: StudentPath;
  nodes: StudentNode[];
  libraryCategories?: PickerCategory[];
  libraryTopics?: PickerTopic[];
  libraryAssets?: PickerAsset[];
}) {
  const router = useRouter();
  const { isDirty, save: savePathChanges, pending: savePending } =
    useJourneyEditDirty();
  const activeId = nodes.find((n) => n.status === "active")?.id ?? null;
  const [expanded, setExpanded] = useState<string | null>(activeId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();

  function confirmDelete() {
    startDeleteTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", path.id);
        fd.set("student_id", studentId);
        await deletePath(fd);
        toast.success("Percurso eliminado");
        setDeleteOpen(false);
        router.push("/studio/journeys");
      } catch {
        toast.error("Não foi possível eliminar o percurso");
      }
    });
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 max-w-full break-words text-xl font-bold tracking-tight sm:text-2xl">
                {path.title}
              </h2>
              <PathStatusBadge status={path.status} />
              {isDirty ? (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  disabled={savePending}
                  onClick={savePathChanges}
                >
                  {savePending ? "A guardar…" : "Guardar"}
                </Button>
              ) : null}
            </div>
            {path.goal ? (
              <p className="text-sm text-muted-foreground break-words">
                {path.goal}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground break-words">
              {studentName}
              {path.start_date ? ` · início ${formatDate(path.start_date)}` : ""}
              {path.end_date ? ` · fim ${formatDate(path.end_date)}` : ""}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button
              render={<Link href={`/studio/journeys/${path.id}`} />}
              nativeButton={false}
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 sm:flex-none"
            >
              Ver percurso
            </Button>
            <PathForm
              studentId={studentId}
              path={path}
              triggerClassName="min-w-0 flex-1 gap-2 sm:flex-none"
            />
            <NodeDialog
              pathId={path.id}
              categories={libraryCategories}
              topics={libraryTopics}
              assets={libraryAssets}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {(
            [
              ["draft", "Rascunho"],
              ["active", "Ativar"],
              ["paused", "Pausar"],
              ["completed", "Concluir"],
            ] as const
          ).map(([status, label]) => (
            <form key={status} action={setPathStatus}>
              <input type="hidden" name="id" value={path.id} />
              <input type="hidden" name="student_id" value={studentId} />
              <input type="hidden" name="status" value={status} />
              <Button
                type="submit"
                size="sm"
                variant={path.status === status ? "default" : "outline"}
                disabled={path.status === status}
              >
                {label}
              </Button>
            </form>
          ))}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="sm:ml-auto"
            onClick={() => setDeleteOpen(true)}
          >
            Eliminar
          </Button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={!deletePending}>
          <DialogHeader>
            <DialogTitle>Eliminar percurso?</DialogTitle>
            <DialogDescription>
              Este percurso e todos os níveis serão apagados permanentemente.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletePending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={confirmDelete}
            >
              {deletePending ? "A eliminar…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-muted-foreground">
          Ainda sem níveis. Adiciona o primeiro bloco.
        </div>
      ) : (
        <ol className="student-path-journey relative list-none pl-0">
          {nodes.map((node, i) => {
            const Icon = kindIcon(node.kind);
            const levelNum = i + 1;
            const isOpen = expanded === node.id;

            return (
              <li
                key={node.id}
                className="relative flex min-w-0 gap-3 pb-8 sm:gap-5"
              >
                {i < nodes.length - 1 ? (
                  <span
                    aria-hidden
                    className="student-path-rail absolute bottom-0 left-[1.45rem] top-12 w-px bg-white/15 sm:left-[1.7rem] sm:top-14"
                  />
                ) : null}

                <div className="flex flex-col items-center pt-0.5">
                  <span
                    className={cn(
                      "student-path-marker relative z-10 grid size-12 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums sm:size-14 sm:text-base",
                      node.status === "active"
                        ? "neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_45%,transparent)]"
                        : node.status === "completed"
                          ? "border-2 border-white/20 bg-white/10 text-foreground"
                          : "border-2 border-dashed border-white/20 bg-white/[0.03] text-muted-foreground",
                    )}
                  >
                    {levelNum}
                  </span>
                </div>

                <div
                  className={cn(
                    "student-path-step min-w-0 flex-1 overflow-hidden",
                    stepClass(node.status),
                  )}
                >
                  <div className="flex w-full min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="inline-flex max-w-full flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
                        <Icon className="size-3 shrink-0" />
                        <span className="min-w-0 break-words">
                          {nodeKindLabel[node.kind]}
                          {node.due_date
                            ? ` · limite ${formatDate(node.due_date)}`
                            : null}
                        </span>
                      </p>
                      <p className="break-words text-base font-bold tracking-tight sm:text-lg">
                        {node.title}
                      </p>
                      {node.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {node.description}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isOpen ? "default" : "outline"}
                      className="shrink-0 gap-1.5"
                      aria-label={isOpen ? "Fechar edição" : "Editar nível"}
                      onClick={() =>
                        setExpanded((prev) =>
                          prev === node.id ? null : node.id,
                        )
                      }
                    >
                      <Pencil className="size-3.5" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                  </div>

                  {isOpen ? (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                      <div className="flex flex-wrap items-center gap-1">
                        <form action={moveNode}>
                          <input type="hidden" name="id" value={node.id} />
                          <input
                            type="hidden"
                            name="path_id"
                            value={path.id}
                          />
                          <input type="hidden" name="direction" value="up" />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            disabled={i === 0}
                            aria-label="Subir"
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                        </form>
                        <form action={moveNode}>
                          <input type="hidden" name="id" value={node.id} />
                          <input
                            type="hidden"
                            name="path_id"
                            value={path.id}
                          />
                          <input
                            type="hidden"
                            name="direction"
                            value="down"
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            disabled={i === nodes.length - 1}
                            aria-label="Descer"
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </form>
                        {node.status !== "active" ? (
                          <form action={activateNode}>
                            <input type="hidden" name="id" value={node.id} />
                            <input
                              type="hidden"
                              name="path_id"
                              value={path.id}
                            />
                            <Button type="submit" variant="outline" size="sm">
                              Ativar nível
                            </Button>
                          </form>
                        ) : null}
                        <form action={deleteNode}>
                          <input type="hidden" name="id" value={node.id} />
                          <input
                            type="hidden"
                            name="path_id"
                            value={path.id}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      </div>

                      <NodeEditorForm
                        key={node.id}
                        pathId={path.id}
                        node={node}
                        categories={libraryCategories}
                        topics={libraryTopics}
                        assets={libraryAssets}
                        inline
                        idPrefix={node.id}
                        onSuccess={() => setExpanded(null)}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// Types shared with admin view and data loader
export type JourneyCheckIn = {
  id: string;
  node_id: string;
  status: import("@/lib/types/database.types").CheckInStatus;
  kind: import("@/lib/types/database.types").CheckInKind;
  created_at: string;
  notes: string | null;
  video_url: string | null;
  feedback: {
    notes: string | null;
    next_steps: string | null;
    video_url: string | null;
    approved: boolean;
  } | null;
  draft: {
    id: string;
    body_notes: string | null;
    body_next_steps: string | null;
  } | null;
};

export type JourneyLevelFeedback = {
  id: string;
  node_id: string;
  notes: string | null;
  video_url: string | null;
  file_url: string | null;
  created_at: string;
};
