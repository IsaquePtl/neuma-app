"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

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

export function MentorFeedbackPanel({
  checkInId,
  studentName,
  existing,
  draft,
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
}) {
  const [notes, setNotes] = useState(
    draft?.body_notes ?? existing?.notes ?? "",
  );
  const [nextSteps, setNextSteps] = useState(
    draft?.body_next_steps ?? existing?.next_steps ?? "",
  );
  const [pending, startTransition] = useTransition();
  const [showDraftBanner, setShowDraftBanner] = useState(Boolean(draft));

  function discardDraft() {
    if (!draft) return;
    startTransition(async () => {
      await rejectFeedbackDraft(draft.id);
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
            Ola — {studentName} fez check-in. Posso responder isto?
          </p>
          <p className="text-sm text-muted-foreground">
            Rascunho gerado para ti. Edita o que quiseres e envia — o aluno ve
            sempre o teu nome.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
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

          <div className="space-y-2">
            <Label htmlFor="video_url">Link do teu video de resposta</Label>
            <Input
              id="video_url"
              name="video_url"
              type="url"
              placeholder="https://loom.com/..."
              defaultValue={existing?.video_url ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas / avaliacao</Label>
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
            <Label htmlFor="next_steps">Proximos passos</Label>
            <Textarea
              id="next_steps"
              name="next_steps"
              rows={3}
              placeholder="Indicacoes concretas para a proxima etapa..."
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-3 rounded-lg border p-4">
            <input
              type="checkbox"
              name="approved"
              defaultChecked={existing?.approved ?? true}
              className="size-4 accent-[var(--neuma-coral)]"
            />
            <span className="text-sm">
              Aprovar e avancar o aluno para o bloco seguinte
            </span>
          </label>

          <Button type="submit">Enviar feedback</Button>
        </form>
      </Card>
    </div>
  );
}
