"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Clock,
  Inbox,
  Loader2,
  Map,
  Route,
  Send,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; text: string };

type AgentPattern = "supervisor" | "journey" | "briefing" | "router";

type ActionDef = {
  id: string;
  label: string;
  hint: string;
  icon: typeof Sparkles;
  pattern: AgentPattern;
  prompt: string;
};

export type AgentsTracking = {
  students: number;
  pendingReviews: number;
  onboardings: number;
  proposals: number;
  checkinsToday: number;
  checkinsWeek: number;
};

const ACTIONS: ActionDef[] = [
  {
    id: "onboarding",
    label: "Onboarding",
    hint: "Leads e primeiros passos",
    icon: Sparkles,
    pattern: "supervisor",
    prompt:
      "Ajuda-me com o onboarding: o que falta nos leads novos e por onde começar hoje.",
  },
  {
    id: "create-path",
    label: "Criação de Percurso",
    hint: "Brief → rascunho",
    icon: Route,
    pattern: "journey",
    prompt:
      "Quero criar um percurso. Guia-me do brief ao rascunho, passo a passo.",
  },
  {
    id: "manage-path",
    label: "Gestão e Avaliação",
    hint: "Percursos em curso",
    icon: ClipboardCheck,
    pattern: "supervisor",
    prompt:
      "Ajuda-me a gerir e avaliar os percursos em curso: o que precisa de atenção.",
  },
  {
    id: "follow-up",
    label: "Acompanhamento",
    hint: "Quem precisa de ti",
    icon: Map,
    pattern: "supervisor",
    prompt:
      "Apoia o acompanhamento: prioriza quem precisa de mim esta semana e o que fazer.",
  },
  {
    id: "optimize",
    label: "Otimizar tempo",
    hint: "Urgente vs. adiável",
    icon: Clock,
    pattern: "briefing",
    prompt:
      "Otimiza o meu tempo: o que é urgente hoje e o que posso adiar com segurança.",
  },
  {
    id: "tracking",
    label: "Tracking alunos",
    hint: "Hoje e semana",
    icon: Users,
    pattern: "router",
    prompt:
      "Dá-me um panorama objetivo do que está a acontecer com todos os alunos — hoje e esta semana.",
  },
];

export function AgentsHub({
  healthOk,
  healthLabel,
  tracking,
}: {
  healthOk: boolean;
  healthLabel: string;
  tracking: AgentsTracking;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function send(textRaw: string, pattern: AgentPattern = "supervisor", actionId?: string) {
    const text = textRaw.trim();
    if (!text || pending) return;
    setInput("");
    setActiveAction(actionId ?? null);
    setMessages((m) => [...m, { role: "user", text }]);
    setStatus("A pensar…");

    startTransition(async () => {
      try {
        const res = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            pattern,
            threadId,
            pageContext: "pathname=/studio/agent",
          }),
        });
        const raw = await res.text();
        let data: {
          error?: string;
          threadId?: string;
          eventsPath?: string;
        } = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              text:
                res.status === 401
                  ? "Sessão expirada — volta a entrar."
                  : `Resposta inválida do servidor (${res.status}).`,
            },
          ]);
          setStatus(null);
          setActiveAction(null);
          return;
        }
        if (!res.ok) {
          setMessages((m) => [
            ...m,
            { role: "assistant", text: data.error || "Erro no Agent" },
          ]);
          setStatus(null);
          setActiveAction(null);
          return;
        }
        setThreadId(data.threadId ?? null);
        if (!data.eventsPath) {
          setMessages((m) => [
            ...m,
            { role: "assistant", text: "Agent não devolveu stream." },
          ]);
          setStatus(null);
          setActiveAction(null);
          return;
        }
        const es = new EventSource(data.eventsPath);
        let finalText = "";
        es.onmessage = (ev) => {
          try {
            const parsed = JSON.parse(ev.data);
            if (parsed.type === "done") {
              finalText =
                parsed.payload?.answer ||
                parsed.payload?.briefing ||
                finalText ||
                "Sem resposta.";
              setMessages((m) => [...m, { role: "assistant", text: finalText }]);
              setStatus(null);
              setActiveAction(null);
              es.close();
            } else if (parsed.type === "error") {
              setMessages((m) => [
                ...m,
                {
                  role: "assistant",
                  text: parsed.payload?.message || "Erro no Agent",
                },
              ]);
              setStatus(null);
              setActiveAction(null);
              es.close();
            } else if (parsed.type === "node" || parsed.type === "update") {
              setStatus(
                parsed.payload?.name
                  ? `Nó: ${parsed.payload.name}`
                  : "A processar…",
              );
            }
          } catch {
            /* ignore parse */
          }
        };
        es.onerror = () => {
          setStatus(null);
          setActiveAction(null);
          es.close();
        };
      } catch (e) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: e instanceof Error ? e.message : "Falha de rede",
          },
        ]);
        setStatus(null);
        setActiveAction(null);
      }
    });
  }

  const trackingItems = [
    { label: "Alunos", value: tracking.students },
    { label: "Hoje", value: tracking.checkinsToday },
    { label: "Semana", value: tracking.checkinsWeek },
    { label: "Por rever", value: tracking.pendingReviews },
    { label: "Onboarding", value: tracking.onboardings },
  ];

  return (
    <div className="relative flex min-h-[calc(100dvh-8rem)] flex-col pb-28 desktop:pb-24">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              Agents
            </h1>
            <p className="max-w-lg text-sm text-muted-foreground">
              Propõe · tu validas. Escolhe uma ação ou escreve abaixo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "rounded-full px-2.5 py-1",
                healthOk ? "bg-white/10 text-foreground" : "bg-destructive/15 text-destructive",
              )}
            >
              {healthOk ? `Online · ${healthLabel}` : `Offline · ${healthLabel}`}
            </span>
            <Link
              href="/studio/agent/inbox"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-foreground transition-colors hover:bg-white/15"
            >
              <Inbox className="size-3.5" />
              Inbox
              {tracking.proposals > 0 ? (
                <span className="rounded-full bg-[var(--neuma-coral)] px-1.5 text-[10px] font-semibold text-white">
                  {tracking.proposals}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <div className="grid w-full grid-cols-5 gap-2">
          {trackingItems.map((item) => (
            <div
              key={item.label}
              className="glass min-w-0 rounded-2xl px-2 py-2.5 sm:px-3.5"
            >
              <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                {item.label}
              </p>
              <p className="text-lg font-semibold tabular-nums sm:text-xl">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const busy = pending && activeAction === action.id;
            return (
              <button
                key={action.id}
                type="button"
                disabled={pending}
                onClick={() => send(action.prompt, action.pattern, action.id)}
                className={cn(
                  "glass group flex flex-col items-start gap-1.5 rounded-2xl p-2.5 text-left transition-colors sm:min-h-[5.25rem] sm:flex-row sm:items-start sm:gap-3 sm:p-4",
                  "hover:bg-white/[0.08] disabled:opacity-60",
                  busy && "ring-1 ring-white/25",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[var(--neuma-coral)]/25 to-[var(--neuma-blue)]/25 sm:mt-0.5 sm:size-10 sm:rounded-xl">
                  {busy ? (
                    <Loader2 className="size-4 animate-spin sm:size-5" />
                  ) : (
                    <Icon className="size-4 sm:size-5" />
                  )}
                </span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-semibold leading-tight sm:text-base">
                    {action.label}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-muted-foreground sm:text-xs sm:whitespace-normal">
                    {action.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <section className="min-h-[10rem] space-y-3">
          {messages.length === 0 && !status ? (
            <p className="text-sm text-muted-foreground">
              Ainda sem mensagens nesta sessão. Usa uma ação rápida ou o prompt
              em baixo.
            </p>
          ) : null}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "ml-6 bg-foreground text-background"
                  : "mr-4 bg-white/[0.06]",
              )}
            >
              {m.text}
            </div>
          ))}
          {status ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {status}
            </p>
          ) : null}
          <div ref={bottomRef} />
        </section>
      </div>

      <div
        className={cn(
          "fixed z-40 px-4",
          "inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
          "desktop:left-64 desktop:right-0 desktop:bottom-6 desktop:px-10",
        )}
      >
        <form
          className="glass mx-auto flex max-w-3xl items-center gap-2 rounded-2xl p-2 shadow-lg"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Escreve ao Agent… (⌘J)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending}
            aria-label="Mensagem para o Agent"
          />
          <Button
            type="submit"
            size="icon-lg"
            disabled={pending || !input.trim()}
            aria-label="Enviar"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
