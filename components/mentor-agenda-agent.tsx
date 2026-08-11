"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  confirmCheckInNudges,
  generateMentorAgendaBriefing,
  type MentorAgentBriefing,
  type MentorAgentSuggestion,
} from "@/lib/actions/mentor-agent";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScreenLoader } from "@/components/screen-loader";
import { cn } from "@/lib/utils";

const PRIORITY_DOT: Record<MentorAgentSuggestion["priority"], string> = {
  high: "bg-[var(--neuma-coral)]",
  medium: "bg-amber-400",
  low: "bg-white/30",
};

const KIND_LABEL: Record<MentorAgentSuggestion["kind"], string> = {
  call_prep: "Preparar call",
  checkin_nudge: "Lembrete",
  review: "Avaliar",
  insight: "Insight",
  other: "Sugestão",
};

export function MentorAgendaAgent() {
  const [data, setData] = useState<MentorAgentBriefing | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [acting, startActing] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const result = await generateMentorAgendaBriefing();
        setData(result);
        setDismissed(new Set());
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível gerar o briefing",
        );
      }
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  async function copyBody(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function runNudge(item: MentorAgentSuggestion, index: number) {
    if (
      !confirm(
        `Enviar lembrete de check-in por email a ${item.studentIds.length} aluno(s)? Nada é enviado sem confirmares.`,
      )
    ) {
      return;
    }
    startActing(async () => {
      try {
        const { sent } = await confirmCheckInNudges(item.studentIds);
        toast.success(
          sent > 0
            ? `Lembrete enviado a ${sent} aluno(s)`
            : "Nenhum email enviado (sem emails válidos)",
        );
        setDismissed((prev) => new Set(prev).add(index));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha no envio");
      }
    });
  }

  const visible =
    data?.items.filter((_, i) => !dismissed.has(i)) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-[var(--neuma-coral)]" /> Agenda
          </h2>
          <p className="text-sm text-muted-foreground">
            Agent do mentor — sugere, tu confirmas.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5"
          disabled={pending}
          onClick={load}
        >
          <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
          {pending ? "A pensar…" : "Actualizar"}
        </Button>
      </div>

      {pending && !data ? (
        <ScreenLoader className="min-h-[10rem]" />
      ) : null}

      {data ? (
        <div className="space-y-3">
          <Card className="space-y-2 border-[var(--neuma-coral)]/20 bg-gradient-to-br from-[var(--neuma-coral)]/10 to-transparent p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Briefing
              </p>
              <p className="text-[10px] text-muted-foreground">
                {data.local ? "modo local · custo 0" : data.source}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {data.briefing}
            </p>
          </Card>

          {visible.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Sem mais sugestões neste momento. Actualiza mais tarde.
            </Card>
          ) : (
            <ul className="space-y-2">
              {data.items.map((item, index) => {
                if (dismissed.has(index)) return null;
                return (
                  <li key={`${item.title}-${index}`}>
                    <Card className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                PRIORITY_DOT[item.priority],
                              )}
                            />
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {KIND_LABEL[item.kind]}
                            </span>
                          </div>
                          <p className="font-medium">{item.title}</p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Dispensar"
                          onClick={() =>
                            setDismissed((prev) => new Set(prev).add(index))
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </div>

                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {item.body}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-1"
                          onClick={() => copyBody(item.body)}
                        >
                          <Copy className="size-3.5" /> Copiar
                        </Button>

                        {item.actionType === "nudge_checkins" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1"
                            disabled={acting}
                            onClick={() => runNudge(item, index)}
                          >
                            <Check className="size-3.5" />
                            {item.actionLabel ?? "Confirmar envio de lembretes"}
                          </Button>
                        ) : null}

                        {item.href ? (
                          <Button
                            render={<Link href={item.href} />}
                            nativeButton={false}
                            size="sm"
                            variant="secondary"
                          >
                            {item.actionLabel ?? "Abrir"}
                          </Button>
                        ) : null}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
