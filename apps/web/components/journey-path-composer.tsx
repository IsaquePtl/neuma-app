"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";

import { NodeDialog } from "@/components/node-dialog";
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
  activateNode,
  deleteNode,
  moveNode,
} from "@/lib/actions/nodes";
import { deletePath, setPathStatus } from "@/lib/actions/paths";
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
  const activeId = nodes.find((n) => n.status === "active")?.id ?? null;
  const [expanded, setExpanded] = useState<string | null>(activeId);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {path.title}
              </h2>
              <PathStatusBadge status={path.status} />
            </div>
            {path.goal ? (
              <p className="text-sm text-muted-foreground">{path.goal}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {studentName}
              {path.start_date ? ` · início ${formatDate(path.start_date)}` : ""}
              {path.end_date ? ` · fim ${formatDate(path.end_date)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href={`/studio/journeys/${path.id}`} />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Ver percurso
            </Button>
            <PathForm studentId={studentId} path={path} />
            <NodeDialog
              pathId={path.id}
              categories={libraryCategories}
              topics={libraryTopics}
              assets={libraryAssets}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
          <form
            action={deletePath}
            className="ml-auto"
            onSubmit={(e) => {
              if (
                !confirm(
                  "Eliminar este percurso e todos os níveis? Sem volta.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={path.id} />
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="redirect_to" value="/studio/journeys" />
            <Button type="submit" size="sm" variant="destructive">
              Eliminar
            </Button>
          </form>
        </div>
      </div>

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
                className="relative flex gap-4 pb-8 sm:gap-5"
              >
                {i < nodes.length - 1 ? (
                  <span
                    aria-hidden
                    className="student-path-rail absolute bottom-0 left-[1.7rem] top-14 w-px bg-white/15"
                  />
                ) : null}

                <div className="flex flex-col items-center pt-0.5">
                  <span
                    className={cn(
                      "student-path-marker relative z-10 grid size-14 shrink-0 place-items-center rounded-full text-base font-semibold tabular-nums",
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
                    "student-path-step min-w-0 flex-1",
                    stepClass(node.status),
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
                        <Icon className="size-3" />
                        {nodeKindLabel[node.kind]}
                        {node.due_date
                          ? ` · limite ${formatDate(node.due_date)}`
                          : null}
                      </p>
                      <p className="text-lg font-bold tracking-tight">
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
                      onClick={() =>
                        setExpanded((prev) =>
                          prev === node.id ? null : node.id,
                        )
                      }
                    >
                      <Pencil className="size-3.5" />
                      Editar
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
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
                        <NodeDialog
                          pathId={path.id}
                          node={node}
                          categories={libraryCategories}
                          topics={libraryTopics}
                          assets={libraryAssets}
                        />
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
