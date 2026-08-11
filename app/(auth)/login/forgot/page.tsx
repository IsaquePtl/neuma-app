import Link from "next/link";
import Image from "next/image";

import { requestPasswordReset } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  return (
    <div className="flex w-full max-w-md flex-col items-center">
      <Image
        src="/brand/mark-white.png"
        alt="Neuma"
        width={96}
        height={96}
        priority
        className="mb-8 h-24 w-24"
      />
      <Card className="w-full p-7 sm:p-8">
        <form action={requestPasswordReset} className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Recuperar password</h1>
            <p className="text-base text-muted-foreground">
              Enviamos um link para o teu email.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-12 text-base"
            />
          </div>
          {error ? (
            <p className="text-base text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="text-base text-muted-foreground" role="status">
              {ok}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="h-14 w-full text-base font-semibold bg-white/12 text-foreground hover:bg-white/18"
          >
            Enviar link
          </Button>
          <p className="text-center text-base text-muted-foreground">
            <Link href="/login" className="underline-offset-4 hover:underline">
              Voltar ao login
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
