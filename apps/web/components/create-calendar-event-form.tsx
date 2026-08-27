"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { createMentorCalendarEvent } from "@/lib/actions/calendar-events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const KIND_OPTIONS = [
  { value: "reminder", label: "Lembrete" },
  { value: "meeting", label: "Reunião" },
  { value: "event", label: "Evento" },
  { value: "misc", label: "Diversos" },
] as const;

/** Painel de criação; abre com `#novo-evento` ou pelo botão. */
export function CreateCalendarEventPanel({
  students = [],
  paths = [],
}: {
  students?: { id: string; label: string }[];
  paths?: { id: string; title: string; student_id: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState("");

  useEffect(() => {
    const sync = () => {
      if (window.location.hash.replace(/^#/, "") === "novo-evento") {
        setOpen(true);
        document
          .getElementById("novo-evento")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const pathOptions = paths.filter(
    (p) => !studentId || p.student_id === studentId || !p.student_id,
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        await createMentorCalendarEvent(data);
        toast.success("Evento criado");
        form.reset();
        setStudentId("");
        setOpen(false);
        if (window.location.hash.includes("novo-evento")) {
          history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível criar",
        );
      }
    });
  }

  return (
    <div id="novo-evento" className="scroll-mt-24 space-y-3">
      {!open ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <CalendarPlus className="size-3.5" /> Adicionar evento
        </Button>
      ) : (
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Novo evento</h3>
              <p className="text-sm text-muted-foreground">
                Aparece no calendário da app (só para ti). Podes ligar a um
                aluno ou percurso.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Fechar
            </Button>
          </div>

          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">
                Nome do evento
              </span>
              <Input name="title" required placeholder="Ex.: Rever material" />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Tipo
              </span>
              <select
                name="kind"
                required
                defaultValue="event"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Início
              </span>
              <Input name="starts_at" type="datetime-local" required />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Fim (opcional)
              </span>
              <Input name="ends_at" type="datetime-local" />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Aluno (opcional)
              </span>
              <select
                name="student_id"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Sem aluno</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Percurso (opcional)
              </span>
              <select
                name="path_id"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                defaultValue=""
              >
                <option value="">Sem percurso</option>
                {pathOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">
                Notas (opcional)
              </span>
              <Textarea name="notes" rows={2} placeholder="Detalhes…" />
            </label>

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "A guardar…" : "Criar evento"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

/** @deprecated use CreateCalendarEventPanel */
export function CreateCalendarEventForm() {
  return <CreateCalendarEventPanel />;
}
