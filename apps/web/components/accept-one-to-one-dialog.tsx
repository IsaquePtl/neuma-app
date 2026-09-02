"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { toast } from "sonner";

import { createOneToOneInvite } from "@/lib/actions/one-to-one";
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
import { Textarea } from "@/components/ui/textarea";

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Link copiado");
  } catch {
    toast.error("Não foi possível copiar o link");
  }
}

export function AcceptOneToOneDialog({
  submissionId,
  email,
  fullName,
  triggerClassName,
  triggerSize = "sm",
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  submissionId: string;
  email: string | null;
  fullName: string | null;
  triggerClassName?: string;
  triggerSize?: "sm" | "default";
  /** Modo controlado: omite o trigger próprio (ex. dentro de um dropdown). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = controlled ? (onOpenChangeProp ?? (() => {})) : setOpenState;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formEmail, setFormEmail] = useState(email ?? "");
  const [formName, setFormName] = useState(fullName ?? "");
  const [amount, setAmount] = useState("");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">(
    "month",
  );
  const [intervalCount, setIntervalCount] = useState("1");
  const [notes, setNotes] = useState("");

  const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
  const canSubmit =
    formEmail.trim().includes("@") &&
    formName.trim().length > 0 &&
    Number.isFinite(amountCents) &&
    amountCents >= 100 &&
    Number(intervalCount) >= 1;

  function resetForm() {
    setFormEmail(email ?? "");
    setFormName(fullName ?? "");
    setAmount("");
    setBillingInterval("month");
    setIntervalCount("1");
    setNotes("");
    setError(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);

    startTransition(async () => {
      const result = await createOneToOneInvite({
        email: formEmail.trim(),
        fullName: formName.trim(),
        amountCents,
        interval: billingInterval,
        intervalCount: Number(intervalCount) || 1,
        notes: notes.trim() || undefined,
        sourceSubmissionId: submissionId,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOpen(false);
      toast.success("Convite Neuma 1:1 criado e enviado", {
        description: result.inviteUrl,
        action: {
          label: "Copiar link",
          onClick: () => copyToClipboard(result.inviteUrl),
        },
      });
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetForm();
      }}
    >
      {controlled ? null : (
        <DialogTrigger
          render={
            <Button
              type="button"
              size={triggerSize}
              className={triggerClassName ?? "gap-1"}
            />
          }
        >
          <HeartHandshake className="size-3.5" /> Aceitar 1:1
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aceitar como Neuma 1:1</DialogTitle>
          <DialogDescription>
            Cria um preço à medida na Stripe e envia o convite de mentoria
            individual por email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`otoo-name-${submissionId}`}>Nome</Label>
              <Input
                id={`otoo-name-${submissionId}`}
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`otoo-email-${submissionId}`}>Email</Label>
              <Input
                id={`otoo-email-${submissionId}`}
                type="email"
                value={formEmail}
                onChange={(event) => setFormEmail(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-2">
              <Label htmlFor={`otoo-amount-${submissionId}`}>Valor (€)</Label>
              <Input
                id={`otoo-amount-${submissionId}`}
                inputMode="decimal"
                placeholder="80"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="col-span-1 space-y-2">
              <Label htmlFor={`otoo-interval-${submissionId}`}>Cadência</Label>
              <select
                id={`otoo-interval-${submissionId}`}
                value={billingInterval}
                onChange={(event) =>
                  setBillingInterval(event.target.value as "month" | "year")
                }
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="month">Mês</option>
                <option value="year">Ano</option>
              </select>
            </div>
            <div className="col-span-1 space-y-2">
              <Label htmlFor={`otoo-interval-count-${submissionId}`}>
                A cada
              </Label>
              <Input
                id={`otoo-interval-count-${submissionId}`}
                type="number"
                min={1}
                value={intervalCount}
                onChange={(event) => setIntervalCount(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`otoo-notes-${submissionId}`}>
              Notas (opcional)
            </Label>
            <Textarea
              id={`otoo-notes-${submissionId}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Contexto interno sobre este 1:1…"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || pending}>
              {pending ? "A criar…" : "Criar convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
