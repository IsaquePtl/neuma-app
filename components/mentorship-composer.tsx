"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Loader2, Send, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitMentorshipMessage } from "@/lib/actions/checkins";
import { cn } from "@/lib/utils";

function SendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="icon"
      disabled={disabled || pending}
      className="rounded-full"
      aria-label="Enviar mensagem"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Send className="size-4" />
      )}
    </Button>
  );
}

export function MentorshipComposer({
  nodeId,
  disabledReason,
}: {
  nodeId: string | null;
  disabledReason?: string | null;
}) {
  const disabled = !nodeId;

  return (
    <div className="space-y-2 border-t border-white/10 bg-black/20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
      {disabledReason ? (
        <p className="px-1 text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
      <form action={submitMentorshipMessage} className="flex items-end gap-2">
        {nodeId ? <input type="hidden" name="node_id" value={nodeId} /> : null}
        <Textarea
          name="notes"
          required
          rows={2}
          disabled={disabled}
          placeholder={
            nodeId
              ? "Escreve ao mentor — dúvidas, progresso, o que sentiste…"
              : "Aguarda um bloco ativo para enviar mensagens"
          }
          className="min-h-[44px] flex-1 resize-none rounded-2xl bg-white/5"
        />
        <div className="flex shrink-0 flex-col gap-2">
          {nodeId ? (
            <Button
              render={<Link href={`/checkins/new?node=${nodeId}`} />}
              nativeButton={false}
              type="button"
              variant="secondary"
              size="icon"
              className="rounded-full"
              aria-label="Enviar check-in com vídeo"
            >
              <Video className="size-4" />
            </Button>
          ) : null}
          <SendButton disabled={disabled} />
        </div>
      </form>
      <p
        className={cn(
          "px-1 text-[11px] text-muted-foreground",
          !nodeId && "opacity-70",
        )}
      >
        Mensagens entram como check-in de texto no bloco ativo. Usa o ícone de
        vídeo para um check-in completo.
      </p>
    </div>
  );
}
