"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  linkTallySubmissionToStudent,
  markTallySubmissionProcessed,
} from "@/lib/actions/tally";
import type { StudentOption } from "@/components/tally-submission-row-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { requestMentorBadgesRefresh } from "@/lib/mentor-badges-client";
import { cn } from "@/lib/utils";

export function OnboardingIntakeActions({
  submissionId,
  students,
  linkedStudentId,
  status,
}: {
  submissionId: string;
  students: StudentOption[];
  linkedStudentId: string | null;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkOpen, setLinkOpen] = useState(false);
  const [studentId, setStudentId] = useState(linkedStudentId ?? "");
  const linked = Boolean(linkedStudentId);
  const confirmed = status === "processed";

  function confirm() {
    if (!linked) {
      toast.error("Vincula a um aluno antes de confirmar.");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", submissionId);
        await markTallySubmissionProcessed(fd);
        requestMentorBadgesRefresh();
        toast.success("Onboarding confirmado no perfil do aluno");
        router.push(`/studio/students/${linkedStudentId}`);
        router.refresh();
      } catch {
        toast.error("Não foi possível confirmar");
      }
    });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          size="lg"
          variant={linked ? "secondary" : "default"}
          disabled={pending || linked}
          className={cn(
            "h-14 w-full gap-2 text-base font-semibold",
            linked && "opacity-90",
          )}
          onClick={() => {
            if (linked) return;
            setStudentId("");
            setLinkOpen(true);
          }}
        >
          <UserPlus className="size-5" />
          {linked ? "Vinculado" : "Vincular a aluno"}
        </Button>

        <Button
          type="button"
          size="lg"
          variant={confirmed ? "secondary" : "default"}
          disabled={pending || !linked || confirmed}
          className="h-14 w-full gap-2 text-base font-semibold"
          onClick={confirm}
        >
          <Check className="size-5" />
          {confirmed ? "Confirmado" : "Confirmar"}
        </Button>
      </div>

      {linkedStudentId && !confirmed ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-sm text-muted-foreground">
            Já está ligado ao aluno. Confirma para marcar como tratado no perfil.
          </p>
          <Button
            render={<Link href={`/studio/students/${linkedStudentId}`} />}
            nativeButton={false}
            variant="outline"
          >
            Abrir perfil do aluno
          </Button>
        </div>
      ) : null}

      {linkedStudentId && confirmed ? (
        <div className="flex justify-center">
          <Button
            render={<Link href={`/studio/students/${linkedStudentId}`} />}
            nativeButton={false}
            variant="outline"
          >
            Abrir perfil do aluno
          </Button>
        </div>
      ) : null}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular onboarding</DialogTitle>
            <DialogDescription>
              Associa esta resposta ao perfil do aluno na Neuma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`link-student-${submissionId}`}>Aluno</Label>
            <select
              id={`link-student-${submissionId}`}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Selecionar aluno…</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name || student.email || student.id}
                  {student.email && student.full_name
                    ? ` · ${student.email}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={pending || !studentId}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const fd = new FormData();
                    fd.set("id", submissionId);
                    fd.set("student_id", studentId);
                    await linkTallySubmissionToStudent(fd);
                    setLinkOpen(false);
                    requestMentorBadgesRefresh();
                    toast.success("Vinculado ao aluno");
                    router.refresh();
                  } catch {
                    toast.error("Não foi possível vincular");
                  }
                });
              }}
            >
              {pending ? "A vincular…" : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
