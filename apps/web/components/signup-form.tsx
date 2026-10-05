"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";

import {
  completeSignupProfile,
  createSignupAccount,
  setSignupPassword,
} from "@/lib/actions/auth";
import { createSignupLead } from "@/lib/actions/signup-leads";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/validation";
import { namesFromOAuthMetadata } from "@/lib/auth/signup-complete";
import {
  parseAge,
  parseGender,
  readSignupProfileDraft,
  clearSignupProfileDraft,
} from "@/lib/auth/signup-profile";
import {
  hasSignupFinishingCookie,
  readSignupLeadToken,
  readSignupWizardStep,
  setSignupFinishingCookie,
  writeSignupLeadToken,
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
import { PlanPicker } from "@/components/plan-picker";

const STEP_META: Record<
  SignupWizardStep,
  { title: string; subtitle?: string; oauthSubtitle?: string }
> = {
  identity: {
    title: "Criar conta",
    subtitle: "1 de 4 — Identificação",
    oauthSubtitle: "1 de 3 — Identificação",
  },
  plan: {
    title: "O teu plano",
    subtitle: "2 de 4 — Subscrição",
    oauthSubtitle: "2 de 3 — Subscrição",
  },
  credentials: {
    title: "Definir palavra-passe",
    subtitle: "3 de 4 — Acesso",
  },
  profile: {
    title: "O teu perfil",
    subtitle: "4 de 4 — Perfil",
    oauthSubtitle: "3 de 3 — Perfil",
  },
};

function isOAuthUser(user: {
  app_metadata?: Record<string, unknown>;
  identities?: { provider: string }[] | null;
}): boolean {
  const provider = user.app_metadata?.provider;
  if (typeof provider === "string" && provider !== "email") return true;
  return (user.identities ?? []).some((i) => i.provider !== "email");
}

export function SignupWizard({
  error: initialError,
  oauthFromLogin = false,
  billingEnabled = false,
  resumeLead = null,
  onStepChange,
}: {
  error?: string;
  oauthFromLogin?: boolean;
  billingEnabled?: boolean;
  /** Lead válido de ?resume= — aterra no passo plano. */
  resumeLead?: {
    email: string;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
    resumeToken: string;
  } | null;
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
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [oauthMode, setOauthMode] = useState(oauthFromLogin);
  const [leadToken, setLeadToken] = useState<string | null>(
    resumeLead?.resumeToken ?? null,
  );

  function setStep(next: SignupWizardStep) {
    setStepState(next);
    writeSignupWizardStep(next);
    onStepChange?.(next);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Retoma por email (?resume=) — sem sessão Auth.
      if (resumeLead && billingEnabled) {
        writeSignupLeadToken(resumeLead.resumeToken);
        setSignupFinishingCookie();
        writeSignupWizardStep("plan");
        if (!cancelled) {
          setLeadToken(resumeLead.resumeToken);
          setFirstName(resumeLead.firstName);
          setLastName(resumeLead.lastName);
          setEmail(resumeLead.email);
          setAge(String(resumeLead.age));
          setGender(resumeLead.gender);
          setStep("plan");
          setHydrated(true);
        }
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const saved = readSignupWizardStep();
      const draft = readSignupProfileDraft();
      const storedLeadToken = readSignupLeadToken();
      const finishing =
        hasSignupFinishingCookie() ||
        saved === "profile" ||
        saved === "plan" ||
        saved === "credentials" ||
        Boolean(user) ||
        Boolean(storedLeadToken);
      const fromLoginOAuth = oauthFromLogin && finishing && Boolean(user);
      const oauth = Boolean(user && isOAuthUser(user));

      if (fromLoginOAuth || oauth) {
        setOauthMode(true);
      }

      // Lead em sessionStorage (sem auth) — voltar ao passo plano.
      if (
        !user &&
        storedLeadToken &&
        billingEnabled &&
        (saved === "plan" || finishing)
      ) {
        setSignupFinishingCookie();
        if (!cancelled) {
          setLeadToken(storedLeadToken);
          setStep("plan");
          setHydrated(true);
        }
        return;
      }

      if (user && finishing) {
        setSignupFinishingCookie();

        if (draft) {
          const draftResult = await completeSignupProfile(draft);
          if (draftResult.ok) clearSignupProfileDraft();
        }

        if (saved === "profile") {
          if (!cancelled) setStep("profile");
        } else if (saved === "credentials") {
          // Pós-Stripe (email) ou billing off: definir password.
          // OAuth não precisa deste passo.
          if (!cancelled) {
            setStep(oauth ? "profile" : "credentials");
          }
        } else if (saved === "plan") {
          if (!billingEnabled) {
            if (!cancelled) setStep(oauth ? "profile" : "credentials");
          } else if (!cancelled) {
            setStep("plan");
          }
        } else if (fromLoginOAuth) {
          const { firstName: fn, lastName: ln } = namesFromOAuthMetadata(
            user.user_metadata as Record<string, unknown>,
          );
          if (!cancelled) {
            if (fn) setFirstName(fn);
            if (ln) setLastName(ln);
            if (user.email) setEmail(user.email);
            setStep("identity");
          }
        } else if (!cancelled) {
          // OAuth / conta já criada — avançar para plano / password / perfil.
          if (billingEnabled) setStep("plan");
          else setStep(oauth ? "profile" : "credentials");
        }
      } else if (saved === "identity") {
        if (!cancelled) setStep(saved);
      }

      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthFromLogin, resumeLead]);

  useEffect(() => {
    if (step !== "profile") return;
    document.documentElement.classList.add("auth-signup-profile-step");
    return () => {
      document.documentElement.classList.remove("auth-signup-profile-step");
    };
  }, [step]);

  const identityValid =
    isValidEmail(email) &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    parseAge(age) != null &&
    parseGender(gender) != null;

  const credentialsValid =
    isValidPassword(password) && password === passwordConfirm;

  function composeLocalName() {
    return `${firstName.trim()} ${lastName.trim()}`.trim() || null;
  }

  function goAfterIdentity() {
    setSignupFinishingCookie();
    setStep(billingEnabled ? "plan" : "credentials");
    setError(undefined);
  }

  function onIdentitySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!identityValid || pending) return;

    // OAuth: só completa perfil e segue (já há sessão).
    if (oauthMode) {
      const ageNum = parseAge(age);
      const genderVal = parseGender(gender);
      if (ageNum == null || !genderVal) return;

      setError(undefined);
      startTransition(async () => {
        const result = await completeSignupProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          age: ageNum,
          gender: genderVal,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        goAfterIdentity();
      });
      return;
    }

    const fd = new FormData(e.currentTarget);
    setError(undefined);

    startTransition(async () => {
      if (billingEnabled) {
        // Billing on: só lead de marketing — conta Auth só após pagamento.
        const result = await createSignupLead(fd);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        writeSignupLeadToken(result.resumeToken);
        setLeadToken(result.resumeToken);
        goAfterIdentity();
        return;
      }

      // Billing off: cria conta de imediato (fluxo antigo).
      const result = await createSignupAccount(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goAfterIdentity();
    });
  }

  function onCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!credentialsValid || pending) return;
    setError(undefined);

    startTransition(async () => {
      const result = await setSignupPassword({
        password,
        confirm: passwordConfirm,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStep("profile");
      setError(undefined);
    });
  }

  if (!hydrated) {
    return (
      <div className="min-h-[12rem] animate-pulse rounded-xl bg-white/[0.04]" />
    );
  }

  const meta = STEP_META[step];
  const stepSubtitle =
    oauthMode && meta.oauthSubtitle ? meta.oauthSubtitle : meta.subtitle;

  if (step === "plan") {
    return (
      <div key="plan" className="animate-fade-in">
        <div className="mb-5">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {meta.title}
          </h1>
          {stepSubtitle ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{stepSubtitle}</p>
          ) : null}
        </div>
        <PlanPicker
          title="Escolhe o teu plano"
          cancelReturnPath={
            leadToken
              ? `/login/signup?resume=${encodeURIComponent(leadToken)}`
              : "/login/signup"
          }
          signupResumeToken={leadToken}
        />
      </div>
    );
  }

  if (step === "profile") {
    return (
      <div key="profile" className="animate-fade-in">
        <div className="mb-5">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {meta.title}
          </h1>
          {stepSubtitle ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{stepSubtitle}</p>
          ) : null}
        </div>
        <SignupProfileStep displayName={composeLocalName()} />
      </div>
    );
  }

  if (step === "credentials") {
    return (
      <div key="credentials" className="animate-fade-in">
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setStep(billingEnabled ? "plan" : "identity")}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Voltar
          </button>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {meta.title}
          </h1>
          {stepSubtitle ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{stepSubtitle}</p>
          ) : null}
        </div>

        <form onSubmit={onCredentialsSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">
              Palavra-passe
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

          <div className="space-y-2">
            <Label htmlFor="password_confirm" className="text-base">
              Confirmar palavra-passe
            </Label>
            <Input
              id="password_confirm"
              name="password_confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
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
            {pending ? "A guardar…" : "Continuar"}
          </Button>
        </form>
      </div>
    );
  }

  // identity
  return (
    <div key="identity" className="animate-fade-in">
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {meta.title}
        </h1>
        {stepSubtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{stepSubtitle}</p>
        ) : null}
        {oauthMode ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Google conectado — falta completar o teu perfil.
          </p>
        ) : null}
      </div>

      <form onSubmit={onIdentitySubmit} className="space-y-4">
        {!oauthMode ? (
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
        ) : (
          <input type="hidden" name="email" value={email} />
        )}

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
          disabled={
            (!oauthMode && !identityValid) ||
            (oauthMode &&
              !(
                firstName.trim() &&
                lastName.trim() &&
                parseAge(age) != null &&
                parseGender(gender) != null
              )) ||
            pending
          }
          className={cn(
            "h-14 w-full text-base font-semibold transition-colors",
            (oauthMode
              ? firstName.trim() &&
                lastName.trim() &&
                parseAge(age) != null &&
                parseGender(gender) != null
              : identityValid) && !pending
              ? "bg-[var(--neuma-orange)] text-white hover:bg-[var(--neuma-orange)]/90"
              : "bg-white/12 text-foreground",
          )}
        >
          {pending ? "A guardar…" : "Continuar"}
        </Button>

        {!oauthMode ? (
          <OAuthSignInButtons
            intent="signup"
            nextPath="/login/signup"
            dividerLabel="ou criar com"
            signupNextStep="identity"
            getSignupDraft={() =>
              buildSignupDraftFromFields({ firstName, lastName, age, gender })
            }
          />
        ) : null}

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
    </div>
  );
}

/** @deprecated use SignupWizard */
export const SignupForm = SignupWizard;
