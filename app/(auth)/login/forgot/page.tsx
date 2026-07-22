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
    <div className="flex w-full max-w-sm flex-col items-center">
      <Image
        src="/brand/mark-white.png"
        alt="Neuma"
        width={72}
        height={72}
        priority
        className="mb-8"
      />
      <Card className="w-full p-6">
        <form action={requestPasswordReset} className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Recuperar password</h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um link para o teu email.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="text-sm text-muted-foreground" role="status">
              {ok}
            </p>
          ) : null}
          <Button type="submit" className="w-full bg-white/12 text-foreground hover:bg-white/18">
            Enviar link
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="underline-offset-4 hover:underline">
              Voltar ao login
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
