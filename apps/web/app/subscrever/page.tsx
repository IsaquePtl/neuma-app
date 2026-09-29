import { redirect } from "next/navigation";

import { PlanPicker } from "@/components/plan-picker";
import { LogoutForm } from "@/components/logout-form";
import { getAccessState } from "@/lib/billing/access";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

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

  // past_due beyond grace (access already false) — atraso prolongado
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

  // Legacy Stripe cancel links used ?cancelado=1 — strip to normal plan picker.
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
    <main className="neuma-app-bg flex min-h-dvh flex-col px-4 py-10">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
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

        <LogoutForm className="mt-8 flex justify-center">
          <Button type="submit" variant="ghost" className="text-muted-foreground">
            Terminar sessão
          </Button>
        </LogoutForm>
      </div>
    </main>
  );
}
