"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { toast } from "sonner";

import {
  createOneToOneInvite,
  type OneToOneBillingMode,
  type OneToOneIntervalMonths,
} from "@/lib/actions/one-to-one";
import { parseAge, parseGender } from "@/lib/auth/signup-profile";
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

type CadenceValue = "1" | "2" | "3" | "one_time";

function splitName(fullName: string | null) {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function parseCadence(value: CadenceValue): {
  billingMode: OneToOneBillingMode;
  intervalMonths: OneToOneIntervalMonths;
} {
  if (value === "one_time") {
    return { billingMode: "one_time", intervalMonths: 1 };
  }
  const months = Number(value) as OneToOneIntervalMonths;
  return {
    billingMode: "recurring",
    intervalMonths: ([1, 2, 3] as const).includes(months) ? months : 1,
  };
}

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

  const initialNames = splitName(fullName);
  const [formEmail, setFormEmail] = useState(email ?? "");
  const [firstName, setFirstName] = useState(initialNames.firstName);
  const [lastName, setLastName] = useState(initialNames.lastName);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<CadenceValue>("1");
  const [durationMonths, setDurationMonths] = useState("3");

  const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
  const canSubmit =
    formEmail.trim().includes("@") &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    parseAge(age) != null &&
    parseGender(gender) != null &&
    Number.isFinite(amountCents) &&
    amountCents >= 100 &&
    Number(durationMonths) >= 1;

  function resetForm() {
    const names = splitName(fullName);
    setFormEmail(email ?? "");
    setFirstName(names.firstName);
    setLastName(names.lastName);
    setAge("");
    setGender("");
    setAmount("");
    setCadence("1");
    setDurationMonths("3");
    setError(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);

    const ageNum = parseAge(age);
    const genderVal = parseGender(gender);
    if (ageNum == null || !genderVal) {
      setError("Indica idade e sexo.");
      return;
    }

    const { billingMode, intervalMonths } = parseCadence(cadence);

    startTransition(async () => {
      const result = await createOneToOneInvite({
        email: formEmail.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        age: ageNum,
        gender: genderVal,
        amountCents,
        billingMode,
        intervalMonths,
        durationMonths: Math.max(1, Math.floor(Number(durationMonths) || 1)),
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
              <Label htmlFor={`otoo-first-${submissionId}`}>Primeiro nome</Label>
              <Input
                id={`otoo-first-${submissionId}`}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`otoo-last-${submissionId}`}>Último nome</Label>
              <Input
                id={`otoo-last-${submissionId}`}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </div>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`otoo-age-${submissionId}`}>Idade</Label>
              <Input
                id={`otoo-age-${submissionId}`}
                type="number"
                inputMode="numeric"
                min={13}
                max={120}
                value={age}
                onChange={(event) => setAge(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`otoo-gender-${submissionId}`}>Sexo</Label>
              <select
                id={`otoo-gender-${submissionId}`}
                value={gender}
                onChange={(event) => setGender(event.target.value)}
                required
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="" disabled>
                  Selecionar
                </option>
                <option value="female">Feminino</option>
                <option value="male">Masculino</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor={`otoo-duration-${submissionId}`}>
                Duração (meses)
              </Label>
              <Input
                id={`otoo-duration-${submissionId}`}
                type="number"
                min={1}
                value={durationMonths}
                onChange={(event) => setDurationMonths(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`otoo-cadence-${submissionId}`}>Cadência</Label>
            <select
              id={`otoo-cadence-${submissionId}`}
              value={cadence}
              onChange={(event) =>
                setCadence(event.target.value as CadenceValue)
              }
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="1">Mensal</option>
              <option value="2">A cada 2 meses</option>
              <option value="3">A cada 3 meses</option>
              <option value="one_time">Valor total (pagamento único)</option>
            </select>
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
