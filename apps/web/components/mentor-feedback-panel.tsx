"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Check,
  Clock,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import {
  submitFeedback,
  saveCheckInFeedbackOnly,
  updateFeedback,
} from "@/lib/actions/feedbacks";
import { getMentorFeedbackVideoUploadUrl } from "@/lib/actions/r2-uploads";
import { uploadViaPresignedPut } from "@/lib/uploads/presigned-client";
import { rejectFeedbackDraft } from "@/lib/actions/ai-drafts";
import { advanceLevel, extendLevelWeek } from "@/lib/actions/journey-level";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestMentorBadgesRefresh } from "@/lib/mentor-badges-client";
import type { StudentNode } from "@/lib/students/queries";
import { cn } from "@/lib/utils";
import {
  MAX_VIDEO_BYTES,
  videoTooLargeMessage,
} from "@/lib/uploads/video-limits";

function videoLabelFromUrl(url: string): string {
  try {
    const name = new URL(url).pathname.split("/").pop() ?? "video";
    return decodeURIComponent(name);
  } catch {
    const parts = url.split("/");
    return decodeURIComponent(parts[parts.length - 1] ?? "video");
  }
}

function videoFormatFromLabel(label: string): string {
  const ext = label.split(".").pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : "VIDEO";
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function hasFeedbackContent(
  existing?: MentorFeedbackPanelProps["existing"],
): boolean {
  if (!existing) return false;
  return Boolean(
    existing.notes?.trim() ||
      existing.next_steps?.trim() ||
      existing.video_url?.trim(),
  );
}

type Draft = {
  id: string;
  body_notes: string | null;
  body_next_steps: string | null;
};

type Decision = "advance" | "extend";

export type MentorFeedbackPanelProps = {
  checkInId: string | null;
  pathId: string;
  nodeId: string;
  node: StudentNode;
  studentName: string;
  existing?: {
    video_url: string | null;
    notes: string | null;
    next_steps: string | null;
    approved: boolean;
  } | null;
  draft?: Draft | null;
  returnTo?: string;
  /** When true, omits the outer Card on desktop (for embedding inside the submission card). */
  embedded?: boolean;
};

type MentorFeedbackForm = ReturnType<typeof useMentorFeedbackForm>;

const MentorFeedbackFormContext = createContext<MentorFeedbackForm | null>(
  null,
);

function useMentorFeedbackFormContext() {
  const form = useContext(MentorFeedbackFormContext);
  if (!form) {
    throw new Error(
      "Mentor feedback components must be used within MentorFeedbackProvider",
    );
  }
  return form;
}

function useMentorFeedbackForm({
  checkInId,
  pathId,
  nodeId,
  node,
  draft,
  existing,
  returnTo,
}: Pick<
  MentorFeedbackPanelProps,
  "checkInId" | "pathId" | "nodeId" | "node" | "draft" | "existing" | "returnTo"
>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const initialVideoUrl = existing?.video_url ?? "";
  const savedFeedbackRef = useRef({
    notes: draft?.body_notes ?? existing?.notes ?? "",
    nextSteps: draft?.body_next_steps ?? existing?.next_steps ?? "",
    videoUrl: initialVideoUrl,
    videoFileLabel: initialVideoUrl ? videoLabelFromUrl(initialVideoUrl) : "",
  });
  const [notes, setNotes] = useState(
    draft?.body_notes ?? existing?.notes ?? "",
  );
  const [nextSteps, setNextSteps] = useState(
    draft?.body_next_steps ?? existing?.next_steps ?? "",
  );
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [videoFileLabel, setVideoFileLabel] = useState(() =>
    initialVideoUrl ? videoLabelFromUrl(initialVideoUrl) : "",
  );
  const [uploading, setUploading] = useState(false);
  const [decision, setDecision] = useState<Decision>("advance");
  const [extendUnit, setExtendUnit] = useState<"days" | "weeks">("weeks");
  const [extendAmount, setExtendAmount] = useState("1");
  const [pendingDiscard, startDiscard] = useTransition();
  const [pendingSubmit, startSubmit] = useTransition();
  const [pendingUpdate, startUpdate] = useTransition();
  const [showDraftBanner, setShowDraftBanner] = useState(Boolean(draft));
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const hasExistingFeedback =
    existing != null &&
    !draft &&
    (hasFeedbackContent(existing) || existing.approved);

  const canEdit = Boolean(checkInId && (hasExistingFeedback || submitted));

  const isCompleted =
    !isEditing &&
    (submitted || hasExistingFeedback);

  const extendMax = extendUnit === "days" ? 365 : 52;
  const parsedExtendAmount =
    extendAmount.trim() === "" ? NaN : Number(extendAmount);
  const isExtendAmountValid =
    Number.isFinite(parsedExtendAmount) &&
    Number.isInteger(parsedExtendAmount) &&
    parsedExtendAmount >= 1 &&
    parsedExtendAmount <= extendMax;

  function discardDraft() {
    if (!draft || !checkInId) return;
    startDiscard(async () => {
      await rejectFeedbackDraft(draft.id, checkInId);
      setShowDraftBanner(false);
      setNotes("");
      setNextSteps("");
    });
  }

  async function handleVideoFile(file: File) {
    if (!file.type.startsWith("video/")) {
      toast.error("Escolhe um ficheiro de vídeo (MP4, MOV, etc.)");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(videoTooLargeMessage());
      return;
    }
    setUploading(true);
    try {
      const presigned = await getMentorFeedbackVideoUploadUrl({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });
      const url = await uploadViaPresignedPut(file, presigned);
      setVideoUrl(url);
      setVideoFileLabel(file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  function clearVideo() {
    setVideoUrl("");
    setVideoFileLabel("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function markSubmitted() {
    savedFeedbackRef.current = {
      notes: notes.trim(),
      nextSteps: nextSteps.trim(),
      videoUrl: videoUrl.trim(),
      videoFileLabel: videoFileLabel.trim(),
    };
    setSubmitted(true);
    setShowDraftBanner(false);
    setIsEditing(false);
    toast.success("Feedback enviado com sucesso");
  }

  function startEditing() {
    savedFeedbackRef.current = { notes, nextSteps, videoUrl, videoFileLabel };
    setIsEditing(true);
  }

  function cancelEditing() {
    const saved = savedFeedbackRef.current;
    setNotes(saved.notes);
    setNextSteps(saved.nextSteps);
    setVideoUrl(saved.videoUrl);
    setVideoFileLabel(saved.videoFileLabel);
    setIsEditing(false);
  }

  function handleUpdate() {
    if (!checkInId) return;
    startUpdate(async () => {
      try {
        const fd = new FormData();
        fd.set("check_in_id", checkInId);
        fd.set("video_url", videoUrl.trim());
        fd.set("notes", notes.trim());
        fd.set("next_steps", nextSteps.trim());
        await updateFeedback(fd);
        savedFeedbackRef.current = {
          notes: notes.trim(),
          nextSteps: nextSteps.trim(),
          videoUrl: videoUrl.trim(),
          videoFileLabel: videoFileLabel.trim(),
        };
        setIsEditing(false);
        toast.success("Alterações guardadas");
        requestMentorBadgesRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falhou");
      }
    });
  }

  function handleSubmit() {
    startSubmit(async () => {
      try {
        if (decision === "advance") {
          if (checkInId) {
            const fd = new FormData();
            fd.set("check_in_id", checkInId);
            if (draft) fd.set("draft_id", draft.id);
            if (returnTo) fd.set("return_to", returnTo);
            fd.set("approved", "on");
            fd.set("video_url", videoUrl.trim());
            fd.set("notes", notes.trim());
            fd.set("next_steps", nextSteps.trim());
            await submitFeedback(fd);
            markSubmitted();
          } else {
            const fd = new FormData();
            fd.set("node_id", nodeId);
            fd.set("path_id", pathId);
            await advanceLevel(fd);
            markSubmitted();
          }
        } else {
          if (!isExtendAmountValid) {
            toast.error("Indica uma duração válida (mínimo 1)");
            return;
          }
          const amount = parsedExtendAmount;
          const fd = new FormData();
          fd.set("node_id", nodeId);
          fd.set("path_id", pathId);
          fd.set("unit", extendUnit);
          fd.set("amount", String(amount));
          await extendLevelWeek(fd);

          if (
            checkInId &&
            (notes.trim() || nextSteps.trim() || videoUrl.trim())
          ) {
            const feedbackFd = new FormData();
            feedbackFd.set("check_in_id", checkInId);
            if (draft) feedbackFd.set("draft_id", draft.id);
            feedbackFd.set("video_url", videoUrl.trim());
            feedbackFd.set("notes", notes.trim());
            feedbackFd.set("next_steps", nextSteps.trim());
            await saveCheckInFeedbackOnly(feedbackFd);
          }

          markSubmitted();
        }
        requestMentorBadgesRefresh();
      } catch (err) {
        if (isRedirectError(err)) {
          markSubmitted();
          throw err;
        }
        toast.error(err instanceof Error ? err.message : "Falhou");
      }
    });
  }

  return {
    fileRef,
    notes,
    setNotes,
    nextSteps,
    setNextSteps,
    videoUrl,
    videoFileLabel,
    uploading,
    decision,
    setDecision,
    extendUnit,
    setExtendUnit,
    extendAmount,
    setExtendAmount,
    pendingDiscard,
    pendingSubmit,
    pendingUpdate,
    showDraftBanner,
    draft,
    discardDraft,
    handleVideoFile,
    clearVideo,
    handleSubmit,
    handleUpdate,
    startEditing,
    cancelEditing,
    isExtendAmountValid,
    isCompleted,
    isEditing,
    canEdit,
    node,
    checkInId,
  };
}

export function MentorFeedbackProvider({
  studentName,
  children,
  ...formProps
}: MentorFeedbackPanelProps & { children: React.ReactNode }) {
  const form = useMentorFeedbackForm(formProps);

  return (
    <MentorFeedbackFormContext.Provider value={form}>
      <MentorFeedbackDraftBanner studentName={studentName} />
      {children}
    </MentorFeedbackFormContext.Provider>
  );
}

function MentorFeedbackCompleted({
  showTitle = true,
  className,
}: {
  showTitle?: boolean;
  className?: string;
}) {
  const form = useMentorFeedbackFormContext();

  return (
    <div className={cn("space-y-3", className)}>
      {showTitle ? (
        <h2 className="text-lg font-semibold">O teu feedback</h2>
      ) : null}
      <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-400">
            <Check className="size-4 shrink-0" />
            Feedback enviado com sucesso
          </p>
          {form.canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={form.startEditing}
            >
              <Pencil />
              Editar feedback
            </Button>
          ) : null}
        </div>
        {form.videoUrl ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Video className="size-3.5 text-[var(--neuma-coral)]" />
            Vídeo incluído
          </p>
        ) : null}
        {form.notes.trim() ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Feedback
            </p>
            <p className="whitespace-pre-wrap text-sm">{form.notes.trim()}</p>
          </div>
        ) : null}
        {form.nextSteps.trim() ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Próximos passos
            </p>
            <p className="whitespace-pre-wrap text-sm">
              {form.nextSteps.trim()}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MentorFeedbackDraftBanner({ studentName }: { studentName: string }) {
  const form = useMentorFeedbackFormContext();

  if (form.isCompleted || !form.showDraftBanner || !form.draft) return null;

  return (
    <Card className="space-y-3 border-[var(--neuma-coral)]/30 p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-[var(--neuma-coral)]" />
        Olá — {studentName} fez check-in. Posso responder isto?
      </p>
      <p className="text-sm text-muted-foreground">
        Rascunho gerado para ti. Edita o que quiseres e envia — o aluno vê
        sempre o teu nome.
      </p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={form.pendingDiscard}
        onClick={form.discardDraft}
      >
        Descartar e escrever do zero
      </Button>
    </Card>
  );
}

export function MentorFeedbackFields({
  showTitle = true,
  className,
}: {
  showTitle?: boolean;
  className?: string;
}) {
  const form = useMentorFeedbackFormContext();

  if (form.isCompleted) {
    return <MentorFeedbackCompleted showTitle={showTitle} className={className} />;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showTitle ? (
        <h2 className="text-lg font-semibold">O teu feedback</h2>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Upload vídeo (opcional)</Label>
          <input
            ref={form.fileRef}
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void form.handleVideoFile(file);
              e.target.value = "";
            }}
          />
          <div className="w-full">
            {form.videoUrl && !form.uploading ? (
              <div className="flex h-11 w-full items-stretch overflow-hidden rounded-lg border border-border bg-background dark:border-input dark:bg-input/30">
                <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-sm">
                  <Video className="size-4 shrink-0 text-[var(--neuma-coral)]" />
                  <span className="truncate font-medium">
                    {form.videoFileLabel || videoLabelFromUrl(form.videoUrl)}
                  </span>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {videoFormatFromLabel(
                      form.videoFileLabel || videoLabelFromUrl(form.videoUrl),
                    )}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-none border-l border-border dark:border-input"
                  disabled={form.pendingSubmit}
                  aria-label="Remover vídeo"
                  onClick={form.clearVideo}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-center gap-1.5"
                disabled={form.uploading || form.pendingSubmit}
                onClick={() => form.fileRef.current?.click()}
              >
                {form.uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {form.uploading ? "A carregar…" : "Escolher vídeo"}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Feedback</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={5}
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="next_steps">Próximos passos</Label>
          <Textarea
            id="next_steps"
            name="next_steps"
            rows={3}
            value={form.nextSteps}
            onChange={(e) => form.setNextSteps(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export function MentorDecisionAndSubmit({ className }: { className?: string }) {
  const form = useMentorFeedbackFormContext();

  if (form.isCompleted || form.isEditing) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-3">
        <p className="text-sm font-medium">Decisão</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => form.setDecision("advance")}
            className={cn(
              "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
              form.decision === "advance"
                ? "border-[#cece13]/50 bg-[#cece13]/10"
                : "border-white/10 bg-black/20 hover:bg-white/5",
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <Check className="size-4 text-[#cece13]" />
              Avançar nível
            </span>
          </button>
          <button
            type="button"
            onClick={() => form.setDecision("extend")}
            className={cn(
              "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
              form.decision === "extend"
                ? "border-[var(--neuma-coral)]/50 bg-[var(--neuma-coral)]/10"
                : "border-white/10 bg-black/20 hover:bg-white/5",
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <Clock className="size-4 text-[var(--neuma-coral)]" />
              Prolongar prazo
            </span>
          </button>
        </div>

        {form.decision === "extend" ? (
          <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/20 p-4">
            <Label htmlFor="extend-amount">Duração</Label>
            <div className="flex items-center gap-3">
              <Input
                id="extend-amount"
                type="number"
                min={1}
                max={form.extendUnit === "days" ? 365 : 52}
                step={1}
                value={form.extendAmount}
                onChange={(e) => form.setExtendAmount(e.target.value)}
                className="h-9 w-20 shrink-0 border-white/10 bg-black/30"
              />
              <div
                className="ml-auto inline-flex h-9 shrink-0 items-stretch overflow-hidden rounded-lg border border-white/10 bg-black/30"
                role="group"
                aria-label="Unidade de duração"
              >
                <button
                  type="button"
                  onClick={() => form.setExtendUnit("days")}
                  className={cn(
                    "px-3 text-xs font-medium transition-colors",
                    form.extendUnit === "days"
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  Dias
                </button>
                <button
                  type="button"
                  onClick={() => form.setExtendUnit("weeks")}
                  className={cn(
                    "px-3 text-xs font-medium transition-colors",
                    form.extendUnit === "weeks"
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  Semanas
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="pt-1">
        <Button
          type="button"
          disabled={
            form.pendingSubmit ||
            form.uploading ||
            (form.decision === "advance" && form.node.status === "completed") ||
            (form.decision === "extend" && !form.isExtendAmountValid)
          }
          className="h-11 w-full gap-2 py-3 text-base"
          onClick={form.handleSubmit}
        >
          {form.pendingSubmit ? (
            <Loader2 className="size-4 animate-spin" />
          ) : form.decision === "advance" ? (
            <Check className="size-4" />
          ) : (
            <Clock className="size-4" />
          )}
          {form.pendingSubmit
            ? "A guardar…"
            : form.decision === "advance"
              ? "Submeter Feedback"
              : "Enviar Feedback"}
        </Button>
      </div>
    </div>
  );
}

export function MentorFeedbackEditActions({ className }: { className?: string }) {
  const form = useMentorFeedbackFormContext();

  if (!form.isEditing) return null;

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:justify-end", className)}>
      <Button
        type="button"
        variant="ghost"
        disabled={form.pendingUpdate}
        onClick={form.cancelEditing}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        disabled={form.pendingUpdate || form.uploading}
        className="gap-2"
        onClick={form.handleUpdate}
      >
        {form.pendingUpdate ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        {form.pendingUpdate ? "A guardar…" : "Guardar alterações"}
      </Button>
    </div>
  );
}

/** Decision/submit or edit actions for portrait desktop layout. */
export function MentorFeedbackPortraitActions({
  className,
}: {
  className?: string;
}) {
  const form = useMentorFeedbackFormContext();

  if (form.isCompleted) return null;
  if (form.isEditing) {
    return <MentorFeedbackEditActions className={className} />;
  }
  return <MentorDecisionAndSubmit className={className} />;
}

/** Stacked feedback fields + decision (landscape desktop embedded, or mobile card). */
export function MentorFeedbackStacked({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const form = useMentorFeedbackFormContext();

  return (
    <div
      className={cn(
        "neuma-accent-top space-y-5",
        embedded
          ? "glass overflow-hidden rounded-2xl p-6 desktop:rounded-none desktop:border-0 desktop:bg-transparent desktop:p-0 desktop:shadow-none desktop:backdrop-blur-none"
          : "glass overflow-hidden rounded-2xl p-6",
      )}
    >
      {form.isCompleted ? (
        <MentorFeedbackCompleted />
      ) : form.isEditing ? (
        <>
          <MentorFeedbackFields />
          <MentorFeedbackEditActions className="border-t border-white/10 pt-4" />
        </>
      ) : (
        <>
          <MentorFeedbackFields />
          <MentorDecisionAndSubmit className="border-t border-white/10 pt-4" />
        </>
      )}
    </div>
  );
}

export function MentorFeedbackPanel({
  embedded = false,
  studentName,
  ...formProps
}: MentorFeedbackPanelProps) {
  return (
    <MentorFeedbackProvider studentName={studentName} {...formProps}>
      <div className="space-y-4">
        <MentorFeedbackStacked embedded={embedded} />
      </div>
    </MentorFeedbackProvider>
  );
}
