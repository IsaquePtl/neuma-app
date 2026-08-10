"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  ExternalLink,
  Flag,
  FileText,
  MessageSquare,
  Pencil,
  Phone,
  Play,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { MentorFeedbackPanel } from "@/components/mentor-feedback-panel";
import { NodeDialog } from "@/components/node-dialog";
import { PathForm } from "@/components/path-form";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import {
  CheckInStatusBadge,
  PathStatusBadge,
} from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  activateNode,
  deleteNode,
  moveNode,
} from "@/lib/actions/nodes";
import { deletePath, setPathStatus } from "@/lib/actions/paths";
import {
  advanceLevel,
  createLevelFeedback,
  extendLevelWeek,
} from "@/lib/actions/journey-level";
import { checkInKindLabel, formatDate, formatDateTime } from "@/lib/labels";
import type { StudentNode, StudentPath } from "@/lib/students/queries";
import type { CheckInKind, CheckInStatus, NodeKind } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

export type JourneyCheckIn = {
  id: string;
  node_id: string;
  status: CheckInStatus;
  kind: CheckInKind;
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

type LevelTab = "checkin" | "feedback" | "decisao" | "editar";

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

function kindLabel(kind: NodeKind) {
  switch (kind) {
    case "call":
      return "Chamada";
    case "lesson":
    case "resource":
      return "Aula";
    case "milestone":
      return "Marco";
    default:
      return "Prática";
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
  checkIns,
  levelFeedbacks,
  libraryCategories = [],
  libraryTopics = [],
  libraryAssets = [],
}: {
  studentId: string;
  studentName: string;
  path: StudentPath;
  nodes: StudentNode[];
  checkIns: JourneyCheckIn[];
  levelFeedbacks: JourneyLevelFeedback[];
  libraryCategories?: PickerCategory[];
  libraryTopics?: PickerTopic[];
  libraryAssets?: PickerAsset[];
}) {
  const activeId = nodes.find((n) => n.status === "active")?.id ?? null;
  const [expanded, setExpanded] = useState<string | null>(activeId);
  const [tabByNode, setTabByNode] = useState<Record<string, LevelTab>>({});
  const [extendWeeksByNode, setExtendWeeksByNode] = useState<
    Record<string, number>
  >({});
  const [replyCheckInId, setReplyCheckInId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const checkInsByNode = useMemo(() => {
    const map = new Map<string, JourneyCheckIn[]>();
    for (const c of checkIns) {
      const list = map.get(c.node_id) ?? [];
      list.push(c);
      map.set(c.node_id, list);
    }
    return map;
  }, [checkIns]);

  const feedbackByNode = useMemo(() => {
    const map = new Map<string, JourneyLevelFeedback[]>();
    for (const f of levelFeedbacks) {
      const list = map.get(f.node_id) ?? [];
      list.push(f);
      map.set(f.node_id, list);
    }
    return map;
  }, [levelFeedbacks]);

  function tabFor(nodeId: string): LevelTab {
    return tabByNode[nodeId] ?? "checkin";
  }

  function setTab(nodeId: string, tab: LevelTab) {
    setTabByNode((prev) => ({ ...prev, [nodeId]: tab }));
  }

  function runAction(
    label: string,
    action: (fd: FormData) => Promise<void>,
    fields: Record<string, string>,
  ) {
    startTransition(async () => {
      try {
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.set(k, v);
        await action(fd);
        toast.success(label);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falhou");
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
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
            const tab = tabFor(node.id);
            const nodeCheckIns = checkInsByNode.get(node.id) ?? [];
            const pendingCount = nodeCheckIns.filter(
              (c) => c.status === "pending",
            ).length;
            const notes = feedbackByNode.get(node.id) ?? [];
            const replyTarget =
              replyCheckInId &&
              nodeCheckIns.find((c) => c.id === replyCheckInId);

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
                      "relative z-10 grid size-14 shrink-0 place-items-center rounded-full border-2 text-base font-semibold tabular-nums",
                      node.status === "active"
                        ? "border-transparent neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_45%,transparent)]"
                        : node.status === "completed"
                          ? "border-white/20 bg-white/10 text-foreground"
                          : "border-dashed border-white/20 bg-white/[0.03] text-muted-foreground",
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
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-2 text-left"
                    onClick={() =>
                      setExpanded((prev) =>
                        prev === node.id ? null : node.id,
                      )
                    }
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
                        <Icon className="size-3" />
                        {kindLabel(node.kind)}
                        {node.due_date
                          ? ` · limite ${formatDate(node.due_date)}`
                          : null}
                        {pendingCount > 0
                          ? ` · ${pendingCount} check-in`
                          : null}
                      </p>
                      <p className="text-lg font-semibold tracking-tight">
                        {node.title}
                      </p>
                      {node.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {node.description}
                        </p>
                      ) : null}
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-1 size-5 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {isOpen ? (
                    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            ["checkin", "Check-in", MessageSquare],
                            ["feedback", "Feedback", FileText],
                            ["decisao", "Decisão", Check],
                            ["editar", "Editar", Pencil],
                          ] as const
                        ).map(([id, label, TabIcon]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setTab(node.id, id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                              tab === id
                                ? "bg-white/15 text-foreground"
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                            )}
                          >
                            <TabIcon className="size-3.5" />
                            {label}
                            {id === "checkin" && pendingCount > 0 ? (
                              <span className="rounded-full bg-[var(--neuma-coral)] px-1.5 text-[10px] text-white">
                                {pendingCount}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>

                      {tab === "checkin" ? (
                        <div className="space-y-3">
                          {replyTarget ? (
                            <div className="space-y-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setReplyCheckInId(null)}
                              >
                                ← Voltar à lista
                              </Button>
                              <MentorFeedbackPanel
                                checkInId={replyTarget.id}
                                studentName={studentName}
                                existing={replyTarget.feedback}
                                draft={replyTarget.draft}
                                returnTo={`/studio/journeys/${path.id}`}
                              />
                            </div>
                          ) : nodeCheckIns.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Ainda sem check-ins neste nível.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {nodeCheckIns.map((c) => (
                                <li
                                  key={c.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2.5"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">
                                      {checkInKindLabel[c.kind]} ·{" "}
                                      {formatDateTime(c.created_at)}
                                    </p>
                                    {c.notes ? (
                                      <p className="line-clamp-2 text-xs text-muted-foreground">
                                        {c.notes}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <CheckInStatusBadge status={c.status} />
                                    {c.status === "pending" ||
                                    c.status === "needs_revision" ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() =>
                                          setReplyCheckInId(c.id)
                                        }
                                      >
                                        Responder
                                      </Button>
                                    ) : (
                                      <Button
                                        render={
                                          <Link
                                            href={`/studio/checkins/${c.id}?from=journey&path=${path.id}`}
                                          />
                                        }
                                        nativeButton={false}
                                        size="sm"
                                        variant="ghost"
                                      >
                                        Ver
                                      </Button>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : null}

                      {tab === "feedback" ? (
                        <div className="space-y-4">
                          <form
                            className="space-y-3"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.currentTarget;
                              const fd = new FormData(form);
                              fd.set("node_id", node.id);
                              fd.set("path_id", path.id);
                              startTransition(async () => {
                                try {
                                  await createLevelFeedback(fd);
                                  toast.success("Feedback guardado");
                                  form.reset();
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Falhou",
                                  );
                                }
                              });
                            }}
                          >
                            <div className="space-y-1.5">
                              <Label htmlFor={`notes-${node.id}`}>
                                Texto / notas
                              </Label>
                              <Textarea
                                id={`notes-${node.id}`}
                                name="notes"
                                rows={4}
                                placeholder="Feedback livre para este nível…"
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label htmlFor={`video-${node.id}`}>
                                  Link vídeo
                                </Label>
                                <Input
                                  id={`video-${node.id}`}
                                  name="video_url"
                                  type="url"
                                  placeholder="https://loom.com/…"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`file-${node.id}`}>
                                  Link ficheiro
                                </Label>
                                <Input
                                  id={`file-${node.id}`}
                                  name="file_url"
                                  type="url"
                                  placeholder="Drive, PDF, áudio…"
                                />
                              </div>
                            </div>
                            <Button type="submit" disabled={pending} size="sm">
                              {pending ? "A guardar…" : "Publicar feedback"}
                            </Button>
                          </form>

                          {notes.length > 0 ? (
                            <ul className="space-y-2 border-t border-white/10 pt-3">
                              {notes.map((n) => (
                                <li
                                  key={n.id}
                                  className="rounded-xl bg-black/20 px-3 py-2.5 text-sm"
                                >
                                  <p className="text-xs text-muted-foreground">
                                    {formatDateTime(n.created_at)}
                                  </p>
                                  {n.notes ? (
                                    <p className="mt-1 whitespace-pre-wrap">
                                      {n.notes}
                                    </p>
                                  ) : null}
                                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                                    {n.video_url ? (
                                      <a
                                        href={n.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[var(--neuma-coral)] hover:underline"
                                      >
                                        <Video className="size-3.5" /> Vídeo
                                      </a>
                                    ) : null}
                                    {n.file_url ? (
                                      <a
                                        href={n.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[var(--neuma-coral)] hover:underline"
                                      >
                                        <ExternalLink className="size-3.5" />{" "}
                                        Ficheiro
                                      </a>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}

                      {tab === "decisao" ? (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Decide o que acontece a seguir neste nível — com ou
                            sem check-in respondido.
                          </p>
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                            <Button
                              type="button"
                              className="gap-1.5"
                              disabled={pending || node.status === "completed"}
                              onClick={() =>
                                runAction(
                                  "Nível concluído — a avançar",
                                  advanceLevel,
                                  { node_id: node.id, path_id: path.id },
                                )
                              }
                            >
                              <Check className="size-4" /> Avançar nível
                            </Button>
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="space-y-1">
                                <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Prolongar
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={52}
                                    step={1}
                                    value={extendWeeksByNode[node.id] ?? 1}
                                    onChange={(e) => {
                                      const n = Number(e.target.value);
                                      setExtendWeeksByNode((prev) => ({
                                        ...prev,
                                        [node.id]: Number.isFinite(n)
                                          ? n
                                          : 1,
                                      }));
                                    }}
                                    className="h-8 w-16"
                                    aria-label="Semanas a prolongar"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    semana
                                    {(extendWeeksByNode[node.id] ?? 1) === 1
                                      ? ""
                                      : "s"}
                                  </span>
                                </span>
                              </label>
                              <Button
                                type="button"
                                variant="secondary"
                                className="gap-1.5"
                                disabled={pending}
                                onClick={() => {
                                  const weeks = Math.max(
                                    1,
                                    Math.min(
                                      52,
                                      Math.floor(
                                        extendWeeksByNode[node.id] ?? 1,
                                      ),
                                    ),
                                  );
                                  runAction(
                                    weeks === 1
                                      ? "Prazo prolongado 1 semana"
                                      : `Prazo prolongado ${weeks} semanas`,
                                    extendLevelWeek,
                                    {
                                      node_id: node.id,
                                      path_id: path.id,
                                      weeks: String(weeks),
                                    },
                                  );
                                }}
                              >
                                <Clock className="size-4" /> Prolongar prazo
                              </Button>
                            </div>
                            {node.status !== "active" ? (
                              <form action={activateNode}>
                                <input
                                  type="hidden"
                                  name="id"
                                  value={node.id}
                                />
                                <input
                                  type="hidden"
                                  name="path_id"
                                  value={path.id}
                                />
                                <Button
                                  type="submit"
                                  variant="outline"
                                  className="gap-1.5"
                                >
                                  <Play className="size-4" /> Ativar este nível
                                </Button>
                              </form>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Em check-ins pendentes podes também{" "}
                            <button
                              type="button"
                              className="underline underline-offset-2"
                              onClick={() => setTab(node.id, "checkin")}
                            >
                              responder com aprovar / pedir revisão
                            </button>
                            .
                          </p>
                        </div>
                      ) : null}

                      {tab === "editar" ? (
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
                      ) : null}
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
