import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/labels";
import { formatEuros } from "@/lib/stripe/plans";
import type { OneToOneInviteStatus } from "@/lib/types/database.types";

export const dynamic = "force-dynamic";

const inviteStatusLabel: Record<OneToOneInviteStatus, string> = {
  pending: "Pendente",
  sent: "Enviado",
  paid: "Pago",
  expired: "Expirado",
  revoked: "Revogado",
};

const inviteStatusClass: Record<OneToOneInviteStatus, string> = {
  pending: "border-transparent bg-amber-500/15 text-amber-400",
  sent: "border-transparent bg-sky-500/15 text-sky-400",
  paid: "border-transparent bg-emerald-500/15 text-emerald-400",
  expired: "border-border text-muted-foreground",
  revoked: "border-transparent bg-rose-500/15 text-rose-400",
};

export default async function FinanceOneToOnePage() {
  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("one_to_one_invites")
    .select(
      "id, email, full_name, amount_cents, currency, interval, interval_count, status, notes, expires_at, redeemed_at, created_at",
    )
    .order("created_at", { ascending: false });

  const rows = invites ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Neuma 1:1</h2>
        <p className="text-sm text-muted-foreground">
          Convites com preço à medida. A criação de novos convites pode chegar
          noutro fluxo.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="space-y-2 p-10 text-center">
          <p className="font-medium">Sem convites 1:1</p>
          <p className="text-sm text-muted-foreground">
            Ainda não há convites Neuma 1:1 registados.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_6.5rem_6rem_7rem_6rem] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground desktop:grid">
            <span>Convidado</span>
            <span>Valor</span>
            <span>Cadência</span>
            <span>Estado</span>
            <span>Criado</span>
          </div>
          <div className="divide-y divide-white/5">
            {rows.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-2 px-4 py-3.5 desktop:grid desktop:grid-cols-[minmax(0,1.4fr)_6.5rem_6rem_7rem_6rem] desktop:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {invite.full_name ?? invite.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {invite.email}
                    {invite.notes ? ` · ${invite.notes}` : ""}
                  </p>
                </div>
                <p className="text-sm tabular-nums">
                  {formatEuros(invite.amount_cents)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {invite.interval_count}× {invite.interval}
                </p>
                <div>
                  <Badge
                    variant="outline"
                    className={inviteStatusClass[invite.status]}
                  >
                    {inviteStatusLabel[invite.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(invite.created_at)}
                  {invite.expires_at
                    ? ` · exp. ${formatDate(invite.expires_at)}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
