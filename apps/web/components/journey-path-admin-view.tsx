"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  ExternalLink,
  FileText,
  Lock,
  MessageSquare,
  Pencil,
  Phone,
  Play,
  Route,
  Target,
  Video,
  Dumbbell,
  Flag,
} from "lucide-react";
import { toast } from "sonner";

import { CategoryThemeIcon } from "@/components/category-theme-icon";
import { MentorFeedbackPanel } from "@/components/mentor-feedback-panel";
import type {
  JourneyCheckIn,
  JourneyLevelFeedback,
} from "@/components/journey-path-composer";
import {
  CheckInStatusBadge,
} from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  activateNode,
} from "@/lib/actions/nodes";
import {
  advanceLevel,
  createLevelFeedback,
  extendLevelWeek,
} from "@/lib/actions/journey-level";
import { checkInKindLabel, formatDate, formatDateTime, nodeKindLabel } from "@/lib/labels";
import type { StudentNode, StudentPath } from "@/lib/students/queries";
import type { NodeKind } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

type AdminPanel = "checkin" | "feedback" | "decisao" | null;

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

export function JourneyPathAdminView({
  pathId,
  studentName,
  path,
  nodes,
  checkIns,
  levelFeedbacks,
}: {
  pathId: string;
  studentName: string;
  path: StudentPath;
  nodes: StudentNode[];
  checkIns: JourneyCheckIn[];
  levelFeedbacks: JourneyLevelFeedback[];
}) {
  const [panelByNode, setPanelByNode] = useState<Record<string, AdminPanel>>({});
  const [replyCheckInId, setReplyCheckInId] = useState<string | null>(null);
  const [extendWeeksByNode, setExtendWeeksByNode] = useState<
    Record<string, number>
  >({});
  const [pending, startTransition] = useTransition();

  const activeIndex = nodes.findIndex((n) => n.status === "active");
  const completed = nodes.filter((n) => n.status === "completed").length;
  const total = nodes.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

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

  function panelFor(nodeId: string): AdminPanel {
    return panelByNode[nodeId] ?? null;
  }

  function togglePanel(nodeId: string, panel: Exclude<AdminPanel, null>) {
    setPanelByNode((prev) => ({
      ...prev,
      [nodeId]: prev[nodeId] === panel ? null : panel,
    }));
    setReplyCheckInId(null);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-3">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <CategoryThemeIcon theme={null} name={path.title} size={18} />
            <Route className="size-3.5" /> Percurso
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {path.title}
          </h1>
          {path.goal ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Target className="mt-0.5 size-4 shrink-0" />
              {path.goal}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{studentName}</p>
          <div className="flex items-center gap-3 pt-1">
            <div className="h-1 max-w-md flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="neuma-gradient h-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {completed}/{total}
            </span>
          </div>
        </div>
        <Button
          render={<Link href={`/studio/journeys/${pathId}/edit`} />}
          nativeButton={false}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda sem níveis neste percurso.{" "}
          <Link
            href={`/studio/journeys/${pathId}/edit`}
            className="text-[var(--neuma-coral)] underline-offset-4 hover:underline"
          >
            Adicionar níveis
          </Link>
        </p>
      ) : (
        <ol className="student-path-journey relative w-full list-none pl-0">
          {nodes.map((node, i) => {
            const isActive =
              node.status === "active" ||
              (activeIndex < 0 && i === 0 && node.status !== "locked");
            const isPast =
              node.status === "completed" ||
              (activeIndex >= 0 && i < activeIndex);
            const isFuture =
              !isActive &&
              !isPast &&
              (activeIndex < 0
                ? node.status === "locked"
                : i > activeIndex);
            const isLast = i === nodes.length - 1;
            const Icon = kindIcon(node.kind);
            const levelNum = i + 1;
            const panel = panelFor(node.id);
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
                className={cn(
                  "relative flex gap-4 sm:gap-5",
                  isActive ? "pb-10" : "pb-8",
                  isLast && "pb-2",
                )}
              >
                {!isLast ? (
                  <span
                    aria-hidden
                    className={cn(
                      "student-path-rail absolute bottom-0 w-px",
                      isPast || isActive ? "bg-white/15" : "bg-white/10",
                    )}
                    style={{
                      top: isActive ? "3.5rem" : "2.75rem",
                      left: isActive ? "1.7rem" : "1.35rem",
                    }}
                  />
                ) : null}

                <div className="flex flex-col items-center pt-0.5">
                  <span
                    className={cn(
                      "student-path-marker relative z-10 grid shrink-0 place-items-center rounded-full transition-transform",
                      isActive &&
                        "size-14 neuma-gradient text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]",
                      isPast &&
                        !isActive &&
                        "size-11 neuma-gradient text-white/90 opacity-45",
                      isFuture &&
                        "size-10 border-2 border-white/10 bg-white/[0.03] text-muted-foreground/50",
                    )}
                  >
                    {isFuture ? (
                      <Lock className="size-3.5 opacity-70" />
                    ) : (
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          isActive ? "text-base" : "text-sm",
                        )}
                      >
                        {levelNum}
                      </span>
                    )}
                  </span>
                </div>

                <div
                  className={cn(
                    "student-path-step min-w-0 flex-1",
                    isActive && "student-path-step--active",
                    isPast && !isActive && "student-path-step--done",
                    isFuture && "student-path-step--locked",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em]",
                          isActive
                            ? "text-[#ffffe9]"
                            : "text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3" />
                        {nodeKindLabel[node.kind]}
                        {node.week_number ? ` · Sem. ${node.week_number}` : null}
                      </span>
                      <p
                        className={cn(
                          "leading-snug",
                          isActive
                            ? "font-heading text-lg font-bold tracking-tight sm:text-xl"
                            : "font-heading font-medium",
                          isFuture && "text-muted-foreground",
                        )}
                      >
                        {node.title}
                      </p>
                      {node.due_date && !isFuture ? (
                        <p className="text-xs text-muted-foreground">
                          Até {formatDate(node.due_date)}
                        </p>
                      ) : null}
                      {isActive && node.description ? (
                        <p className="line-clamp-2 pt-0.5 text-sm text-muted-foreground">
                          {node.description}
                        </p>
                      ) : null}
                    </div>
                    {isActive ? (
                      <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white sm:size-auto sm:px-3 sm:py-1.5">
                        <Play className="size-3 fill-current" />
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {(
                      [
                        ["checkin", "Ver check-in", MessageSquare],
                        ["feedback", "Dar feedback", FileText],
                        ["decisao", "Decidir", Check],
                      ] as const
                    ).map(([id, label, TabIcon]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePanel(node.id, id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                          panel === id
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

                  {panel === "checkin" ? (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
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
                            returnTo={`/studio/journeys/${pathId}`}
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
                                    onClick={() => setReplyCheckInId(c.id)}
                                  >
                                    Responder
                                  </Button>
                                ) : (
                                  <Button
                                    render={
                                      <Link
                                        href={`/studio/checkins/${c.id}?from=journey&path=${pathId}`}
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

                  {panel === "feedback" ? (
                    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const fd = new FormData(form);
                          fd.set("node_id", node.id);
                          fd.set("path_id", pathId);
                          startTransition(async () => {
                            try {
                              await createLevelFeedback(fd);
                              toast.success("Feedback guardado");
                              form.reset();
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Falhou",
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

                  {panel === "decisao" ? (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
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
                              { node_id: node.id, path_id: pathId },
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
                                    [node.id]: Number.isFinite(n) ? n : 1,
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
                                  Math.floor(extendWeeksByNode[node.id] ?? 1),
                                ),
                              );
                              runAction(
                                weeks === 1
                                  ? "Prazo prolongado 1 semana"
                                  : `Prazo prolongado ${weeks} semanas`,
                                extendLevelWeek,
                                {
                                  node_id: node.id,
                                  path_id: pathId,
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
                            <input type="hidden" name="id" value={node.id} />
                            <input type="hidden" name="path_id" value={pathId} />
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
