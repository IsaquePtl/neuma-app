"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera } from "lucide-react";

import {
  redeemOneToOneAccount,
  startOneToOneCheckout,
} from "@/lib/actions/one-to-one";
import { finishSignupProfileExtras } from "@/lib/actions/auth";
import { uploadAvatar } from "@/lib/actions/profile";
import {
  PASSWORD_MIN_LENGTH,
  isValidEmail,
  isValidPassword,
} from "@/lib/auth/validation";
import { prepareAvatarFile } from "@/lib/images/prepare-avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { profileInitials } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "password" | "checkout" | "profile";

const STEP_META: Record<
  Step,
  { title: string; subtitle: string }
> = {
  email: {
    title: "O teu email",
    subtitle: "1 de 4 — Confirmação",
  },
  password: {
    title: "Definir palavra-passe",
    subtitle: "2 de 4 — Acesso",
  },
  checkout: {
    title: "Pagamento",
    subtitle: "3 de 4 — Subscrição",
  },
  profile: {
    title: "O teu perfil",
    subtitle: "4 de 4 — Perfil",
  },
};

export function OneToOneRedeemForm({
  token,
  email: inviteEmail,
  fullName,
  firstName,
  lastName,
  cancelled = false,
  startAtProfile = false,
}: {
  token: string;
  email: string;
  fullName: string | null;
  firstName?: string | null;
  lastName?: string | null;
  cancelled?: boolean;
  /** Após Stripe sucesso — só o passo de foto/bio. */
  startAtProfile?: boolean;
}) {
  const router = useRouter();
  const displayName =
    fullName ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    inviteEmail;

  const [step, setStep] = useState<Step>(
    startAtProfile ? "profile" : cancelled ? "checkout" : "email",
  );
  const [enteredEmail, setEnteredEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bio, setBio] = useState("");

  const passwordOk =
    isValidPassword(password) && password === confirmPassword;
  const emailOk = isValidEmail(enteredEmail);
  const meta = STEP_META[step];

  function goCheckout() {
    startTransition(async () => {
      setError(null);
      const result = await startOneToOneCheckout({ token });
      if (!result.ok) {
        setError(result.error);
        setStep("checkout");
        return;
      }
      window.location.href = result.checkoutUrl;
    });
  }

  function onConfirmEmail(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const normalized = enteredEmail.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setError("Indica um email válido.");
      return;
    }
    if (normalized !== inviteEmail.trim().toLowerCase()) {
      setError(
        "Este email não corresponde ao convite. Usa o email para o qual foste convidado.",
      );
      return;
    }
    setStep("password");
  }

  function onSetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordOk || pending) return;
    setError(null);
    setExistingAccount(false);

    startTransition(async () => {
      const account = await redeemOneToOneAccount({ token, password });
      if (!account.ok) {
        if (/já existe uma conta/i.test(account.error)) {
          setExistingAccount(true);
        }
        setError(account.error);
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteEmail,
        password,
      });

      if (signInError) {
        setError(
          "Conta criada, mas não foi possível entrar automaticamente. Entra com o teu email e password e volta a abrir este link.",
        );
        return;
      }

      setStep("checkout");
      const checkout = await startOneToOneCheckout({ token });
      if (!checkout.ok) {
        setError(checkout.error);
        return;
      }
      window.location.href = checkout.checkoutUrl;
    });
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setAvatarFile(file);
    e.target.value = "";
  }

  function finishProfile(options: { skipPhoto?: boolean; skipBio?: boolean } = {}) {
    setError(null);
    startTransition(async () => {
      try {
        if (avatarFile && !options.skipPhoto) {
          const prepared = await prepareAvatarFile(avatarFile);
          const fd = new FormData();
          fd.set("avatar", prepared);
          await uploadAvatar(fd);
        }

        const trimmedBio = bio.trim();
        if (!options.skipBio && trimmedBio) {
          const result = await finishSignupProfileExtras({ bio: trimmedBio });
          if (!result.ok) {
            setError(result.error);
            return;
          }
        }

        router.replace("/home?welcome=1");
        router.refresh();
      } catch (err) {
        const raw = err instanceof Error ? err.message : "";
        setError(
          /unexpected response|body exceeded|413/i.test(raw)
            ? "Não foi possível carregar a foto. Tenta outra imagem."
            : raw || "Não foi possível guardar o perfil.",
        );
      }
    });
  }

  const stepHeading = (
    <div className="mb-5 space-y-1">
      <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
      <h2 className="font-heading text-xl font-bold tracking-tight">
        {meta.title}
      </h2>
    </div>
  );

  if (step === "email") {
    return (
      <form onSubmit={onConfirmEmail} className="animate-fade-in space-y-5">
        {stepHeading}
        <p className="text-sm text-muted-foreground">
          Introduz o email para o qual recebeste o convite.
        </p>
        <div className="space-y-2">
          <Label htmlFor="invite_email" className="text-base">
            Email
          </Label>
          <Input
            id="invite_email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={enteredEmail}
            onChange={(event) => {
              setEnteredEmail(event.target.value);
              if (error) setError(null);
            }}
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
          disabled={!emailOk}
          className={cn(
            "h-14 w-full text-base font-semibold transition-colors",
            emailOk
              ? "bg-[var(--neuma-orange)] text-white hover:bg-[var(--neuma-orange)]/90"
              : "bg-white/12 text-foreground",
          )}
        >
          Continuar
        </Button>
      </form>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={onSetPassword} className="animate-fade-in space-y-5">
        {stepHeading}
        <p className="text-sm text-muted-foreground">
          Define uma palavra-passe para a tua conta Neuma.
        </p>
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
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm_password" className="text-base">
            Confirmar palavra-passe
          </Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 text-base"
          />
          {confirmPassword && password !== confirmPassword ? (
            <p className="text-sm text-destructive">
              As palavras-passe não coincidem.
            </p>
          ) : null}
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
          disabled={!passwordOk || pending}
          className={cn(
            "h-14 w-full text-base font-semibold transition-colors",
            passwordOk && !pending
              ? "bg-[var(--neuma-orange)] text-white hover:bg-[var(--neuma-orange)]/90"
              : "bg-white/12 text-foreground",
          )}
        >
          {pending ? "A activar…" : "Continuar"}
        </Button>
      </form>
    );
  }

  if (step === "checkout") {
    return (
      <div className="animate-fade-in space-y-5">
        {stepHeading}
        {cancelled ? (
          <p
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-muted-foreground"
            role="status"
          >
            Cancelaste o pagamento. Podes tentar outra vez quando estiveres
            pronto.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Conta pronta. Continua para activar o teu acesso Neuma 1:1.
          </p>
        )}

        {error ? (
          <p className="text-base text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={goCheckout}
          className="h-14 w-full bg-[var(--neuma-orange)] text-base font-semibold text-white hover:bg-[var(--neuma-orange)]/90"
        >
          {pending ? "A abrir pagamento…" : "Continuar para pagamento"}
        </Button>
      </div>
    );
  }

  // profile
  const initials = profileInitials(displayName, null);

  return (
    <div className="animate-fade-in space-y-6">
      {stepHeading}
      <p className="text-sm text-muted-foreground">
        Pagamento confirmado. Podes saltar estes passos e completar depois nas
        definições.
      </p>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="group relative"
          aria-label="Escolher fotografia de perfil"
        >
          <span
            className={cn(
              "relative grid size-[6.5rem] place-items-center overflow-hidden rounded-full",
              "bg-gradient-to-br from-[var(--neuma-coral)] to-[var(--neuma-blue)]",
              "ring-2 ring-white/10 transition-opacity group-hover:opacity-90",
            )}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <span className="text-3xl font-semibold text-white">
                {initials}
              </span>
            )}
          </span>
          <span className="absolute bottom-0.5 right-0.5 grid size-9 place-items-center rounded-full bg-background/90 text-foreground ring-1 ring-white/15 backdrop-blur-sm">
            <Camera className="size-4" />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onPickPhoto}
        />
        <p className="text-xs text-muted-foreground">
          Toca para adicionar uma fotografia
        </p>
        <button
          type="button"
          onClick={() => finishProfile({ skipPhoto: true })}
          disabled={pending}
          className="text-xs text-muted-foreground/70 underline-offset-4 hover:text-muted-foreground hover:underline"
        >
          Saltar por agora
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="otoo_bio" className="text-base">
          Sobre ti
        </Label>
        <Input
          id="otoo_bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          placeholder="Uma linha sobre ti…"
          disabled={pending}
          className="h-12 text-base"
        />
        <button
          type="button"
          onClick={() => finishProfile({ skipBio: true })}
          disabled={pending}
          className="text-xs text-muted-foreground/70 underline-offset-4 hover:text-muted-foreground hover:underline"
        >
          Saltar por agora
        </button>
      </div>

      {error ? (
        <p className="text-base text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={() => finishProfile()}
        className="h-14 w-full bg-[var(--neuma-orange)] text-base font-semibold text-white hover:bg-[var(--neuma-orange)]/90"
      >
        {pending ? "A concluir…" : "Continuar"}
      </Button>
    </div>
  );
}
