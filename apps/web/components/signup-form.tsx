"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";

import { createSignupAccount } from "@/lib/actions/auth";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/validation";
import { parseAge, parseGender } from "@/lib/auth/signup-profile";
import {
  hasSignupFinishingCookie,
  readSignupWizardStep,
  setSignupFinishingCookie,
  writeSignupWizardStep,
  type SignupWizardStep,
} from "@/lib/auth/signup-wizard";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildSignupDraftFromFields,
  OAuthSignInButtons,
} from "@/components/oauth-sign-in-buttons";
import { SignupProfileStep } from "@/components/signup-profile-step";

const STEP_META: Record<
  SignupWizardStep,
  { title: string; subtitle?: string }
> = {
  identity: {
    title: "Criar conta",
    subtitle: "1 de 3 — Quem és?",
  },
  credentials: {
    title: "A tua conta",
    subtitle: "2 de 3 — Email e password",
  },
  profile: {
    title: "O teu perfil",
    subtitle: "3 de 3 — Foto e bio (opcional)",
  },
};

export function SignupWizard({
  error: initialError,
  onStepChange,
}: {
  error?: string;
  onStepChange?: (step: SignupWizardStep) => void;
}) {
  const [step, setStepState] = useState<SignupWizardStep>("identity");
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(initialError);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function setStep(next: SignupWizardStep) {
    setStepState(next);
    writeSignupWizardStep(next);
    onStepChange?.(next);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const saved = readSignupWizardStep();
      const finishing =
        hasSignupFinishingCookie() || saved === "profile" || Boolean(user);

      if (user && finishing) {
        setSignupFinishingCookie();
        if (!cancelled) setStep("profile");
      } else if (saved === "credentials" || saved === "identity") {
        if (!cancelled) setStep(saved);
      }

      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "profile") return;
    document.documentElement.classList.add("auth-signup-profile-step");
    return () => {
      document.documentElement.classList.remove("auth-signup-profile-step");
    };
  }, [step]);

  const identityValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    parseAge(age) != null &&
    parseGender(gender) != null;

  const credentialsValid =
    identityValid && isValidEmail(email) && isValidPassword(password);

  function composeLocalName() {
    return `${firstName.trim()} ${lastName.trim()}`.trim() || null;
  }

  function goToProfileStep() {
    setSignupFinishingCookie();
    setStep("profile");
    setError(undefined);
  }

  function onCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!credentialsValid || pending) return;

    const fd = new FormData(e.currentTarget);
    setError(undefined);

    startTransition(async () => {
      const result = await createSignupAccount(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goToProfileStep();
    });
  }

  if (!hydrated) {
    return (
      <div className="min-h-[12rem] animate-pulse rounded-xl bg-white/[0.04]" />
    );
  }

  const meta = STEP_META[step];

  if (step === "profile") {
    return (
      <div key="profile" className="animate-fade-in">
        <div className="mb-5">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {meta.title}
          </h1>
          {meta.subtitle ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{meta.subtitle}</p>
          ) : null}
        </div>
        <SignupProfileStep displayName={composeLocalName()} />
      </div>
    );
  }

  return (
    <div key={step} className="animate-fade-in">
      <div className="mb-5">
        {step === "credentials" ? (
          <button
            type="button"
            onClick={() => setStep("identity")}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Voltar
          </button>
        ) : null}
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {meta.title}
        </h1>
        {meta.subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{meta.subtitle}</p>
        ) : null}
      </div>

      {step === "identity" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!identityValid) return;
            setStep("credentials");
            setError(undefined);
          }}
          className="space-y-4"
        >
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
                onChange={(e) => setFirstName(e.target.value)}
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
                onChange={(e) => setLastName(e.target.value)}
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
                onChange={(e) => setAge(e.target.value)}
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
                onChange={(e) => setGender(e.target.value)}
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

          {error ? (
            <p className="text-base text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={!identityValid}
            className={cn(
              "h-14 w-full text-base font-semibold transition-colors",
              identityValid
                ? "bg-[var(--neuma-orange)] text-white hover:bg-[var(--neuma-orange)]/90"
                : "bg-white/12 text-foreground",
            )}
          >
            Continuar
          </Button>

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
      ) : (
        <form onSubmit={onCredentialsSubmit} className="space-y-4">
          <input type="hidden" name="first_name" value={firstName} />
          <input type="hidden" name="last_name" value={lastName} />
          <input type="hidden" name="age" value={age} />
          <input type="hidden" name="gender" value={gender} />

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
              onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={!credentialsValid || pending}
            className={cn(
              "h-14 w-full text-base font-semibold transition-colors",
              credentialsValid && !pending
                ? "bg-[var(--neuma-orange)] text-white hover:bg-[var(--neuma-orange)]/90"
                : "bg-white/12 text-foreground",
            )}
          >
            {pending ? "A criar conta…" : "Criar conta"}
          </Button>

          <OAuthSignInButtons
            intent="signup"
            nextPath="/login/signup"
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
      )}
    </div>
  );
}

/** @deprecated use SignupWizard */
export const SignupForm = SignupWizard;
