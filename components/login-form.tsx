"use client";

import Link from "next/link";
import { useState } from "react";

import { login } from "@/lib/actions/auth";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/validation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAuthSignInButtons } from "@/components/oauth-sign-in-buttons";

export function LoginForm({ error }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const canSubmit = isValidEmail(email) && isValidPassword(password);

  return (
    <form action={login} className="space-y-5">
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
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password" className="text-base">
            Password
          </Label>
          <Link
            href="/login/forgot"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Esqueceste-te?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        disabled={!canSubmit}
        className={cn(
          "h-14 w-full text-base font-semibold transition-colors",
          canSubmit
            ? "bg-[var(--neuma-orange)] text-white hover:bg-[var(--neuma-orange)]/90"
            : "bg-white/12 text-foreground hover:bg-white/18 disabled:pointer-events-none disabled:opacity-100",
        )}
      >
        Entrar
      </Button>
      <OAuthSignInButtons />
    </form>
  );
}
