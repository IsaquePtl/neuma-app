"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Gift,
  Pause,
  Play,
  RefreshCw,
  Search,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelSubscription,
  changeSubscriptionPlan,
  grantComplimentaryAccess,
  pauseSubscription,
  refundPayment,
  resumeSubscription,
  revokeComplimentaryAccess,
} from "@/lib/actions/finance";
import {
  billingPlanLabel,
  formatDate,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  subscriptionStatusToneClass,
} from "@/lib/labels";
import { formatEuros, FIXED_PLANS, type FixedPlan } from "@/lib/stripe/plans";
import type {
  BillingPlan,
  SubscriptionStatus,
} from "@/lib/types/database.types";
import { UserAvatar } from "@/components/user-avatar";
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
import { cn } from "@/lib/utils";

export type FinanceSubscriptionRow = {
  id: string;
  profile_id: string | null;
  student_name: string | null;
  student_email: string | null;
  avatar_url: string | null;
  billing_exempt: boolean;
  plan: BillingPlan | null;
  status: SubscriptionStatus;
  unit_amount: number | null;
  currency: string;
  interval: string | null;
  interval_count: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  collection_paused: boolean;
  created_at: string;
  latest_payment: {
    id: string;
    amount_cents: number;
    amount_refunded_cents: number;
    paid_at: string | null;
  } | null;
};

type ConfirmAction =
  | { type: "pause"; id: string }
  | { type: "resume"; id: string }
  | { type: "cancel_period"; id: string }
  | { type: "cancel_now"; id: string }
  | { type: "change_plan"; id: string; plan: FixedPlan }
  | { type: "refund"; paymentId: string; maxCents: number }
  | { type: "grant"; profileId: string }
  | { type: "revoke"; profileId: string };

function matchesSearch(row: FinanceSubscriptionRow, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (row.student_name?.toLowerCase().includes(q) ?? false) ||
    (row.student_email?.toLowerCase().includes(q) ?? false) ||
    (row.plan ? billingPlanLabel[row.plan].toLowerCase().includes(q) : false) ||
    subscriptionStatusLabel[row.status].toLowerCase().includes(q)
  );
}

function confirmCopy(action: ConfirmAction): {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
} {
  switch (action.type) {
    case "pause":
      return {
        title: "Pausar cobranças?",
        description:
          "As facturas futuras são anuladas enquanto a pausa estiver activa. O aluno mantém acesso.",
        confirmLabel: "Pausar",
      };
    case "resume":
      return {
        title: "Retomar cobranças?",
        description: "A Stripe volta a cobrar no próximo ciclo.",
        confirmLabel: "Retomar",
      };
    case "cancel_period":
      return {
        title: "Cancelar no fim do período?",
        description:
          "A subscrição continua activa até ao fim do período actual e depois termina.",
        confirmLabel: "Cancelar no fim",
        destructive: true,
      };
    case "cancel_now":
      return {
        title: "Cancelar imediatamente?",
        description:
          "A subscrição termina já. O aluno perde o acesso pago (exceto cortesia).",
        confirmLabel: "Cancelar já",
        destructive: true,
      };
    case "change_plan":
      return {
        title: `Mudar para ${billingPlanLabel[action.plan]}?`,
        description:
          "A Stripe calcula a proração e aplica o novo preço na próxima factura.",
        confirmLabel: "Mudar plano",
      };
    case "refund":
      return {
        title: "Reembolsar pagamento?",
        description: `Vais reembolsar até ${formatEuros(action.maxCents)}. O reembolso fica atribuído à data de hoje.`,
        confirmLabel: "Reembolsar",
        destructive: true,
      };
    case "grant":
      return {
        title: "Conceder acesso de cortesia?",
        description:
          "O aluno fica isento de paywall (billing_exempt), independentemente da subscrição.",
        confirmLabel: "Conceder",
      };
    case "revoke":
      return {
        title: "Revogar cortesia?",
        description:
          "O aluno volta a depender de uma subscrição válida para aceder.",
        confirmLabel: "Revogar",
        destructive: true,
      };
  }
}

export function FinanceSubscriptionsList({
  subscriptions,
}: {
  subscriptions: FinanceSubscriptionRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [pending, startTransition] = useTransition();
  const searchQuery = search.trim();

  const visible = useMemo(() => {
    return subscriptions.filter((row) => {
      if (!matchesSearch(row, searchQuery)) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "paused") return row.collection_paused;
      return row.status === statusFilter;
    });
  }, [subscriptions, searchQuery, statusFilter]);

  function runConfirm() {
    if (!confirm) return;
    const action = confirm;
    startTransition(async () => {
      let result: { ok: boolean; error?: string };
      switch (action.type) {
        case "pause":
          result = await pauseSubscription(action.id);
          break;
        case "resume":
          result = await resumeSubscription(action.id);
          break;
        case "cancel_period":
          result = await cancelSubscription(action.id, { immediate: false });
          break;
        case "cancel_now":
          result = await cancelSubscription(action.id, { immediate: true });
          break;
        case "change_plan":
          result = await changeSubscriptionPlan(action.id, action.plan);
          break;
        case "refund":
          result = await refundPayment(action.paymentId);
          break;
        case "grant":
          result = await grantComplimentaryAccess(action.profileId);
          break;
        case "revoke":
          result = await revokeComplimentaryAccess(action.profileId);
          break;
      }
      if (!result.ok) {
        toast.error(result.error ?? "Algo correu mal.");
        return;
      }
      toast.success("Actualizado.");
      setConfirm(null);
      router.refresh();
    });
  }

  const copy = confirm ? confirmCopy(confirm) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, email ou plano…"
            className="pl-9"
            aria-label="Pesquisar subscrições"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-white/10 bg-transparent px-3 text-sm text-foreground"
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos os estados</option>
          <option value="active">Activa</option>
          <option value="trialing">Em teste</option>
          <option value="past_due">Em atraso</option>
          <option value="paused">Cobrança pausada</option>
          <option value="canceled">Cancelada</option>
          <option value="unpaid">Não paga</option>
        </select>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-[minmax(0,1.5fr)_7rem_7rem_6.5rem_minmax(0,1fr)] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground desktop:grid">
          <span>Aluno</span>
          <span>Plano</span>
          <span>Estado</span>
          <span>Valor</span>
          <span>Acções</span>
        </div>
        <div className="divide-y divide-white/5">
          {visible.map((row) => {
            const name = row.student_name ?? row.student_email ?? "Sem nome";
            const tone = subscriptionStatusTone[row.status];
            const refundable = row.latest_payment
              ? Math.max(
                  0,
                  row.latest_payment.amount_cents -
                    row.latest_payment.amount_refunded_cents,
                )
              : 0;
            const canManage = ["active", "trialing", "past_due", "paused"].includes(
              row.status,
            );

            return (
              <div
                key={row.id}
                className="flex flex-col gap-3 px-4 py-3.5 desktop:grid desktop:grid-cols-[minmax(0,1.5fr)_7rem_7rem_6.5rem_minmax(0,1fr)] desktop:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar
                    name={row.student_name}
                    email={row.student_email}
                    avatarUrl={row.avatar_url}
                    size="lg"
                    rounded="xl"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.student_email}
                      {row.billing_exempt ? " · cortesia" : ""}
                      {row.cancel_at_period_end ? " · cancela no fim" : ""}
                    </p>
                    {row.profile_id ? (
                      <Link
                        href={`/studio/students/${row.profile_id}`}
                        className="text-xs text-[var(--neuma-coral)] hover:underline"
                      >
                        Ver aluno
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div>
                  <Badge variant="outline" className="border-border">
                    {row.plan ? billingPlanLabel[row.plan] : "—"}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Badge
                    variant="outline"
                    className={cn(subscriptionStatusToneClass[tone])}
                  >
                    {subscriptionStatusLabel[row.status]}
                  </Badge>
                  {row.collection_paused ? (
                    <Badge
                      variant="outline"
                      className={subscriptionStatusToneClass.warn}
                    >
                      Pausada
                    </Badge>
                  ) : null}
                </div>

                <div className="text-sm tabular-nums">
                  {row.unit_amount != null
                    ? formatEuros(row.unit_amount)
                    : "—"}
                  {row.current_period_end ? (
                    <p className="text-xs text-muted-foreground">
                      até {formatDate(row.current_period_end)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {canManage && !row.collection_paused ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setConfirm({ type: "pause", id: row.id })}
                    >
                      <Pause className="size-3.5" />
                      Pausar
                    </Button>
                  ) : null}
                  {row.collection_paused ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setConfirm({ type: "resume", id: row.id })}
                    >
                      <Play className="size-3.5" />
                      Retomar
                    </Button>
                  ) : null}

                  {canManage &&
                  row.plan &&
                  row.plan !== "one_to_one" ? (
                    <div className="flex flex-wrap gap-1">
                      {FIXED_PLANS.filter((p) => p !== row.plan).map((plan) => (
                        <Button
                          key={plan}
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            setConfirm({
                              type: "change_plan",
                              id: row.id,
                              plan,
                            })
                          }
                        >
                          <ArrowRightLeft className="size-3.5" />
                          {billingPlanLabel[plan]}
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  {canManage && !row.cancel_at_period_end ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          setConfirm({ type: "cancel_period", id: row.id })
                        }
                      >
                        <Ban className="size-3.5" />
                        Fim período
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          setConfirm({ type: "cancel_now", id: row.id })
                        }
                      >
                        Cancelar já
                      </Button>
                    </>
                  ) : null}

                  {refundable > 0 && row.latest_payment ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        setConfirm({
                          type: "refund",
                          paymentId: row.latest_payment!.id,
                          maxCents: refundable,
                        })
                      }
                    >
                      <RefreshCw className="size-3.5" />
                      Reembolsar
                    </Button>
                  ) : null}

                  {row.profile_id ? (
                    row.billing_exempt ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          setConfirm({
                            type: "revoke",
                            profileId: row.profile_id!,
                          })
                        }
                      >
                        Revogar cortesia
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          setConfirm({
                            type: "grant",
                            profileId: row.profile_id!,
                          })
                        }
                      >
                        <Gift className="size-3.5" />
                        Cortesia
                      </Button>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {searchQuery && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma subscrição corresponde a «{searchQuery}».
        </p>
      ) : null}

      <Dialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          {copy ? (
            <>
              <DialogHeader>
                <DialogTitle>{copy.title}</DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirm(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant={copy.destructive ? "destructive" : "default"}
                  disabled={pending}
                  onClick={runConfirm}
                >
                  {pending ? "A processar…" : copy.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
