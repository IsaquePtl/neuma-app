"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { updateStudentNotes } from "@/lib/actions/students";
import { cn } from "@/lib/utils";

/** Campo discreto de notas — guarda ao sair do campo (blur) ou ⌘/Ctrl+Enter. */
export function StudentNotesField({
  studentId,
  initialNotes,
  className,
}: {
  studentId: string;
  initialNotes: string | null;
  className?: string;
}) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [pending, startTransition] = useTransition();
  const savedRef = useRef(initialNotes ?? "");

  useEffect(() => {
    setValue(initialNotes ?? "");
    savedRef.current = initialNotes ?? "";
  }, [initialNotes]);

  function save(next: string) {
    const trimmed = next.trim();
    const normalized = trimmed || "";
    if (normalized === (savedRef.current ?? "").trim()) return;

    const fd = new FormData();
    fd.set("student_id", studentId);
    fd.set("internal_notes", next);
    startTransition(async () => {
      await updateStudentNotes(fd);
      savedRef.current = next;
    });
  }

  return (
    <div className={cn("min-w-0", className)}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => save(value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        rows={2}
        placeholder="Notas…"
        aria-label="Notas"
        disabled={pending}
        className={cn(
          "w-full resize-none rounded-xl border-0 bg-white/[0.04] px-3 py-2",
          "text-sm leading-relaxed text-foreground/90 placeholder:text-muted-foreground/50",
          "outline-none ring-1 ring-white/8 transition-[box-shadow,background-color]",
          "hover:bg-white/[0.06] focus:bg-white/[0.07] focus:ring-white/18",
          "disabled:opacity-60",
        )}
      />
    </div>
  );
}
