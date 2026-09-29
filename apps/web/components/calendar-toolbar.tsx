"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CalendarEventKind } from "@/lib/calendar/events";

const KIND_LABEL: Record<CalendarEventKind, string> = {
  session: "Sessão",
  due: "Prazo",
  path_start: "Início",
  path_end: "Fim",
  reminder: "Lembrete",
  meeting: "Reunião",
  event: "Evento",
  misc: "Diversos",
};

const selectClassName =
  "h-9 min-w-0 max-w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-sm outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40 sm:max-w-[14rem]";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function CalendarToolbar({
  view,
  kind,
  studentId,
  oneToOneOnly,
  students,
}: {
  view: "month" | "week";
  kind: CalendarEventKind | "";
  studentId: string;
  oneToOneOnly: boolean;
  students: { id: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const selectedStudent = students.find((s) => s.id === studentId) ?? null;
  const [query, setQuery] = useState(selectedStudent?.label ?? "");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(selectedStudent?.label ?? "");
  }, [selectedStudent?.label, studentId]);

  const filteredStudents = useMemo(() => {
    const q = normalize(query);
    if (!q) return students.slice(0, 40);
    return students
      .filter((s) => normalize(s.label).includes(q))
      .slice(0, 40);
  }, [query, students]);

  function push(next: {
    view?: "month" | "week";
    kind?: string;
    student?: string;
    oto?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const mergedView = next.view ?? view;
    const mergedKind = next.kind !== undefined ? next.kind : kind;
    const mergedStudent =
      next.student !== undefined ? next.student : studentId;
    const mergedOto =
      next.oto !== undefined ? next.oto : oneToOneOnly ? "1" : "";

    if (mergedView === "week") params.set("view", "week");
    else params.delete("view");

    if (mergedKind) params.set("kind", mergedKind);
    else params.delete("kind");

    if (mergedStudent) params.set("student", mergedStudent);
    else params.delete("student");

    if (mergedOto === "1") params.set("oto", "1");
    else params.delete("oto");

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/studio/calendar?${qs}` : "/studio/calendar");
    });
  }

  function selectStudent(id: string, label: string) {
    setQuery(label);
    setOpen(false);
    push({ student: id });
  }

  function clearStudent() {
    setQuery("");
    setOpen(false);
    push({ student: "" });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2 sm:p-3.5",
        pending && "opacity-70",
      )}
    >
      <div
        role="group"
        aria-label="Vista"
        className="inline-flex h-9 shrink-0 self-start rounded-lg border border-white/10 bg-black/20 p-0.5"
      >
        {(
          [
            ["month", "Mês"],
            ["week", "Semana"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => push({ view: value })}
            aria-pressed={view === value}
            className={cn(
              "rounded-md px-3 text-sm font-medium transition-colors",
              view === value
                ? "bg-white/10 text-[#ffffe9]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="hidden h-5 w-px bg-white/10 sm:block" aria-hidden />

      <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[14rem]">
        <span className="sr-only">Tipo</span>
        <select
          value={kind}
          onChange={(e) => push({ kind: e.target.value })}
          className={cn(selectClassName, "w-full")}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos os tipos</option>
          {(Object.keys(KIND_LABEL) as CalendarEventKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>

      <div className="relative min-w-0 flex-1 sm:max-w-[18rem]">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          placeholder="Pesquisar aluno…"
          aria-label="Pesquisar aluno"
          aria-expanded={open}
          aria-controls="calendar-student-results"
          autoComplete="off"
          className={cn(
            selectClassName,
            "w-full max-w-none py-0 pr-8 pl-8 sm:max-w-none",
          )}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            setOpen(true);
            if (!value && studentId) {
              push({ student: "" });
            }
          }}
        />
        {query || studentId ? (
          <button
            type="button"
            aria-label="Limpar aluno"
            className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearStudent}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
        {open ? (
          <ul
            id="calendar-student-results"
            role="listbox"
            className="absolute top-[calc(100%+0.35rem)] right-0 left-0 z-40 max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#1c1c1c] p-1 shadow-lg"
          >
            {!studentId ? null : (
              <li>
                <button
                  type="button"
                  role="option"
                  className="flex w-full rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-white/5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearStudent}
                >
                  Todos os alunos
                </button>
              </li>
            )}
            {filteredStudents.length === 0 ? (
              <li className="px-2.5 py-2 text-sm text-muted-foreground">
                Nenhum aluno.
              </li>
            ) : (
              filteredStudents.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={s.id === studentId}
                    className={cn(
                      "flex w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/5",
                      s.id === studentId && "bg-white/10",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectStudent(s.id, s.label)}
                  >
                    {s.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm transition-colors hover:bg-white/[0.05]">
        <input
          type="checkbox"
          checked={oneToOneOnly}
          onChange={(e) => push({ oto: e.target.checked ? "1" : "" })}
          className="size-3.5 rounded border-white/20 accent-[var(--neuma-coral)]"
        />
        <span className="text-muted-foreground">Neuma 1:1</span>
      </label>
    </div>
  );
}
