"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  setStudentCanBookSessions,
  setStudentOnboarding,
  updateStudentProfile,
} from "@/lib/actions/students";
import type { StudentProfile } from "@/lib/students/queries";
import { RemoveStudentControl } from "@/components/remove-student-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function StudentProfileEditor({
  student,
  embedded = false,
}: {
  student: StudentProfile;
  embedded?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [canBookSessions, setCanBookSessions] = useState(
    student.can_book_sessions,
  );

  useEffect(() => {
    setCanBookSessions(student.can_book_sessions);
  }, [student.can_book_sessions]);

  function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateStudentProfile(fd);
      toast.success("Perfil atualizado");
    });
  }

  function saveOnboarding(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await setStudentOnboarding(fd);
      toast.success("Onboarding atualizado");
    });
  }

  function toggleCanBookSessions(next: boolean) {
    const previous = canBookSessions;
    setCanBookSessions(next);
    const fd = new FormData();
    fd.set("student_id", student.id);
    if (next) fd.set("can_book_sessions", "on");
    startTransition(async () => {
      try {
        await setStudentCanBookSessions(fd);
        toast.success(
          next
            ? "Agendamento de sessões ativado"
            : "Agendamento de sessões desativado",
        );
      } catch {
        setCanBookSessions(previous);
        toast.error("Não foi possível atualizar o agendamento");
      }
    });
  }

  return (
    <div
      className={cn(
        "space-y-4",
        embedded &&
          "space-y-4 divide-y divide-white/8 [&>*]:pt-4 [&>*:first-child]:pt-0",
      )}
    >
      <section
        className={cn(
          !embedded &&
            "rounded-2xl border border-white/10 bg-white/[0.03] p-5",
        )}
      >
        {!embedded ? (
          <h2 className="mb-3 font-semibold">Dados do aluno</h2>
        ) : (
          <h3 className="mb-2 text-sm font-medium">Dados do aluno</h3>
        )}
        <form onSubmit={saveProfile} className="space-y-3">
          <input type="hidden" name="student_id" value={student.id} />
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nome</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={student.full_name ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={student.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              Identidade de login — não editável aqui.
            </p>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            Guardar nome
          </Button>
        </form>
      </section>

      <section
        className={cn(
          !embedded &&
            "rounded-2xl border border-white/10 bg-white/[0.03] p-5",
        )}
      >
        <h3 className="mb-2 text-sm font-medium">Onboarding</h3>
        <form onSubmit={saveOnboarding} className="space-y-3">
          <input type="hidden" name="student_id" value={student.id} />
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="onboarding_completed"
              defaultChecked={student.onboarding_completed}
              className="size-4 accent-[var(--neuma-coral)]"
            />
            Onboarding concluído
          </label>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Guardar onboarding
          </Button>
        </form>
      </section>

      <section
        className={cn(
          !embedded &&
            "rounded-2xl border border-white/10 bg-white/[0.03] p-5",
        )}
      >
        <h3 className="mb-2 text-sm font-medium">Sessões</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="can_book_sessions" className="text-sm font-normal">
              Agendamento de sessões
            </Label>
            <p className="text-xs text-muted-foreground">
              Permite ao aluno usar o botão de agendar no Mentor.
            </p>
          </div>
          <Switch
            id="can_book_sessions"
            checked={canBookSessions}
            onCheckedChange={toggleCanBookSessions}
            disabled={pending}
            aria-label="Agendamento de sessões"
          />
        </div>
      </section>

      <RemoveStudentControl student={student} embedded={embedded} />
    </div>
  );
}
