"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, RotateCcw, Sparkles } from "lucide-react";

import { submitFeedback } from "@/lib/actions/feedbacks";
import { rejectFeedbackDraft } from "@/lib/actions/ai-drafts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  id: string;
  body_notes: string | null;
  body_next_steps: string | null;
};

function SubmitButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2 pt-1">
      <Button
        type="submit"
        name="approved"
        value="on"
        disabled={pending}
        className="gap-2"
      >
        <Check className="size-4" />
        {pending ? "A enviar…" : "Aprovar e avançar nível"}
      </Button>
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        className="gap-2"
      >
        <RotateCcw className="size-4" /> Pedir revisão
      </Button>
      <p className="text-xs text-muted-foreground">
        Pedir revisão mantém o aluno no mesmo bloco.
      </p>
    </div>
  );
}

export function MentorFeedbackPanel({
  checkInId,
  studentName,
  existing,
  draft,
  returnTo,
}: {
  checkInId: string;
  studentName: string;
  existing?: {
    video_url: string | null;
    notes: string | null;
    next_steps: string | null;
    approved: boolean;
  } | null;
  draft?: Draft | null;
  returnTo?: string;
}) {
  const [notes, setNotes] = useState(
    draft?.body_notes ?? existing?.notes ?? "",
  );
  const [nextSteps, setNextSteps] = useState(
    draft?.body_next_steps ?? existing?.next_steps ?? "",
  );
  const [pendingDiscard, startTransition] = useTransition();
  const [showDraftBanner, setShowDraftBanner] = useState(Boolean(draft));

  function discardDraft() {
    if (!draft) return;
    startTransition(async () => {
      await rejectFeedbackDraft(draft.id, checkInId);
      setShowDraftBanner(false);
      setNotes("");
      setNextSteps("");
    });
  }

  return (
    <div className="space-y-4">
      {showDraftBanner && draft ? (
        <Card className="space-y-3 border-[var(--neuma-coral)]/30 p-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-[var(--neuma-coral)]" />
            Olá — {studentName} fez check-in. Posso responder isto?
          </p>
          <p className="text-sm text-muted-foreground">
            Rascunho gerado para ti. Edita o que quiseres e envia — o aluno vê
            sempre o teu nome.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pendingDiscard}
              onClick={discardDraft}
            >
              Descartar e escrever do zero
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="neuma-accent-top space-y-4 p-6">
        <h2 className="text-lg font-semibold">O teu feedback</h2>
        <form action={submitFeedback} className="space-y-4">
          <input type="hidden" name="check_in_id" value={checkInId} />
          {draft ? <input type="hidden" name="draft_id" value={draft.id} /> : null}
          {returnTo ? (
            <input type="hidden" name="return_to" value={returnTo} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="video_url">Link do teu vídeo de resposta</Label>
            <Input
              id="video_url"
              name="video_url"
              type="url"
              placeholder="https://loom.com/..."
              defaultValue={existing?.video_url ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas / avaliação</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={5}
              placeholder="O que correu bem, o que ajustar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_steps">Próximos passos</Label>
            <Textarea
              id="next_steps"
              name="next_steps"
              rows={3}
              placeholder="Indicações concretas para a próxima etapa..."
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
            />
          </div>

          <SubmitButtons />
        </form>
      </Card>
    </div>
  );
}
