"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { removeStudent } from "@/lib/actions/students";
import type { StudentProfile } from "@/lib/students/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Remoção de aluno com dupla confirmação:
 * 1) aviso + Continuar
 * 2) escrever o email exacto + Remover definitivamente
 */
export function RemoveStudentControl({
  student,
  embedded = false,
}: {
  student: StudentProfile;
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const email = (student.email ?? "").trim();
  const label = student.full_name?.trim() || email || "este aluno";
  const emailMatches =
    email.length > 0 && confirmEmail.trim().toLowerCase() === email.toLowerCase();

  function reset() {
    setStep(1);
    setConfirmEmail("");
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function confirmRemove() {
    if (!emailMatches) return;
    startTransition(async () => {
      const result = await removeStudent({
        studentId: student.id,
        confirmEmail,
      });
      // redirect no servidor → normalmente não chega aqui
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <section
      className={cn(
        "space-y-3",
        !embedded &&
          "rounded-2xl border border-destructive/25 bg-destructive/5 p-5",
        embedded && "border-t border-white/8 pt-4",
      )}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-destructive">Zona de perigo</h3>
        <p className="text-xs text-muted-foreground">
          Remove permanentemente a conta, o percurso e os dados associados.
        </p>
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger
          render={
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="w-full sm:w-auto"
            />
          }
        >
          Remover
        </DialogTrigger>

        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Remover {label}?</DialogTitle>
                <DialogDescription>
                  Esta ação apaga a conta de autenticação e o perfil do aluno.
                  Percurso, check-ins e dados ligados também desaparecem. Não
                  dá para reverter.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending || !email}
                  onClick={() => setStep(2)}
                >
                  Continuar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Confirmação final</DialogTitle>
                <DialogDescription>
                  Para remover {label}, escreve o email exacto do aluno:
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirm-student-email">Email do aluno</Label>
                <Input
                  id="confirm-student-email"
                  type="email"
                  autoComplete="off"
                  autoFocus
                  placeholder={email || "email@exemplo.com"}
                  value={confirmEmail}
                  disabled={pending}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Tem de coincidir com <span className="font-medium text-foreground">{email || "—"}</span>
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setStep(1)}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending || !emailMatches}
                  onClick={confirmRemove}
                >
                  {pending ? "A remover…" : "Remover definitivamente"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
