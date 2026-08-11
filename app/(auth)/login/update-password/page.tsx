import Image from "next/image";
import Link from "next/link";

import { updatePassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function UpdatePasswordPage({
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
        className="mb-8 h-24 w-24"
      />
      <Card className="w-full p-7 sm:p-8">
        <form action={updatePassword} className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Nova password</h1>
            <p className="text-base text-muted-foreground">
              Define uma password com pelo menos 8 caracteres.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-base">
              Confirmar
            </Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
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
            Guardar
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
