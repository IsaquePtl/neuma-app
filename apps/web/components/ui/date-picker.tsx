"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTriggerDate(iso: string) {
  const date = parseIsoDate(iso);
  if (!date) return null;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthGrid(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function shiftMonth(view: Date, delta: number) {
  return new Date(view.getFullYear(), view.getMonth() + delta, 1);
}

function CalendarMonth({
  selected,
  onSelect,
  children,
}: {
  selected: string;
  onSelect: (iso: string) => void;
  children?: ReactNode;
}) {
  const today = useMemo(() => new Date(), []);
  const selectedDate = parseIsoDate(selected);
  const [view, setView] = useState(
    () => selectedDate ?? new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const days = monthGrid(view);

  return (
    <div className="w-[17.25rem]">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
          onClick={() => setView((current) => shiftMonth(current, -1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-medium capitalize">
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </p>
        <button
          type="button"
          aria-label="Mês seguinte"
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
          onClick={() => setView((current) => shiftMonth(current, 1))}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 place-items-center">
        {WEEKDAYS.map((label) => (
          <span
            key={label}
            className="flex h-7 items-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
          >
            {label}
          </span>
        ))}
        {days.map((day) => {
          const iso = toIsoDate(day);
          const inMonth = day.getMonth() === view.getMonth();
          const isSelected = selectedDate ? sameDay(day, selectedDate) : false;
          const isToday = sameDay(day, today);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                "grid size-8 place-items-center rounded-full text-sm transition-colors",
                inMonth ? "text-foreground" : "text-muted-foreground/35",
                isSelected
                  ? "bg-primary font-medium text-primary-foreground"
                  : "hover:bg-white/8",
                !isSelected && isToday && "ring-1 ring-primary/80",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          onClick={() => onSelect(toIsoDate(today))}
        >
          Hoje
        </button>
        {children}
      </div>
    </div>
  );
}

function PickerPopup({ children }: { children: ReactNode }) {
  return (
    <Popover.Portal>
      <Popover.Positioner
        className="z-50 outline-none"
        sideOffset={6}
        align="start"
      >
        <Popover.Popup
          className={cn(
            "glass-panel origin-(--transform-origin) rounded-2xl p-3 text-popover-foreground outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          )}
        >
          {children}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}

const triggerClass =
  "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30";

export function DatePicker({
  id,
  name,
  value,
  defaultValue = "",
  onValueChange,
  disabled,
  required,
  className,
  placeholder = "Escolher data",
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const current = value ?? uncontrolled;
  const label = formatTriggerDate(current);

  function commit(next: string) {
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        type="button"
        disabled={disabled}
        className={cn(triggerClass, !label && "text-muted-foreground", className)}
      >
        <span className="truncate">{label ?? placeholder}</span>
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      {name ? (
        <input type="hidden" name={name} value={current} required={required} />
      ) : null}
      <PickerPopup>
        <CalendarMonth
          key={open ? current || "open" : "closed"}
          selected={current}
          onSelect={commit}
        />
      </PickerPopup>
    </Popover.Root>
  );
}

function parseDateTime(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!match) return { date: "", hour: 9, minute: 0 };
  return {
    date: match[1] ?? "",
    hour: Number(match[2] ?? 9),
    minute: Number(match[3] ?? 0),
  };
}

function composeDateTime(date: string, hour: number, minute: number) {
  if (!date) return "";
  return `${date}T${pad(hour)}:${pad(minute)}`;
}

function TimePart({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={pad(value)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
        if (!digits) return;
        onChange(Math.min(max, Number(digits)));
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onChange(value >= max ? 0 : value + 1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onChange(value <= 0 ? max : value - 1);
        }
      }}
      className="h-8 w-10 rounded-lg border border-white/10 bg-white/5 text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );
}

export function DateTimePicker({
  id,
  name,
  value,
  defaultValue = "",
  onValueChange,
  disabled,
  required,
  className,
  placeholder = "Escolher data e hora",
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const initial = parseDateTime(value ?? defaultValue);
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [open, setOpen] = useState(false);
  const current = value ?? uncontrolled;
  const parsed = parseDateTime(current);
  const activeHour = parsed.date ? parsed.hour : hour;
  const activeMinute = parsed.date ? parsed.minute : minute;
  const dateLabel = formatTriggerDate(parsed.date);
  const label = dateLabel
    ? `${dateLabel}, ${pad(activeHour)}:${pad(activeMinute)}`
    : null;

  function commit(date: string, nextHour: number, nextMinute: number) {
    const next = composeDateTime(date, nextHour, nextMinute);
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        type="button"
        disabled={disabled}
        className={cn(triggerClass, !label && "text-muted-foreground", className)}
      >
        <span className="truncate">{label ?? placeholder}</span>
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      {name ? (
        <input type="hidden" name={name} value={current} required={required} />
      ) : null}
      <PickerPopup>
        <CalendarMonth
          key={open ? parsed.date || "open" : "closed"}
          selected={parsed.date}
          onSelect={(iso) => commit(iso, activeHour, activeMinute)}
        >
          <div className="flex items-center gap-1.5">
            <TimePart
              label="Hora"
              value={activeHour}
              max={23}
              onChange={(next) => {
                setHour(next);
                if (parsed.date) commit(parsed.date, next, activeMinute);
              }}
            />
            <span className="text-muted-foreground">:</span>
            <TimePart
              label="Minutos"
              value={activeMinute}
              max={59}
              onChange={(next) => {
                setMinute(next);
                if (parsed.date) commit(parsed.date, activeHour, next);
              }}
            />
          </div>
        </CalendarMonth>
      </PickerPopup>
    </Popover.Root>
  );
}
