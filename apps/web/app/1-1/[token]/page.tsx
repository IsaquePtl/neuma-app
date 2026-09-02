import Image from "next/image";

import { lookupOneToOneInvite } from "@/lib/actions/one-to-one";
import { formatEuros } from "@/lib/stripe/plans";
import { Card } from "@/components/ui/card";
import { OneToOneRedeemForm } from "@/components/one-to-one-redeem-form";

const INTERVAL_LABEL: Record<string, string> = {
  month: "mês",
  year: "ano",
};

function cadenceLabel(interval: string, intervalCount: number) {
  const unit = INTERVAL_LABEL[interval] ?? interval;
  if (intervalCount <= 1) return `por ${unit}`;
  return `a cada ${intervalCount} ${unit}s`;
}

export default async function OneToOneRedeemPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cancelado?: string }>;
}) {
  const { token } = await params;
  const { cancelado } = await searchParams;
  const invite = await lookupOneToOneInvite(token);

  const expired =
    invite?.status === "expired" ||
    (invite?.expires_at ? new Date(invite.expires_at) < new Date() : false);

  let errorState: string | null = null;
  if (!invite) {
    errorState = "Este convite não existe ou já não é válido.";
  } else if (invite.status === "revoked") {
    errorState = "Este convite foi revogado.";
  } else if (invite.status === "paid") {
    errorState = "Este convite já foi utilizado. Entra na tua conta normalmente.";
  } else if (expired) {
    errorState = "Este convite expirou. Pede à Neuma um novo link.";
  }

  return (
    <main className="neuma-app-bg flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <Image
          src="/brand/mark-white.png"
          alt="Neuma"
          width={64}
          height={64}
          priority
          className="h-16 w-16"
        />

        <Card className="w-full space-y-6 p-7 sm:p-8">
          {errorState || !invite ? (
            <div className="space-y-2 text-center">
              <h1 className="font-heading text-xl font-bold tracking-tight">
                Neuma 1:1
              </h1>
              <p className="text-sm text-muted-foreground">{errorState}</p>
            </div>
          ) : (
            <>
              <div className="space-y-1 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Neuma 1:1
                </p>
                <h1 className="font-heading text-2xl font-bold tracking-tight">
                  Olá, {invite.full_name || invite.email}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Cria a tua conta para activar a mentoria individual —{" "}
                  {formatEuros(invite.amount_cents)}{" "}
                  {cadenceLabel(invite.interval, invite.interval_count)}.
                </p>
              </div>

              {cancelado === "1" ? (
                <p
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-muted-foreground"
                  role="status"
                >
                  Cancelaste o pagamento. Podes tentar outra vez quando
                  estiveres pronto.
                </p>
              ) : null}

              <OneToOneRedeemForm
                token={token}
                email={invite.email}
                fullName={invite.full_name}
              />
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
