import Image from "next/image";
import Link from "next/link";

import { login } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex w-full max-w-sm flex-col items-center">
      <Image
        src="/brand/mark-white.png"
        alt="Neuma"
        width={72}
        height={72}
        priority
        className="mb-8 animate-float"
      />

      <Card className="w-full animate-fade-up p-6">
        <form action={login} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/login/forgot"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
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
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full bg-white/12 text-foreground hover:bg-white/18"
          >
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
