import Image from "next/image";
import { notFound } from "next/navigation";

import { lookupOneToOneInvite } from "@/lib/actions/one-to-one";
import { getSessionUser } from "@/lib/auth/session";
import { isOneToOneInvitePathSegment } from "@/lib/one-to-one/invite-path";
import { Card } from "@/components/ui/card";
import { OneToOneRedeemForm } from "@/components/one-to-one-redeem-form";

export default async function OneToOneInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ inviteId: string }>;
  searchParams: Promise<{ cancelado?: string; perfil?: string }>;
}) {
  const { inviteId } = await params;
  const { cancelado, perfil } = await searchParams;

  if (!isOneToOneInvitePathSegment(inviteId)) {
    notFound();
  }

  const [invite, sessionUser] = await Promise.all([
    lookupOneToOneInvite(inviteId),
    getSessionUser(),
  ]);
  // Conta já existente com sessão iniciada: não recriar utilizador, saltar
  // directamente para o pagamento (ou pedir a conta certa).
  const sessionEmail = sessionUser?.email?.trim().toLowerCase() ?? "";
  const inviteEmail = invite?.email?.trim().toLowerCase() ?? "";
  const sessionMatches = Boolean(sessionEmail) && sessionEmail === inviteEmail;

  const expired =
    invite?.status === "expired" ||
    (invite?.expires_at ? new Date(invite.expires_at) < new Date() : false);

  let errorState: string | null = null;
  if (!invite) {
    errorState = "Este convite não existe ou já não é válido.";
  } else if (invite.status === "revoked") {
    errorState = "Este convite foi revogado.";
  } else if (invite.status === "paid" && perfil !== "1") {
    errorState = "Este convite já foi utilizado. Entra na tua conta normalmente.";
  } else if (expired && invite.status !== "paid") {
    errorState = "Este convite expirou. Pede à Neuma um novo link.";
  }

  const skipEnterAnimation = cancelado === "1" || perfil === "1";

  return (
    <div
      className={
        skipEnterAnimation
          ? "flex w-full flex-col items-center auth-flow-instant desktop:items-stretch"
          : "flex w-full flex-col items-center desktop:items-stretch"
      }
    >
      <Image
        src="/brand/mark-white.png"
        alt="Neuma"
        width={96}
        height={96}
        priority
        className="auth-mobile-mark mb-6 h-20 w-20 animate-float desktop:hidden"
      />

      <Card
        className={
          skipEnterAnimation
            ? "auth-enter-form--instant w-full space-y-6 p-7 sm:p-8"
            : "auth-enter-form w-full animate-fade-up space-y-6 p-7 sm:p-8"
        }
      >
        {errorState || !invite ? (
          <div className="space-y-2 text-center">
            <h1 className="font-heading text-xl font-bold tracking-tight">
              Neuma 1:1
            </h1>
            <p className="text-sm text-muted-foreground">{errorState}</p>
          </div>
        ) : sessionUser && !sessionMatches && perfil !== "1" ? (
          <div className="space-y-2 text-center">
            <h1 className="font-heading text-xl font-bold tracking-tight">
              Neuma 1:1
            </h1>
            <p className="text-sm text-muted-foreground">
              Estás noutra conta. Entra com {invite.email} para pagar este
              convite.
            </p>
          </div>
        ) : (
          <OneToOneRedeemForm
            token={inviteId}
            email={invite.email}
            fullName={invite.full_name}
            firstName={invite.first_name}
            lastName={invite.last_name}
            cancelled={cancelado === "1"}
            startAtProfile={perfil === "1"}
            startAtCheckout={sessionMatches}
          />
        )}
      </Card>
    </div>
  );
}
