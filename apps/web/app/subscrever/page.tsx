import { redirect } from "next/navigation";

import { PlanPicker } from "@/components/plan-picker";
import { logout } from "@/lib/actions/auth";
import { getAccessState } from "@/lib/billing/access";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelado?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const access = await getAccessState();
  if (access.hasAccess && access.reason !== "grace") {
    redirect("/home");
  }

  const params = await searchParams;

  return (
    <main className="neuma-app-bg flex min-h-dvh flex-col px-4 py-10">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
        <PlanPicker
          title="Activa a tua conta"
          subtitle="Escolhe um plano para entrar na Neuma. Sem pagamento, sem acesso."
          cancelled={params.cancelado === "1"}
        />

        <form action={logout} className="mt-8 flex justify-center">
          <Button type="submit" variant="ghost" className="text-muted-foreground">
            Terminar sessão
          </Button>
        </form>
      </div>
    </main>
  );
}
