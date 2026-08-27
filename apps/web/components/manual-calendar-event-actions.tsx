"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteMentorCalendarEvent,
  updateMentorCalendarEvent,
} from "@/lib/actions/calendar-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const KIND_OPTIONS = [
  { value: "reminder", label: "Lembrete" },
  { value: "meeting", label: "Reunião" },
  { value: "event", label: "Evento" },
  { value: "misc", label: "Diversos" },
] as const;

export type EditableManualEvent = {
  id: string;
  title: string;
  kind: string;
  startsAtLocal: string;
  notes: string | null;
  studentId: string | null;
};

export function ManualCalendarEventActions({
  event,
  students,
}: {
  event: EditableManualEvent;
  students: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm("Apagar este evento?")) return;
    const fd = new FormData();
    fd.set("id", event.id);
    startTransition(async () => {
      try {
        await deleteMentorCalendarEvent(fd);
        toast.success("Evento apagado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao apagar");
      }
    });
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", event.id);
    startTransition(async () => {
      try {
        await updateMentorCalendarEvent(fd);
        toast.success("Evento atualizado");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao guardar");
      }
    });
  }

  if (!open) {
    return (
      <span className="inline-flex shrink-0 gap-0.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Editar evento"
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-destructive"
          aria-label="Apagar evento"
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </span>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="mt-2 w-full min-w-[16rem] space-y-2 rounded-xl border border-white/10 bg-background/80 p-3"
    >
      <Input name="title" defaultValue={event.title} required />
      <select
        name="kind"
        defaultValue={event.kind}
        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        {KIND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Input
        name="starts_at"
        type="datetime-local"
        defaultValue={event.startsAtLocal}
        required
      />
      <select
        name="student_id"
        defaultValue={event.studentId ?? ""}
        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        <option value="">Sem aluno</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <Textarea name="notes" rows={2} defaultValue={event.notes ?? ""} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Guardar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
