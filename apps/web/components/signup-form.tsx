"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { createSignupAccount } from "@/lib/actions/auth";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/validation";
import { parseAge, parseGender } from "@/lib/auth/signup-profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildSignupDraftFromFields,
  OAuthSignInButtons,
} from "@/components/oauth-sign-in-buttons";
import { SignupProfileStep } from "@/components/signup-profile-step";

type SignupStep = "credentials" | "profile";

export function SignupForm({
  error: initialError,
  initialStep = "credentials",
  displayName,
}: {
  error?: string;
  initialStep?: SignupStep;
  displayName?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<SignupStep>(initialStep);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(initialError);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (step !== "profile") return;
    document.documentElement.classList.add("auth-signup-profile-step");
    return () => {
      document.documentElement.classList.remove("auth-signup-profile-step");
    };
  }, [step]);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    parseAge(age) != null &&
    parseGender(gender) != null &&
    isValidEmail(email) &&
    isValidPassword(password);

  function goToProfileStep() {
    setStep("profile");
    setError(undefined);
    // URL estável para refresh / middleware com sessão.
    router.replace("/login/signup?profile=1");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || pending) return;

    const fd = new FormData(e.currentTarget);
    setError(undefined);

    startTransition(async () => {
      const result = await createSignupAccount(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Mesma página: passo 2 (foto + Sobre ti), com sessão já criada.
      goToProfileStep();
    });
  }

  function composeLocalName() {
    return `${firstName.trim()} ${lastName.trim()}`.trim() || null;
  }

  if (step === "profile") {
    return (
      <SignupProfileStep
        displayName={displayName ?? composeLocalName()}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="age" className="text-base">
            Idade
          </Label>
          <Input
            id="age"
            name="age"
            type="number"
            inputMode="numeric"
            min={13}
            max={120}
            required
            value={age}
            onChange={(event) => setAge(event.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender" className="text-base">
            Sexo
          </Label>
          <select
            id="gender"
            name="gender"
            required
            value={gender}
            onChange={(event) => setGender(event.target.value)}
            className="flex h-12 w-full appearance-none rounded-md border border-input bg-background px-3 text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="" disabled>
              Selecionar
            </option>
            <option value="female">Feminino</option>
            <option value="male">Masculino</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-base">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 text-base"
        />
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

      <Button
        type="submit"
        size="lg"
        disabled={!canSubmit || pending}
        className={cn(
          "h-14 w-full text-base font-semibold transition-colors",
          canSubmit && !pending
            ? "bg-[var(--neuma-orange)] text-white hover:bg-[var(--neuma-orange)]/90"
            : "bg-white/12 text-foreground hover:bg-white/18 disabled:pointer-events-none disabled:opacity-100",
        )}
      >
        {pending ? "A criar conta…" : "Criar conta"}
      </Button>

      <OAuthSignInButtons
        intent="signup"
        nextPath="/login/signup?profile=1"
        dividerLabel="ou criar com"
        getSignupDraft={() =>
          buildSignupDraftFromFields({ firstName, lastName, age, gender })
        }
      />

      <p className="text-center text-sm text-muted-foreground">
        Já tens conta?{" "}
        <Link
          href="/login"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
