"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTallySubmission,
  linkTallySubmissionToStudent,
} from "@/lib/actions/tally";
import { requestMentorBadgesRefresh } from "@/lib/mentor-badges-client";
import { AcceptOneToOneDialog } from "@/components/accept-one-to-one-dialog";
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
import { cn } from "@/lib/utils";

const fatActionClass = "h-10 gap-2 px-4 text-sm";

export type StudentOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export function TallySubmissionRowActions({
  submissionId,
  students,
  linkedStudentId,
  showView = true,
  submissionKind,
  emphasizeLink = false,
  respondentEmail,
  respondentName,
}: {
  submissionId: string;
  students: StudentOption[];
  linkedStudentId?: string | null;
  showView?: boolean;
  submissionKind?: string | null;
  /** Destaca o botão Vincular quando ainda não há aluno. */
  emphasizeLink?: boolean;
  /** Necessários para propor Neuma 1:1. */
  respondentEmail?: string | null;
  respondentName?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkOpen, setLinkOpen] = useState(false);
  const [studentId, setStudentId] = useState(linkedStudentId ?? "");

  function runAction(
    action: () => Promise<void>,
    success: string,
    errorFallback: string,
  ) {
    startTransition(async () => {
      try {
        await action();
        requestMentorBadgesRefresh();
        toast.success(success);
        router.refresh();
      } catch {
        toast.error(errorFallback);
      }
    });
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
        {!linkedStudentId && submissionKind === "onboarding" ? (
          <AcceptOneToOneDialog
            submissionId={submissionId}
            email={respondentEmail ?? null}
            fullName={respondentName ?? null}
            triggerSize="default"
            triggerClassName={cn(
              fatActionClass,
              "border-transparent bg-[var(--neuma-coral)]/15 text-[var(--neuma-coral)] hover:bg-[var(--neuma-coral)]/25",
            )}
          />
        ) : null}

        {linkedStudentId ? (
          <Button
            variant="ghost"
            render={<Link href={`/studio/students/${linkedStudentId}`} />}
            nativeButton={false}
            className={cn(fatActionClass, "hidden sm:inline-flex")}
          >
            Abrir ficha
          </Button>
        ) : null}
        {emphasizeLink || !linkedStudentId ? (
          <Button
            type="button"
            variant={linkedStudentId ? "outline" : "default"}
            className={fatActionClass}
            onClick={() => {
              setStudentId(linkedStudentId ?? "");
              setLinkOpen(true);
            }}
          >
            <UserPlus className="size-4" />
            {linkedStudentId ? "Associar" : "Vincular"}
          </Button>
        ) : null}

        {showView ? (
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href={`/studio/intake/${submissionId}`} />}
            nativeButton={false}
            aria-label="Ver respostas"
            title="Ver respostas"
          >
            <Eye className="size-4" />
          </Button>
        ) : null}

        <Button
          type="button"
          variant="destructive"
          className={fatActionClass}
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm("Apagar esta submissão de forma permanente?")
            ) {
              return;
            }
            runAction(
              async () => {
                const fd = new FormData();
                fd.set("id", submissionId);
                await deleteTallySubmission(fd);
                router.push("/studio/journeys/onboardings");
              },
              "Submissão apagada",
              "Não foi possível apagar",
            );
          }}
        >
          <Trash2 className="size-4" /> Apagar
        </Button>
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Associar a aluno</DialogTitle>
            <DialogDescription>
              {submissionKind === "checkin"
                ? "Liga este check-in a um aluno. Se houver bloco ativo, entra automaticamente na fila Avaliar."
                : "Liga esta resposta a um aluno já existente na Neuma."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`student-${submissionId}`}>Aluno</Label>
            <select
              id={`student-${submissionId}`}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                    const result = await linkTallySubmissionToStudent(fd);
                    setLinkOpen(false);
                    // Check-in ligado cria pending; onboarding linked continua no badge.
                    requestMentorBadgesRefresh();

                    if (result.checkInId) {
                      toast.success("Check-in ligado — pronto a avaliar");
                      router.push(`/studio/checkins/${result.checkInId}`);
                      return;
                    }
                    if (result.needsActiveNode) {
                      toast.message(
                        "Aluno associado. Ativa um bloco no percurso para avaliar.",
                        {
                          action: {
                            label: "Abrir ficha",
                            onClick: () =>
                              router.push(
                                `/studio/students/${result.studentId}`,
                              ),
                          },
                        },
                      );
                      router.refresh();
                      return;
                    }
                    toast.success("Associado ao aluno", {
                      action: {
                        label: "Abrir ficha",
                        onClick: () =>
                          router.push(`/studio/students/${result.studentId}`),
                      },
                    });
                    router.refresh();
                  } catch {
                    toast.error("Não foi possível associar");
                  }
                });
              }}
            >
              {pending ? "A associar…" : "Associar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
