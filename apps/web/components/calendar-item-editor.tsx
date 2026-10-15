"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  saveCalendarNodeDueDate,
  saveCalendarSessionTime,
} from "@/lib/actions/calendar-edits";
import {
  deleteMentorCalendarEvent,
  updateMentorCalendarEvent,
} from "@/lib/actions/calendar-events";
import type { CalendarEvent } from "@/lib/calendar/events";
import { lisbonDateTimeLocal } from "@/lib/calendar/lisbon";
import { fridayOfWeek, formatShortDatePt } from "@/lib/path-period";
import { Button } from "@/components/ui/button";
import { DatePicker, DateTimePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const MANUAL_KINDS = [
  { value: "reminder", label: "Lembrete" },
  { value: "meeting", label: "Reunião" },
  { value: "event", label: "Evento" },
  { value: "misc", label: "Diversos" },
] as const;

function editMode(event: CalendarEvent) {
  if (event.readOnlyReason) return "readonly" as const;
  if (event.editableEventId) return "manual" as const;
  if (event.kind === "session" && event.calBookingUid) return "session" as const;
  if (event.kind === "due" && event.nodeId && event.pathId) return "due" as const;
  return "readonly" as const;
}

function dueHint(event: CalendarEvent) {
  if (event.nodeKind === "call") {
    return event.scheduleAnchored
      ? "É o prazo do nível, não a chamada. Cai na sexta, e os níveis seguintes acompanham."
      : "É o prazo do nível, não a chamada no Cal.com.";
  }
  if (event.scheduleAnchored) {
    return "O prazo fica na sexta dessa semana. Os níveis seguintes acompanham.";
  }
  return "Atualiza o prazo deste nível.";
}

function durationLabel(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const mins = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60_000,
  );
  if (!Number.isFinite(mins) || mins <= 0) return null;
  if (mins % 60 === 0) {
    const hours = mins / 60;
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }
  return `${mins} min`;
}

export function CalendarItemEditor({
  event,
  students,
  onClose,
}: {
  event: CalendarEvent;
  students: { id: string; label: string }[];
  onClose: () => void;
}) {
  const mode = editMode(event);
  const reason =
    event.readOnlyReason ?? "Este item não se edita no calendário.";
  const who = event.studentName?.trim();
  const subtitle = [who, event.pathTitle].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{event.title}</p>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>

      {mode === "readonly" ? (
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
      ) : null}
      {mode === "due" ? <DueEditor event={event} onClose={onClose} /> : null}
      {mode === "session" ? (
        <SessionEditor event={event} onClose={onClose} />
      ) : null}
      {mode === "manual" && event.editableEventId ? (
        <ManualEditor
          event={event}
          eventId={event.editableEventId}
          students={students}
          onClose={onClose}
        />
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {event.href && event.kind !== "session" ? (
          <Link
            href={event.href}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Abrir percurso
          </Link>
        ) : null}
        {event.href && event.kind === "session" ? (
          <Link
            href={event.href}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ficha do aluno
          </Link>
        ) : null}
        {event.meetUrl ? (
          <a
            href={event.meetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Entrar na chamada
          </a>
        ) : null}
      </div>
    </div>
  );
}

function DueEditor({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const router = useRouter();
  const [dueDate, setDueDate] = useState(event.date);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const friday =
    event.scheduleAnchored && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      ? fridayOfWeek(dueDate)
      : null;

  function onSave() {
    if (!event.nodeId || !event.pathId) return;
    setError(null);
    startTransition(async () => {
      const result = await saveCalendarNodeDueDate({
        nodeId: event.nodeId!,
        pathId: event.pathId!,
        dueDate,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Prazo atualizado");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="mt-3 max-w-md space-y-2">
      <p className="text-sm text-muted-foreground">{dueHint(event)}</p>
      <DatePicker value={dueDate} onValueChange={setDueDate} required />
      {friday && friday !== dueDate ? (
        <p className="text-xs text-muted-foreground">
          Fica em {formatShortDatePt(friday)}.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" size="sm" disabled={pending || !dueDate} onClick={onSave}>
        {pending ? "A guardar…" : "Guardar"}
      </Button>
    </div>
  );
}

function SessionEditor({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState(
    lisbonDateTimeLocal(event.startsAtIso),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const duration = durationLabel(event.startsAtIso, event.endsAtIso);

  function onSave() {
    if (!event.calBookingUid) return;
    setError(null);
    startTransition(async () => {
      const result = await saveCalendarSessionTime({
        bookingUid: event.calBookingUid!,
        startsAtLocal: startsAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Sessão reagendada");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="mt-3 max-w-md space-y-2">
      <p className="text-sm text-muted-foreground">
        A nova hora é enviada ao Cal.com.
        {duration ? ` A duração mantém-se (${duration}).` : " A duração mantém-se."}
      </p>
      <DateTimePicker value={startsAt} onValueChange={setStartsAt} required />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="button"
        size="sm"
        disabled={pending || !startsAt}
        onClick={onSave}
      >
        {pending ? "A guardar…" : "Guardar"}
      </Button>
    </div>
  );
}

function ManualEditor({
  event,
  eventId,
  students,
  onClose,
}: {
  event: CalendarEvent;
  eventId: string;
  students: { id: string; label: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const kind = MANUAL_KINDS.some((option) => option.value === event.kind)
    ? event.kind
    : "event";

  function onSave(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const fd = new FormData(formEvent.currentTarget);
    fd.set("id", eventId);
    setError(null);
    startTransition(async () => {
      try {
        await updateMentorCalendarEvent(fd);
        toast.success("Evento atualizado");
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao guardar");
      }
    });
  }

  function onDelete() {
    if (!confirm("Apagar este evento?")) return;
    const fd = new FormData();
    fd.set("id", eventId);
    setError(null);
    startTransition(async () => {
      try {
        await deleteMentorCalendarEvent(fd);
        toast.success("Evento apagado");
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao apagar");
      }
    });
  }

  return (
    <form onSubmit={onSave} className="mt-3 max-w-md space-y-2">
      <Input name="title" defaultValue={event.title} required />
      <select
        name="kind"
        defaultValue={kind}
        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        {MANUAL_KINDS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <DateTimePicker
        name="starts_at"
        defaultValue={lisbonDateTimeLocal(event.startsAtIso)}
        required
      />
      <select
        name="student_id"
        defaultValue={event.studentId ?? ""}
        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        <option value="">Sem aluno</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.label}
          </option>
        ))}
      </select>
      <Textarea name="notes" rows={2} defaultValue={event.notes ?? ""} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={onDelete}
        >
          Apagar
        </Button>
      </div>
    </form>
  );
}
