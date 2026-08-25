import Image from "next/image";

import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
        <LoginForm error={error} />
      </Card>
    </div>
  );
}
