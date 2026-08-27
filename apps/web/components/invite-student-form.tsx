"use client";

import { useState, useTransition } from "react";
import { UserPlus, Copy, Check } from "lucide-react";

import { inviteStudent } from "@/lib/actions/invites";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteStudentForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await inviteStudent(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ email: res.email, tempPassword: res.tempPassword });
    });
  }

  async function copyCreds() {
    if (!result) return;
    const text = `Email: ${result.email}\nPassword: ${result.tempPassword}\nLogin: ${typeof window !== "undefined" ? window.location.origin + "/login" : "/login"}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open && !result) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="gap-2">
        <UserPlus className="size-4" /> Convidar aluno
      </Button>
    );
  }

  if (result) {
    return (
      <Card className="space-y-4 p-5">
        <div>
          <p className="font-medium">Aluno criado</p>
          <p className="text-sm text-muted-foreground">
            Envia estas credenciais ao aluno (e pede para mudar a password no
            primeiro acesso).
          </p>
        </div>
        <div className="space-y-1 rounded-xl bg-secondary/50 p-4 font-mono text-sm">
          <p>Email: {result.email}</p>
          <p>Password: {result.tempPassword}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copyCreds} className="gap-2">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setResult(null);
              setOpen(false);
            }}
          >
            Fechar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={onSubmit} className="space-y-4">
        <div>
          <p className="font-medium">Convidar aluno</p>
          <p className="text-sm text-muted-foreground">
            Cria a conta com password temporaria.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome</Label>
            <Input id="full_name" name="full_name" required placeholder="Joao Silva" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="joao@email.com"
            />
          </div>
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "A criar..." : "Criar conta"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
