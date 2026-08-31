"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Upload, Video } from "lucide-react";
import { toast } from "sonner";

import { submitCheckIn } from "@/lib/actions/checkins";
import { getCheckInVideoUploadUrl } from "@/lib/actions/r2-uploads";
import { uploadViaPresignedPut } from "@/lib/uploads/presigned-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MB,
  videoTooLargeMessage,
} from "@/lib/uploads/video-limits";
const TOTAL_STEPS = 3;

export const CHECKIN_CONFIDENCE_OPTIONS = [
  {
    value: "confident",
    letter: "A",
    title: "Confiante",
    description: "Dominei o conceito e quero avançar",
  },
  {
    value: "progress",
    letter: "B",
    title: "Em progresso",
    description: "Consegui executar, mas ainda preciso de ajustes",
  },
  {
    value: "blocked",
    letter: "C",
    title: "Bloqueado",
    description: "Tive dificuldade e preciso de ajuda específica nesta parte",
  },
] as const;

export type CheckInConfidence =
  (typeof CHECKIN_CONFIDENCE_OPTIONS)[number]["value"];

export function CheckInForm({
  nodeId,
}: {
  nodeId?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [difficultyNotes, setDifficultyNotes] = useState("");
  const [confidence, setConfidence] = useState<CheckInConfidence | "">("");
  const [dragOver, setDragOver] = useState(false);

  async function uploadVideo(file: File) {
    if (!file.type.startsWith("video/")) {
      toast.error("Escolhe um ficheiro de vídeo (MP4, MOV, etc.)");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(videoTooLargeMessage());
      return;
    }

    setUploading(true);
    setFileLabel(file.name);
    try {
      const presigned = await getCheckInVideoUploadUrl({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });
      const url = await uploadViaPresignedPut(file, presigned);
      setVideoUrl(url);
    } catch (e) {
      setFileLabel(null);
      setVideoUrl("");
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  function onPickFile(file: File | null) {
    if (file) void uploadVideo(file);
  }

  function goNext() {
    if (step === 1) {
      if (!videoUrl || uploading) {
        toast.error("Submete o teu vídeo antes de continuar");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!difficultyNotes.trim()) {
        toast.error("Descreve como correu antes de continuar");
        return;
      }
      setStep(3);
    }
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSend() {
    if (step !== TOTAL_STEPS) return;

    if (!videoUrl) {
      toast.error("Submete o teu vídeo antes de enviar");
      setStep(1);
      return;
    }
    if (!difficultyNotes.trim()) {
      toast.error("Descreve como correu");
      setStep(2);
      return;
    }
    if (!confidence) {
      toast.error("Escolhe como te sentes neste nível");
      return;
    }

    const fd = new FormData();
    fd.set("video_url", videoUrl);
    fd.set("kind", "video");
    fd.set("confidence", confidence);
    fd.set("difficulty_notes", difficultyNotes.trim());
    if (nodeId) fd.set("node_id", nodeId);

    startTransition(async () => {
      try {
        await submitCheckIn(fd);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível enviar",
        );
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Never advance or submit via implicit Enter / form submit —
    // only "Enviar check-in" (button click) should send.
    e.preventDefault();
  }

  const videoReady = Boolean(videoUrl) && !uploading;
  const canAdvanceStep1 = videoReady && !uploading;
  const canAdvanceStep2 = difficultyNotes.trim().length > 0;
  const canAdvance =
    (step === 1 && canAdvanceStep1) || (step === 2 && canAdvanceStep2);
  const canSubmit = Boolean(confidence) && !pending && !uploading;

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      {step === 1 ? (
        <section className="space-y-3">
          <div className="flex h-8 shrink-0 items-center" />
          <h2 className="text-base font-semibold leading-snug sm:text-lg">
            <span className="desktop:hidden">Submete o teu vídeo aqui:</span>
            <span className="hidden desktop:inline">
              Mostra-me como correu. Submete o teu vídeo aqui:
            </span>
          </h2>

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploading && inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!uploading) inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onPickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "glass group relative flex min-h-[11rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-all",
              dragOver
                ? "border-[var(--neuma-coral)]/45 bg-[var(--neuma-coral)]/8"
                : videoReady
                  ? "border-emerald-500/35 bg-emerald-500/5"
                  : "border-white/12 bg-white/[0.03] hover:border-white/22 hover:bg-white/[0.05]",
              uploading && "pointer-events-none opacity-80",
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="size-9 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium">A enviar vídeo…</p>
                {fileLabel ? (
                  <p className="max-w-full truncate text-xs text-muted-foreground">
                    {fileLabel}
                  </p>
                ) : null}
              </>
            ) : videoReady ? (
              <>
                <span className="grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Check className="size-6" strokeWidth={2.5} />
                </span>
                <p className="text-sm font-medium">Vídeo pronto</p>
                {fileLabel ? (
                  <p className="max-w-full truncate text-xs text-muted-foreground">
                    {fileLabel}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Clica para substituir o ficheiro
                </p>
              </>
            ) : (
              <>
                <span className="grid size-12 place-items-center rounded-full bg-white/8 text-muted-foreground transition-colors group-hover:bg-white/12 group-hover:text-foreground">
                  <Upload className="size-6" />
                </span>
                <p className="text-sm font-medium">
                  Arrasta o vídeo ou clica para escolher
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Video className="size-3.5" />
                  MP4, MOV · até {MAX_VIDEO_MB} MB
                </p>
              </>
            )}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-3">
          <div className="flex h-8 shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Anterior"
              disabled={pending || uploading}
              onClick={goBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold leading-snug sm:text-lg">
            Como correu? Onde sentiste mais dificuldade?
          </h2>
          <Textarea
            value={difficultyNotes}
            onChange={(e) => setDifficultyNotes(e.target.value)}
            rows={5}
            autoFocus
            placeholder="Descreve o que praticaste, o que correu bem e onde sentiste mais resistência…"
            className="min-h-[8rem] resize-none rounded-2xl border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-white/20 focus-visible:ring-0"
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-3">
          <div className="flex h-8 shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Anterior"
              disabled={pending || uploading}
              onClick={goBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold leading-snug sm:text-lg">
            Como te sentes em relação a este nível?
          </h2>
          <div className="grid gap-2.5 sm:gap-3">
            {CHECKIN_CONFIDENCE_OPTIONS.map((opt) => {
              const selected = confidence === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all",
                    selected
                      ? "border-white/22 bg-white/[0.08]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.06]",
                  )}
                >
                  <input
                    type="radio"
                    name="confidence"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setConfidence(opt.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
                      selected
                        ? "bg-white/20 text-foreground"
                        : "bg-white/10 text-muted-foreground",
                    )}
                  >
                    {opt.letter}
                  </span>
                  <span className="min-w-0 space-y-0.5 pt-0.5">
                    <span className="block text-sm font-semibold">
                      {opt.title}
                    </span>
                    <span className="block text-sm leading-snug text-muted-foreground">
                      {opt.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-2">
        {step < TOTAL_STEPS ? (
          <Button
            type="button"
            size="lg"
            variant="secondary"
            disabled={
              (step === 1 && !canAdvanceStep1) ||
              (step === 2 && !canAdvanceStep2)
            }
            onClick={goNext}
            className={cn(
              "h-11 w-full gap-2 rounded-2xl border text-sm font-medium shadow-none",
              canAdvance
                ? "border-white/22 bg-white/18 text-foreground hover:bg-white/[0.24] hover:text-foreground"
                : "border-white/8 bg-white/[0.06] text-muted-foreground/70 hover:bg-white/[0.06] hover:text-muted-foreground/70",
            )}
          >
            Seguinte
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            disabled={!canSubmit}
            onClick={handleSend}
            className="h-12 w-full gap-2 rounded-2xl text-base font-semibold"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                A enviar…
              </>
            ) : (
              "Enviar check-in"
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
