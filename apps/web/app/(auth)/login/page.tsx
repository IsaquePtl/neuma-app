import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";
import { isOneToOneInvitePath } from "@/lib/one-to-one/invite-path";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; next?: string }>;
}) {
  const { error, ok, next } = await searchParams;
  const safeNext =
    next && (/^\/1-1\/[A-Za-z0-9_-]+$/.test(next) || isOneToOneInvitePath(next))
      ? next
      : undefined;

  return (
    <div className="flex w-full flex-col items-center desktop:items-stretch">
      <Image
        src="/brand/mark-white.png"
        alt="Neuma"
        width={96}
        height={96}
        priority
        className="auth-mobile-mark mb-8 h-24 w-24 animate-float desktop:hidden"
      />

      <Card className="auth-enter-form w-full animate-fade-up p-7 sm:p-8">
        {ok ? (
          <p className="mb-4 text-sm text-muted-foreground" role="status">
            {ok}
          </p>
        ) : null}
        <LoginForm error={error} nextPath={safeNext} />
      </Card>
      <nav className="mt-5 flex justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/privacidade" className="hover:text-foreground">
          Privacidade
        </Link>
        <Link href="/termos" className="hover:text-foreground">
          Termos
        </Link>
      </nav>
    </div>
  );
}
