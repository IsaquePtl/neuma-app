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
    <div className="flex w-full flex-col items-center">
      <Image
        src="/brand/mark-white.png"
        alt="Neuma"
        width={96}
        height={96}
        priority
        className="mb-8 h-24 w-24 animate-float"
      />

      <Card className="w-full animate-fade-up p-7 sm:p-8">
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
            className="h-14 w-full text-base font-semibold bg-white/12 text-foreground hover:bg-white/18"
          >
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
