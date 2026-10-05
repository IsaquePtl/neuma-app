import Image from "next/image";
import { redirect } from "next/navigation";

import { PlanPicker } from "@/components/plan-picker";
import { LogoutForm } from "@/components/logout-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccessState } from "@/lib/billing/access";
import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";

function lapsedNotice(
  access: Awaited<ReturnType<typeof getAccessState>>,
): string | null {
  const sub = access.subscription;
  if (!sub) return null;

  if (sub.status === "canceled") {
    return "A tua subscrição foi cancelada. Escolhe um plano para voltares a ter acesso.";
  }

  if (sub.status === "unpaid") {
    return "A tua subscrição está por pagar há demasiado tempo. Renova o plano para recuperares o acesso.";
  }

  if (sub.status === "past_due" && !access.hasAccess) {
    return "O pagamento está em atraso há demasiado tempo. Actualiza o plano para recuperares o acesso.";
  }

  return null;
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelado?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (profile?.signup_incomplete) {
    redirect("/login/signup");
  }

  const params = await searchParams;
  if (params.cancelado === "1") {
    redirect("/subscrever");
  }

  const access = await getAccessState();
  if (access.hasAccess && access.reason !== "grace") {
    redirect("/home");
  }

  const notice = lapsedNotice(access);
  const isLapsed = Boolean(notice);

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

      <Card className="auth-enter-form--instant w-full space-y-6 p-6 sm:p-8">
        <PlanPicker
          title={isLapsed ? "Recupera o teu acesso" : "Activa a tua conta"}
          subtitle={
            isLapsed
              ? "Renova a subscrição para continuares na Neuma."
              : "Escolhe um plano para entrar na Neuma. Sem pagamento, sem acesso."
          }
          cancelReturnPath="/subscrever"
          notice={notice}
        />

        <LogoutForm className="flex justify-center">
          <Button type="submit" variant="ghost" className="text-muted-foreground">
            Terminar sessão
          </Button>
        </LogoutForm>
      </Card>
    </div>
  );
}
