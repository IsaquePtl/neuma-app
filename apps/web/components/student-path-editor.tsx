"use client";

import { Fragment } from "react";
import {
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Play,
  Target,
  Trash2,
} from "lucide-react";

import { CreatePathButton } from "@/components/create-path-button";
import { PathForm } from "@/components/path-form";
import { NodeDialog } from "@/components/node-dialog";
import {
  ApplyTemplateDialog,
  type ReadyTemplate,
} from "@/components/apply-template-dialog";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import {
  NodeKindBadge,
  NodeStatusBadge,
} from "@/components/status-badges";
import { PathStatusMenu } from "@/components/path-status-menu";
import { activateNode, deleteNode, moveNode } from "@/lib/actions/nodes";
import { deletePath } from "@/lib/actions/paths";
import { formatDate, phaseKeyLabel } from "@/lib/labels";
import {
  normalizePhaseKey,
  phaseOptions,
  planPhaseAwareMove,
  resolvePhaseCheckpointIds,
} from "@/lib/nodes/phases";
import type { StudentNode, StudentPath } from "@/lib/students/queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export function StudentPathEditor({
  studentId,
  path,
  nodes,
  embedded = false,
  readyTemplates = [],
  libraryCategories = [],
  libraryTopics = [],
  libraryAssets = [],
}: {
  studentId: string;
  path: StudentPath | null;
  nodes: StudentNode[];
  embedded?: boolean;
  readyTemplates?: ReadyTemplate[];
  libraryCategories?: PickerCategory[];
  libraryTopics?: PickerTopic[];
  libraryAssets?: PickerAsset[];
}) {
  const phases = phaseOptions(nodes);
  const checkpointIds = resolvePhaseCheckpointIds(nodes);
  return (
    <div className="space-y-4">
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Percurso</h2>
          {path ? (
            <PathForm studentId={studentId} path={path} />
          ) : (
            <CreatePathButton
              studentId={studentId}
              label="Criar percurso"
              size="sm"
              className="gap-2"
            />
          )}
        </div>
      ) : (
        <div className="flex justify-end">
          {path ? (
            <PathForm studentId={studentId} path={path} />
          ) : (
            <CreatePathButton
              studentId={studentId}
              label="Criar percurso"
              size="sm"
              className="gap-2"
            />
          )}
        </div>
      )}

      {!path ? (
        <Card className="space-y-4 p-8 text-center">
          <p className="text-muted-foreground">
            Ainda não há percurso. Aplica um template ou cria um plano vazio.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ApplyTemplateDialog
              studentId={studentId}
              templates={readyTemplates}
            />
            <CreatePathButton
              studentId={studentId}
              label="Criar percurso"
              size="sm"
              className="gap-2"
            />
          </div>
          {readyTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem templates prontos.{" "}
              <Link
                href="/studio/journeys#drafts"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Criar em Percursos
              </Link>
            </p>
          ) : null}
        </Card>
      ) : (
        <>
          <Card className="neuma-accent-top space-y-4 p-5">
            <div className="min-w-0 space-y-2">
              <h3 className="text-xl font-semibold">{path.title}</h3>
              {path.start_date ? (
                <p className="text-sm text-muted-foreground">
                  início {formatDate(path.start_date)}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <PathStatusMenu
                  pathId={path.id}
                  studentId={studentId}
                  status={path.status}
                />
                <form
                  action={deletePath}
                  onSubmit={(e) => {
                    if (
                      !confirm(
                        "Eliminar este percurso e todos os blocos? Esta ação não tem volta.",
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={path.id} />
                  <input type="hidden" name="student_id" value={studentId} />
                  <Button type="submit" size="sm" variant="destructive">
                    <Trash2 className="size-3.5" />
                    Eliminar
                  </Button>
                </form>
              </div>
              {path.description ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {path.description}
                </p>
              ) : null}
              {path.goal ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Target className="mt-0.5 size-4 shrink-0" />
                  {path.goal}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {path.duration_label ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarRange className="size-3.5" />
                  {path.duration_label}
                </span>
              ) : null}
              {path.end_date ? (
                <span>Fim {formatDate(path.end_date)}</span>
              ) : null}
            </div>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">
              Blocos{" "}
              <span className="text-muted-foreground">({nodes.length})</span>
            </h3>
            <NodeDialog
              pathId={path.id}
              categories={libraryCategories}
              topics={libraryTopics}
              assets={libraryAssets}
              phases={phases}
            />
          </div>

          {nodes.length === 0 ? (
            <Card className="space-y-3 p-8 text-center">
              <p className="text-muted-foreground">
                Ainda sem níveis. Cria o primeiro bloco do percurso.
              </p>
              <div className="flex justify-center">
                <NodeDialog
                  pathId={path.id}
                  categories={libraryCategories}
                  topics={libraryTopics}
                  assets={libraryAssets}
                />
              </div>
            </Card>
          ) : (
            <ol className="space-y-3">
              {nodes.map((node, i) => {
                const key = normalizePhaseKey(node.phase_key);
                const phase = key ? phases.find((p) => p.key === key) : undefined;
                const isPhaseStart =
                  Boolean(key) && (i === 0 || normalizePhaseKey(nodes[i - 1].phase_key) !== key);
                const isPhaseCheckpoint = checkpointIds.has(node.id);
                const canMoveUp = planPhaseAwareMove(nodes, node.id, "up") !== null;
                const canMoveDown = planPhaseAwareMove(nodes, node.id, "down") !== null;
                return (
                <Fragment key={node.id}>
                  {isPhaseStart ? (
                    <li className="list-none pt-2 first:pt-0">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {phaseKeyLabel(key)}
                        {phase ? (
                          <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">
                            {phase.count} {phase.count === 1 ? "nível" : "níveis"} ·{" "}
                            {phase.checkpoint ? "com check-point de fase" : "sem check-point de fase"}
                          </span>
                        ) : null}
                      </p>
                    </li>
                  ) : null}
                <li>
                  <Card className="space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/8 text-sm font-semibold tabular-nums">
                        {node.week_number ?? i + 1}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-medium">{node.title}</p>
                          <NodeStatusBadge status={node.status} />
                          <NodeKindBadge kind={node.kind} />
                          {isPhaseCheckpoint ? (
                            <span className="rounded-full border border-[var(--neuma-coral)]/40 bg-[var(--neuma-coral)]/10 px-2 py-0.5 text-[11px] text-[var(--neuma-coral)]">
                              Fecha a {phaseKeyLabel(key)}
                            </span>
                          ) : null}
                        </div>
                        {node.description ? (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {node.description}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {node.due_date ? (
                            <span>Limite {formatDate(node.due_date)}</span>
                          ) : null}
                          {node.resource_url ? (
                            <a
                              href={node.resource_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              Recurso
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1 border-t border-white/5 pt-2">
                      {node.status !== "active" ? (
                        <form action={activateNode}>
                          <input type="hidden" name="id" value={node.id} />
                          <input type="hidden" name="path_id" value={path.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                          >
                            <Play className="size-3.5" /> Ativar
                          </Button>
                        </form>
                      ) : null}
                      <form action={moveNode}>
                        <input type="hidden" name="id" value={node.id} />
                        <input type="hidden" name="path_id" value={path.id} />
                        <input type="hidden" name="direction" value="up" />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          disabled={!canMoveUp}
                          aria-label="Subir"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                      </form>
                      <form action={moveNode}>
                        <input type="hidden" name="id" value={node.id} />
                        <input type="hidden" name="path_id" value={path.id} />
                        <input type="hidden" name="direction" value="down" />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          disabled={!canMoveDown}
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
                        phases={phases}
                      />
                      <form action={deleteNode}>
                        <input type="hidden" name="id" value={node.id} />
                        <input type="hidden" name="path_id" value={path.id} />
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
                  </Card>
                </li>
                </Fragment>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
