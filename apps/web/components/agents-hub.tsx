"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  ClipboardCheck,
  Clock,
  Handshake,
  Loader2,
  Map,
  Route,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import type { StudentOption } from "@/components/tally-submission-row-actions";
import {
  authSessionScope,
  clearCreatePathSession,
  CREATE_PATH_SESSION_KEY,
} from "@/lib/agent/create-path-session";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type PathDraftInfo = {
  pathId: string;
  proposalId?: string | null;
  title: string;
  levelCount: number;
  preview?: string[];
  href?: string;
  status?: string;
  reused?: boolean;
};

type Msg = {
  role: "user" | "assistant";
  text: string;
  pathDraft?: PathDraftInfo | null;
};

type AgentPattern = "supervisor" | "journey" | "briefing" | "router";

type ActionDef = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Sparkles;
  pattern: AgentPattern;
  prompt: string;
  /** When true, pick a student locally before calling the agent. */
  requiresStudent?: boolean;
};

const ACTIONS: ActionDef[] = [
  {
    id: "onboarding",
    label: "Onboardings",
    icon: Handshake,
    pattern: "supervisor",
    prompt:
      "Lista onboardings / Forms pendentes e o que falta para eu criar o draft de percurso. Resposta telegráfica.",
  },
  {
    id: "create-path",
    label: "Criação de Percursos",
    icon: Route,
    pattern: "journey",
    requiresStudent: true,
    prompt:
      "Quero criar um percurso de 4 meses a partir do brief/onboarding. Níveis flexíveis (podem ficar sem conteúdo). Cria rascunho no app (status=draft) — não actives.",
  },
  {
    id: "manage-path",
    label: "Gestão de Percursos",
    icon: ClipboardCheck,
    pattern: "supervisor",
    prompt:
      "Estado dos percursos activos: dead ends de conteúdo, feedbacks pendentes, prazos a expirar. Só bullets com nome e facto.",
  },
  {
    id: "follow-up",
    label: "Alertas",
    icon: Map,
    pattern: "supervisor",
    prompt:
      "Chama get_intervention_alerts e devolve só alunos em: dead_end, feedback_pending (>24h), stagnating (1 dia para prazo), expired. Formato «Nome — facto». Sem introdução.",
  },
  {
    id: "optimize",
    label: "Otimizar tempo",
    icon: Clock,
    pattern: "briefing",
    prompt:
      "Quais são os próximos eventos? Cruza sessões Cal.com, prazos de níveis activos e alertas de gravar/adicionar conteúdo. Resposta telegráfica.",
  },
  {
    id: "tracking",
    label: "Tracking alunos",
    icon: Users,
    pattern: "router",
    prompt:
      "Estado global de acompanhamento: lista só alertas críticos (dead end, feedback >24h, estagnação 1 dia, expirou). Formato «Nome — facto».",
  },
];

const CREATE_PATH_ASK =
  "Para quem queres criar o percurso? Escreve o nome do aluno.";

type CreatePathSession = {
  /** Supabase auth session_id — must match current login or chat is discarded. */
  authSessionId: string | null;
  messages: Msg[];
  pickingStudent: boolean;
  threadId: string | null;
  activeAction: string | null;
  studentId: string | null;
  studentName: string | null;
  pathId: string | null;
};

function isCreatePathSession(opts: {
  pickingStudent: boolean;
  activeAction: string | null;
  messages: Msg[];
}) {
  if (opts.pickingStudent || opts.activeAction === "create-path") return true;
  if (opts.messages.some((m) => m.pathDraft)) return true;
  if (opts.messages.some((m) => m.text === CREATE_PATH_ASK)) return true;
  return false;
}

function extractCreatePathMeta(messages: Msg[]): {
  studentId: string | null;
  studentName: string | null;
  pathId: string | null;
} {
  let studentId: string | null = null;
  let studentName: string | null = null;
  let pathId: string | null = null;
  for (const m of messages) {
    if (m.pathDraft?.pathId) pathId = m.pathDraft.pathId;
    const sid = m.text.match(/student_id=([0-9a-f-]{36})/i);
    if (sid) studentId = sid[1];
    const aluno = m.text.match(/^Aluno:\s*(.+)$/m);
    if (aluno) studentName = aluno[1].trim();
  }
  return { studentId, studentName, pathId };
}

function buildResumeTranscript(messages: Msg[]): string {
  return messages
    .slice(-8)
    .map((m) => {
      const who = m.role === "user" ? "Mentor" : "Agent";
      const body = m.text.replace(/\s+/g, " ").trim().slice(0, 280);
      const draft = m.pathDraft
        ? ` [pathId=${m.pathDraft.pathId} «${m.pathDraft.title}»]`
        : "";
      return `${who}: ${body}${draft}`;
    })
    .join("\n");
}

function loadCreatePathSession(): CreatePathSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CREATE_PATH_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CreatePathSession;
    if (!Array.isArray(data.messages)) return null;
    const meta = extractCreatePathMeta(data.messages);
    return {
      authSessionId:
        typeof data.authSessionId === "string" ? data.authSessionId : null,
      messages: data.messages,
      pickingStudent: Boolean(data.pickingStudent),
      threadId: typeof data.threadId === "string" ? data.threadId : null,
      activeAction:
        data.activeAction === "create-path" ? "create-path" : null,
      studentId:
        typeof data.studentId === "string" ? data.studentId : meta.studentId,
      studentName:
        typeof data.studentName === "string"
          ? data.studentName
          : meta.studentName,
      pathId: typeof data.pathId === "string" ? data.pathId : meta.pathId,
    };
  } catch {
    return null;
  }
}

function saveCreatePathSession(session: CreatePathSession) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CREATE_PATH_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

/** Short PT-friendly label from provider:model or bare model id. */
function friendlyModelLabel(raw: string): string {
  const id = (raw.includes(":") ? raw.split(":").pop() : raw)?.trim() || raw;
  const lower = id.toLowerCase();
  if (lower.includes("sonnet")) return "Claude Sonnet";
  if (lower.includes("haiku")) return "Claude Haiku";
  if (lower.includes("flash-lite") || lower.includes("flash_lite")) {
    return "Gemini Flash Lite";
  }
  if (lower.includes("flash")) return "Gemini Flash";
  if (lower.includes("gemini")) return "Gemini";
  if (lower.includes("claude")) return "Claude";
  return id;
}

function studentMatchesSearch(student: StudentOption, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (student.full_name?.toLowerCase().includes(q) ?? false) ||
    (student.email?.toLowerCase().includes(q) ?? false)
  );
}

function pathPromptForStudent(student: StudentOption) {
  const name = student.full_name?.trim() || student.email || "aluno";
  return [
    `Cria percurso HITL para student_id=${student.id} nome=${name}.`,
    "Usa o brief/onboarding do aluno — não peças a ROTA.",
    "Cria rascunho no app (status=draft, níveis flexíveis). Não actives.",
  ].join(" ");
}

function parsePathDraft(raw: unknown): PathDraftInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pathId = typeof o.pathId === "string" ? o.pathId : "";
  if (!pathId) return null;
  const preview = Array.isArray(o.preview)
    ? o.preview.filter((x): x is string => typeof x === "string").slice(0, 6)
    : [];
  return {
    pathId,
    proposalId: typeof o.proposalId === "string" ? o.proposalId : null,
    title: typeof o.title === "string" && o.title.trim() ? o.title : "Percurso",
    levelCount:
      typeof o.levelCount === "number" && Number.isFinite(o.levelCount)
        ? o.levelCount
        : preview.length,
    preview,
    href:
      typeof o.href === "string" && o.href.startsWith("/")
        ? o.href
        : `/studio/journeys/${pathId}`,
    status: typeof o.status === "string" ? o.status : "draft",
    reused: Boolean(o.reused),
  };
}

function PathDraftCard({ draft }: { draft: PathDraftInfo }) {
  const href = draft.href || `/studio/journeys/${draft.pathId}`;
  const meta =
    draft.status === "active"
      ? "Já activo"
      : draft.reused
        ? "Rascunho existente"
        : "Rascunho · aluno ainda não vê";

  return (
    <div className="glass mt-2 w-full max-w-[min(92%,34rem)] overflow-hidden rounded-2xl border border-white/10">
      <div className="flex items-start gap-3 px-3.5 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--neuma-coral)]/30 to-[var(--neuma-blue)]/25">
          <Route className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {meta}
          </p>
          <p className="truncate text-sm font-semibold">{draft.title}</p>
          {draft.levelCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {draft.levelCount}{" "}
              {draft.levelCount === 1 ? "nível" : "níveis"}
              {draft.preview?.length
                ? ` · ${draft.preview.slice(0, 2).join(" · ")}`
                : null}
              {draft.preview && draft.preview.length > 2 ? "…" : null}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex border-t border-white/10">
        <Link
          href={href}
          className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06]"
        >
          Abrir percurso
          <ArrowRight className="size-3.5 opacity-70" />
        </Link>
      </div>
    </div>
  );
}

export function AgentsHub({
  healthOk,
  healthLabel,
  students = [],
}: {
  healthOk: boolean;
  healthLabel: string;
  students?: StudentOption[];
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [, setThreadId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [pickingStudent, setPickingStudent] = useState(false);
  /** Last / active run model (friendly). Idle badge uses healthLabel. */
  const [runModelLabel, setRunModelLabel] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sessionReady, setSessionReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadIdRef = useRef<string | null>(null);
  const authSessionIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  /** Bumped when switching actions so late stream/fetch results are ignored. */
  const runIdRef = useRef(0);

  const studentList = students ?? [];
  const searchQuery = input.trim();
  const studentResults = useMemo(() => {
    if (!pickingStudent) return [];
    const filtered = studentList.filter((s) =>
      studentMatchesSearch(s, searchQuery),
    );
    // When empty query, show a short list so mentor can pick quickly.
    return (searchQuery ? filtered : filtered.slice(0, 8)).slice(0, 8);
  }, [pickingStudent, studentList, searchQuery]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key === "Escape" && pickingStudent) {
        e.preventDefault();
        setPickingStudent(false);
        setActiveAction(null);
        setInput("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickingStudent]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status, pickingStudent, studentResults.length]);

  // Restore path-creation screen state after in-app navigation (sessionStorage = €0).
  // Only resume when the stored auth session matches the current login.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const sb = createClient();
      const {
        data: { session },
      } = await sb.auth.getSession();
      const scope = session ? authSessionScope(session) : null;
      authSessionIdRef.current = scope;

      const saved = loadCreatePathSession();
      const canResume =
        Boolean(scope) &&
        saved != null &&
        saved.authSessionId === scope &&
        saved.messages.length > 0;

      if (!cancelled && canResume && saved) {
        setMessages(saved.messages);
        setPickingStudent(saved.pickingStudent);
        setActiveAction(saved.activeAction);
        threadIdRef.current = saved.threadId;
        setThreadId(saved.threadId);
      } else if (saved) {
        clearCreatePathSession();
      }

      if (!cancelled) setSessionReady(true);
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // Drop sticky chat if auth session ends (e.g. logout from another UI).
  useEffect(() => {
    const sb = createClient();
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      clearCreatePathSession();
      authSessionIdRef.current = null;
      threadIdRef.current = null;
      setThreadId(null);
      setMessages([]);
      setPickingStudent(false);
      setActiveAction(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Persist create-path conversation until other action / confirm / tab close.
  useEffect(() => {
    if (!sessionReady) return;
    if (
      isCreatePathSession({ pickingStudent, activeAction, messages }) &&
      messages.length > 0
    ) {
      const meta = extractCreatePathMeta(messages);
      const authSessionId = authSessionIdRef.current;
      // Never persist without a session scope — would survive re-login.
      if (!authSessionId) {
        clearCreatePathSession();
        return;
      }
      saveCreatePathSession({
        authSessionId,
        messages,
        pickingStudent,
        threadId: threadIdRef.current,
        activeAction: "create-path",
        studentId: meta.studentId,
        studentName: meta.studentName,
        pathId: meta.pathId,
      });
    }
  }, [sessionReady, messages, pickingStudent, activeAction]);

  // After mentor activates the path, clear the sticky create-path conversation.
  useEffect(() => {
    if (!sessionReady) return;

    async function clearIfPathActivated() {
      const draftIds = messages
        .map((m) => m.pathDraft?.pathId)
        .filter((id): id is string => Boolean(id));
      if (draftIds.length === 0) return;

      const sb = createClient();
      const { data } = await sb
        .from("paths")
        .select("id, status")
        .in("id", draftIds);
      const activated = (data ?? []).some((p) => p.status === "active");
      if (!activated) return;

      clearCreatePathSession();
      setMessages([]);
      setPickingStudent(false);
      setActiveAction(null);
      threadIdRef.current = null;
      setThreadId(null);
    }

    function onFocus() {
      void clearIfPathActivated();
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    void clearIfPathActivated();
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [sessionReady, messages]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  function setThread(id: string | null) {
    threadIdRef.current = id;
    setThreadId(id);
  }

  function abortActiveStream() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }

  /** Clear chat + agent thread before starting a new action card flow. */
  function resetChatForNewAction() {
    abortActiveStream();
    runIdRef.current += 1;
    clearCreatePathSession();
    setMessages([]);
    setThread(null);
    setStatus(null);
    setActiveAction(null);
    setPickingStudent(false);
    setInput("");
  }

  function cancelStudentPicker() {
    setPickingStudent(false);
    setActiveAction(null);
    setInput("");
  }

  function startCreatePathPicker() {
    resetChatForNewAction();
    setPickingStudent(true);
    setActiveAction("create-path");
    setMessages([{ role: "assistant", text: CREATE_PATH_ASK }]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function selectStudentForPath(student: StudentOption) {
    if (pending) return;
    const name = student.full_name?.trim() || student.email || "Aluno";
    setPickingStudent(false);
    setInput("");
    setActiveAction("create-path");
    setMessages((m) => [...m, { role: "user", text: `Aluno: ${name}` }]);
    send(pathPromptForStudent(student), "journey", "create-path", {
      studentId: student.id,
      studentName: name,
      skipUserBubble: true,
    });
  }

  function send(
    textRaw: string,
    pattern: AgentPattern = "supervisor",
    actionId?: string,
    opts?: {
      studentId?: string;
      studentName?: string;
      pathId?: string;
      skipUserBubble?: boolean;
      resume?: boolean;
    },
  ) {
    const text = textRaw.trim();
    if (!text || pending) return;
    setPickingStudent(false);
    setInput("");
    setActiveAction(actionId ?? null);
    if (!opts?.skipUserBubble) {
      setMessages((m) => [...m, { role: "user", text }]);
    }
    setStatus("A pensar…");

    const pageParts = ["pathname=/studio/agent"];
    if (opts?.resume && opts.pathId) {
      pageParts.push("action=resume-path");
      pageParts.push(`pathId=${opts.pathId}`);
    } else if (opts?.studentId) {
      pageParts.push("action=create-path");
    }
    if (opts?.studentId) {
      pageParts.push(`studentId=${opts.studentId}`);
      if (opts.studentName) pageParts.push(`studentName=${opts.studentName}`);
    }
    if (opts?.pathId && !opts.resume) {
      pageParts.push(`pathId=${opts.pathId}`);
    }

    let messageOut = text;
    if (opts?.resume) {
      const transcript = buildResumeTranscript(messages);
      messageOut = [
        "[Retoma conversa Criação de Percursos — continua deste ponto; não recomeças do zero]",
        opts.pathId ? `path_id=${opts.pathId}` : null,
        opts.studentId ? `student_id=${opts.studentId}` : null,
        opts.studentName ? `nome=${opts.studentName}` : null,
        "",
        "[Histórico no ecrã]",
        transcript || "(vazio)",
        "",
        "[Pedido actual do mentor]",
        text,
      ]
        .filter((line) => line !== null)
        .join("\n");
    }

    const myRunId = runIdRef.current;
    const stillActive = () => runIdRef.current === myRunId;

    startTransition(async () => {
      try {
        const res = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageOut,
            pattern,
            threadId: threadIdRef.current,
            pageContext: pageParts.join(";"),
            studentId: opts?.studentId,
          }),
        });
        if (!stillActive()) return;
        const raw = await res.text();
        if (!stillActive()) return;
        let data: {
          error?: string;
          threadId?: string;
          eventsPath?: string;
          model?: string;
        } = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          if (!stillActive()) return;
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
          setActiveAction(actionId === "create-path" ? "create-path" : null);
          return;
        }
        if (!res.ok) {
          if (!stillActive()) return;
          setMessages((m) => [
            ...m,
            { role: "assistant", text: data.error || "Erro no Agent" },
          ]);
          setStatus(null);
          setActiveAction(actionId === "create-path" ? "create-path" : null);
          return;
        }
        setThread(data.threadId ?? null);
        if (typeof data.model === "string" && data.model.trim()) {
          setRunModelLabel(friendlyModelLabel(data.model));
        }
        if (!data.eventsPath) {
          if (!stillActive()) return;
          setMessages((m) => [
            ...m,
            { role: "assistant", text: "Agent não devolveu stream." },
          ]);
          setStatus(null);
          setActiveAction(actionId === "create-path" ? "create-path" : null);
          return;
        }
        if (!stillActive()) return;
        abortActiveStream();
        const es = new EventSource(data.eventsPath);
        eventSourceRef.current = es;
        let finalText = "";
        es.onmessage = (ev) => {
          if (!stillActive()) {
            es.close();
            return;
          }
          try {
            const parsed = JSON.parse(ev.data);
            const payloadModel =
              typeof parsed.payload?.model === "string"
                ? parsed.payload.model.trim()
                : "";
            if (payloadModel) {
              setRunModelLabel(friendlyModelLabel(payloadModel));
            }
            if (parsed.type === "done") {
              finalText =
                parsed.payload?.answer ||
                parsed.payload?.briefing ||
                finalText ||
                "Sem resposta.";
              const pathDraft = parsePathDraft(parsed.payload?.pathDraft);
              setMessages((m) => [
                ...m,
                { role: "assistant", text: finalText, pathDraft },
              ]);
              setStatus(null);
              // Keep create-path session "alive" for follow-ups after draft
              setActiveAction(
                actionId === "create-path" || pathDraft
                  ? "create-path"
                  : null,
              );
              if (eventSourceRef.current === es) eventSourceRef.current = null;
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
              setActiveAction(
                actionId === "create-path" ? "create-path" : null,
              );
              if (eventSourceRef.current === es) eventSourceRef.current = null;
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
          if (eventSourceRef.current === es) eventSourceRef.current = null;
          if (stillActive()) {
            setStatus(null);
            setActiveAction(
              actionId === "create-path" ? "create-path" : null,
            );
          }
          es.close();
        };
      } catch (e) {
        if (!stillActive()) return;
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: e instanceof Error ? e.message : "Falha de rede",
          },
        ]);
        setStatus(null);
        setActiveAction(actionId === "create-path" ? "create-path" : null);
      }
    });
  }

  function onActionClick(action: ActionDef) {
    if (action.requiresStudent) {
      startCreatePathPicker();
      return;
    }
    resetChatForNewAction();
    send(action.prompt, action.pattern, action.id);
  }

  function sendFollowUpFromInput() {
    const text = input.trim();
    if (!text || pending) return;

    if (
      isCreatePathSession({
        pickingStudent: false,
        activeAction,
        messages,
      })
    ) {
      const meta = extractCreatePathMeta(messages);
      const stored = loadCreatePathSession();
      const studentId = meta.studentId || stored?.studentId || undefined;
      const studentName = meta.studentName || stored?.studentName || undefined;
      const pathId = meta.pathId || stored?.pathId || undefined;

      if (pathId || studentId) {
        send(text, "journey", "create-path", {
          studentId,
          studentName,
          pathId,
          resume: Boolean(pathId),
        });
        return;
      }
    }

    send(text);
  }

  const modelTitle = runModelLabel
    ? "Modelo da execução actual / última"
    : "Stack multi-modelo — actualiza ao correr um agent";
  const modelPrimary = healthOk
    ? (runModelLabel ?? "Multi-modelo")
    : "Offline";
  const modelSecondary = healthOk
    ? runModelLabel
      ? "Em uso neste run"
      : "Pronto · Gemini + Claude"
    : healthLabel;

  return (
    <div
      className={cn(
        "relative flex w-full flex-col overflow-hidden overscroll-none",
        /* Altura = ecrã − header − main pt − menubar (igual a .neuma-mobile-viewport). */
        "h-[calc(100lvh-4rem-env(safe-area-inset-top,0px)-1rem-6.5rem-8px)]",
        /* Desktop: main pt-10 + pb-14. */
        "desktop:h-[calc(100dvh-6rem)]",
      )}
    >
      <div className="shrink-0 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              Multi-agent
            </h1>
          </div>
          <div
            className={cn(
              "glass min-w-[11rem] rounded-2xl px-3.5 py-2.5",
              !healthOk && "ring-1 ring-destructive/40",
            )}
            title={modelTitle}
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {healthOk ? "Online" : "Offline"}
              </p>
              <p
                className={cn(
                  "truncate text-sm font-semibold leading-tight",
                  !healthOk && "text-destructive",
                )}
              >
                {modelPrimary}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {modelSecondary}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const busy =
              (pending && activeAction === action.id) ||
              (pickingStudent && action.id === "create-path");
            return (
              <button
                key={action.id}
                type="button"
                disabled={pending}
                onClick={() => onActionClick(action)}
                className={cn(
                  "glass group flex flex-col items-start gap-1.5 rounded-2xl p-2.5 text-left transition-colors sm:min-h-[5.25rem] sm:flex-row sm:items-start sm:gap-3 sm:p-4",
                  "hover:bg-white/[0.08] disabled:opacity-60",
                  busy && "ring-1 ring-white/25",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[var(--neuma-coral)]/25 to-[var(--neuma-blue)]/25 sm:mt-0.5 sm:size-10 sm:rounded-xl">
                  {pending && activeAction === action.id ? (
                    <Loader2 className="size-4 animate-spin sm:size-5" />
                  ) : (
                    <Icon className="size-4 sm:size-5" />
                  )}
                </span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-semibold leading-tight sm:text-base">
                    {action.label}
                  </span>
                  {action.hint ? (
                    <span className="block truncate text-[10px] leading-tight text-muted-foreground sm:text-xs sm:whitespace-normal">
                      {action.hint}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section
        ref={messagesScrollRef}
        className="mt-6 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-28 desktop:pb-24"
      >
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
              "flex w-full flex-col gap-0",
              m.role === "user" ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "flex w-full",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "w-fit max-w-[min(92%,34rem)] min-w-0 rounded-2xl px-3.5 py-2.5 text-sm",
                  "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                  m.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-white/[0.06]",
                )}
              >
                {m.text}
              </div>
            </div>
            {m.pathDraft ? <PathDraftCard draft={m.pathDraft} /> : null}
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

      <div
        className={cn(
          "fixed z-40 px-4",
          "inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
          "desktop:left-64 desktop:right-0 desktop:bottom-6 desktop:px-10",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {pickingStudent ? (
            <div className="glass overflow-hidden rounded-2xl shadow-lg">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {searchQuery
                    ? `${studentResults.length} resultado${studentResults.length === 1 ? "" : "s"}`
                    : "Sugestões · escreve para filtrar"}
                </p>
                <button
                  type="button"
                  onClick={cancelStudentPicker}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground"
                  aria-label="Cancelar escolha de aluno"
                >
                  <X className="size-3" />
                  Esc
                </button>
              </div>
              {studentResults.length === 0 ? (
                <p className="px-3.5 py-3 text-sm text-muted-foreground">
                  {studentList.length === 0
                    ? "Sem alunos na conta."
                    : "Nenhum aluno corresponde à pesquisa."}
                </p>
              ) : (
                <ul className="max-h-56 overflow-y-auto py-1">
                  {studentResults.map((s) => {
                    const label = s.full_name?.trim() || s.email || s.id;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => selectStudentForPath(s)}
                          className="flex w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-60"
                        >
                          <span className="text-sm font-medium">{label}</span>
                          {s.email && s.full_name ? (
                            <span className="text-xs text-muted-foreground">
                              {s.email}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          <form
            className="glass flex items-center gap-2 rounded-2xl p-2 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (pickingStudent) {
                // Enter with a single exact match selects; otherwise keep searching.
                if (studentResults.length === 1) {
                  selectStudentForPath(studentResults[0]);
                }
                return;
              }
              sendFollowUpFromInput();
            }}
          >
            <input
              ref={inputRef}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              placeholder=""
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={pending}
              aria-label={
                pickingStudent
                  ? "Pesquisar aluno para o percurso"
                  : "Mensagem para o Agent"
              }
              autoComplete="off"
            />
            {!pickingStudent ? (
              <button
                type="submit"
                disabled={pending || !input.trim()}
                aria-label="Enviar"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full border border-[var(--neuma-coral)]/70",
                  "text-[var(--neuma-coral)] transition-colors",
                  "hover:border-[var(--neuma-coral)] hover:bg-[var(--neuma-coral)]/10",
                  "disabled:pointer-events-none disabled:opacity-40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40",
                )}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" strokeWidth={2.25} />
                )}
              </button>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
