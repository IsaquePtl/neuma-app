"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { redeemOneToOneInvite } from "@/lib/actions/one-to-one";
import { PASSWORD_MIN_LENGTH, isValidPassword } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function splitName(fullName: string | null) {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function OneToOneRedeemForm({
  token,
  email,
  fullName,
}: {
  token: string;
  email: string;
  fullName: string | null;
}) {
  const initialNames = splitName(fullName);
  const [firstName, setFirstName] = useState(initialNames.firstName);
  const [lastName, setLastName] = useState(initialNames.lastName);
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isValidPassword(password);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);
    setExistingAccount(false);

    startTransition(async () => {
      const result = await redeemOneToOneInvite({
        token,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      if (!result.ok) {
        if (/já existe uma conta/i.test(result.error)) {
          setExistingAccount(true);
        }
        setError(result.error);
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(
          "Conta criada, mas não foi possível entrar automaticamente. Entra com o teu email e password.",
        );
        return;
      }

      window.location.href = result.checkoutUrl;
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-base">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          disabled
          className="h-12 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="first_name" className="text-base">
            Primeiro nome
          </Label>
          <Input
            id="first_name"
            name="first_name"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name" className="text-base">
            Último nome
          </Label>
          <Input
            id="last_name"
            name="last_name"
            autoComplete="family-name"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="h-12 text-base"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-base">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 text-base"
        />
      </div>

      {error ? (
        <p className="text-base text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {existingAccount ? (
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Entra na tua conta
          </Link>{" "}
          e volta a abrir este link para continuar.
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={!canSubmit || pending}
        className={cn(
          "h-14 w-full text-base font-semibold transition-colors",
          canSubmit && !pending
            ? "bg-[var(--neuma-orange)] text-white hover:bg-[var(--neuma-orange)]/90"
            : "bg-white/12 text-foreground",
        )}
      >
        {pending ? "A activar…" : "Criar conta e continuar"}
      </Button>
    </form>
  );
}
