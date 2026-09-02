"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createOneToOneInvite,
  resendOneToOneInvite,
  revokeOneToOneInvite,
} from "@/lib/actions/one-to-one";
import { formatDate } from "@/lib/labels";
import { formatCents } from "@/lib/finance/money";
import type { OneToOneInviteStatus } from "@/lib/types/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type OneToOneInviteRow = {
  id: string;
  email: string;
  full_name: string | null;
  amount_cents: number;
  currency: string;
  interval: string;
  interval_count: number;
  status: OneToOneInviteStatus;
  notes: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  created_at: string;
};

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

const initialForm = {
  email: "",
  fullName: "",
  amountEuros: "",
  interval: "month" as "month" | "year",
  intervalCount: "1",
  notes: "",
};

export function OneToOneInvitesPanel({
  invites,
}: {
  invites: OneToOneInviteRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initialForm);
  const [createdInvite, setCreatedInvite] = useState<{
    url: string;
    email: string;
  } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<OneToOneInviteRow | null>(
    null,
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(
      Number(form.amountEuros.replace(",", ".")) * 100,
    );
    if (!form.email.trim() || !form.email.includes("@")) {
      toast.error("Indica um email válido.");
      return;
    }
    if (!form.fullName.trim()) {
      toast.error("Indica o nome do convidado.");
      return;
    }
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      toast.error("Valor mínimo: 1,00 €.");
      return;
    }

    startTransition(async () => {
      const result = await createOneToOneInvite({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        amountCents,
        interval: form.interval,
        intervalCount: Math.max(1, Number(form.intervalCount) || 1),
        notes: form.notes.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Convite criado e email enviado.");
      setCreatedInvite({ url: result.inviteUrl, email: form.email.trim() });
      setForm(initialForm);
      router.refresh();
    });
  }

  function copyLink(url: string) {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copiado."))
      .catch(() => toast.error("Não foi possível copiar o link."));
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    startTransition(async () => {
      const result = await revokeOneToOneInvite(revokeTarget.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Convite revogado.");
      setRevokeTarget(null);
      router.refresh();
    });
  }

  function onResend(inviteId: string) {
    startTransition(async () => {
      const result = await resendOneToOneInvite(inviteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Convite reenviado.", {
        action: {
          label: "Copiar link",
          onClick: () => copyLink(result.inviteUrl),
        },
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="aluno@email.com"
                disabled={pending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Nome</Label>
              <Input
                id="invite-name"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Nome completo"
                disabled={pending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-amount">Valor (€)</Label>
              <Input
                id="invite-amount"
                inputMode="decimal"
                value={form.amountEuros}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amountEuros: e.target.value }))
                }
                placeholder="ex. 150,00"
                disabled={pending}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-interval">Cadência</Label>
                <select
                  id="invite-interval"
                  value={form.interval}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      interval: e.target.value as "month" | "year",
                    }))
                  }
                  disabled={pending}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                >
                  <option value="month">Mês(es)</option>
                  <option value="year">Ano(s)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-interval-count">Cada</Label>
                <Input
                  id="invite-interval-count"
                  type="number"
                  min={1}
                  value={form.intervalCount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, intervalCount: e.target.value }))
                  }
                  disabled={pending}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-notes">Notas (opcional)</Label>
            <Textarea
              id="invite-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Contexto interno sobre este convite…"
              disabled={pending}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              <Link2 className="size-4" />
              {pending ? "A criar…" : "Criar convite"}
            </Button>
          </div>
        </form>
      </Card>

      {createdInvite ? (
        <Card className="space-y-2 border-[var(--neuma-coral)]/30 p-4">
          <p className="text-sm font-medium">
            Convite criado para {createdInvite.email}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input readOnly value={createdInvite.url} className="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyLink(createdInvite.url)}
            >
              <Copy className="size-3.5" />
              Copiar link
            </Button>
          </div>
        </Card>
      ) : null}

      {invites.length === 0 ? (
        <Card className="space-y-2 p-10 text-center">
          <p className="font-medium">Sem convites 1:1</p>
          <p className="text-sm text-muted-foreground">
            Cria o primeiro convite no formulário acima.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_6.5rem_6rem_7rem_6rem_2.5rem] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground desktop:grid">
            <span>Convidado</span>
            <span>Valor</span>
            <span>Cadência</span>
            <span>Estado</span>
            <span>Criado</span>
            <span />
          </div>
          <div className="divide-y divide-white/5">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-2 px-4 py-3.5 desktop:grid desktop:grid-cols-[minmax(0,1.4fr)_6.5rem_6rem_7rem_6rem_2.5rem] desktop:items-center"
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
                  {formatCents(invite.amount_cents, invite.currency)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {invite.interval_count}× {invite.interval}
                </p>
                <div>
                  <Badge
                    variant="outline"
                    className={cn(inviteStatusClass[invite.status])}
                  >
                    {inviteStatusLabel[invite.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(invite.created_at)}
                  {invite.expires_at ? ` · exp. ${formatDate(invite.expires_at)}` : ""}
                </p>
                <div className="flex justify-end gap-0.5">
                  {invite.status === "pending" || invite.status === "sent" ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        title="Reenviar convite"
                        onClick={() => onResend(invite.id)}
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        title="Revogar convite"
                        onClick={() => setRevokeTarget(invite)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setRevokeTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Revogar convite?</DialogTitle>
            <DialogDescription>
              {revokeTarget
                ? `O convite de ${revokeTarget.full_name ?? revokeTarget.email} deixa de poder ser usado.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setRevokeTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={confirmRevoke}
            >
              {pending ? "A revogar…" : "Revogar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
