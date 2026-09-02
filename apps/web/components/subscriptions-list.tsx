"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Ban,
  Gift,
  MoreVertical,
  Pause,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelSubscription,
  changeSubscriptionPlan,
  grantComplimentaryAccess,
  pauseSubscription,
  refundPayment,
  resumeSubscription,
  resyncSubscription,
  revokeComplimentaryAccess,
} from "@/lib/actions/finance";
import {
  billingPlanLabel,
  formatDate,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  subscriptionStatusToneClass,
} from "@/lib/labels";
import { formatCents } from "@/lib/finance/money";
import { FIXED_PLANS, type FixedPlan } from "@/lib/stripe/plans";
import { createClient } from "@/lib/supabase/client";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export type SubscriptionListRow = {
  kind: "subscription" | "no_subscription";
  id: string;
  profileId: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  billingExempt: boolean;
  plan: BillingPlan | null;
  status: SubscriptionStatus | null;
  unitAmount: number | null;
  currency: string;
  interval: string | null;
  intervalCount: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  collectionPaused: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  createdAt: string | null;
  totalPaidCents: number;
  latestPayment: {
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
  | { type: "revoke"; profileId: string }
  | { type: "resync"; id: string };

const REFRESH_INTERVAL_MS = 45_000;

function cadenceLabel(interval: string | null, count: number): string {
  if (!interval) return "—";
  if (count <= 1) {
    if (interval === "month") return "Mensal";
    if (interval === "year") return "Anual";
    if (interval === "week") return "Semanal";
    return "Diária";
  }
  const unit =
    interval === "month" ? "meses" : interval === "year" ? "anos" : interval;
  return `${count}× ${unit}`;
}

function matchesSearch(row: SubscriptionListRow, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (row.name?.toLowerCase().includes(q) ?? false) ||
    (row.email?.toLowerCase().includes(q) ?? false) ||
    (row.plan ? billingPlanLabel[row.plan].toLowerCase().includes(q) : false) ||
    (row.status ? subscriptionStatusLabel[row.status].toLowerCase().includes(q) : false)
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
        title: "Reembolsar último pagamento?",
        description: `Vais reembolsar até ${formatCents(action.maxCents)}. O reembolso fica atribuído à data de hoje.`,
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
    case "resync":
      return {
        title: "Ressincronizar com a Stripe?",
        description:
          "Volta a buscar o estado actual da subscrição na Stripe e actualiza o espelho local.",
        confirmLabel: "Ressincronizar",
      };
  }
}

export function SubscriptionsList({
  subscriptions,
}: {
  subscriptions: SubscriptionListRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [changePlanTarget, setChangePlanTarget] =
    useState<SubscriptionListRow | null>(null);
  const [pending, startTransition] = useTransition();
  const searchQuery = search.trim();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("finance-subscriptions-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions" },
        () => router.refresh(),
      )
      .subscribe();

    const interval = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [router]);

  const visible = useMemo(() => {
    return subscriptions.filter((row) => {
      if (!matchesSearch(row, searchQuery)) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "no_subscription") {
          if (row.kind !== "no_subscription") return false;
        } else if (statusFilter === "paused") {
          if (!row.collectionPaused) return false;
        } else if (row.status !== statusFilter) {
          return false;
        }
      }
      if (planFilter !== "all" && row.plan !== planFilter) return false;
      return true;
    });
  }, [subscriptions, searchQuery, statusFilter, planFilter]);

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
        case "resync":
          result = await resyncSubscription(action.id);
          break;
      }
      if (!result.ok) {
        toast.error(result.error ?? "Algo correu mal.");
        return;
      }
      toast.success("Actualizado.");
      setConfirm(null);
      setChangePlanTarget(null);
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
            placeholder="Pesquisar por nome, email, plano ou estado…"
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
          <option value="no_subscription">Sem subscrição</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="h-9 rounded-lg border border-white/10 bg-transparent px-3 text-sm text-foreground"
          aria-label="Filtrar por plano"
        >
          <option value="all">Todos os planos</option>
          {Object.entries(billingPlanLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="min-w-[1180px]">
          <div className="grid grid-cols-[minmax(0,1.3fr)_6.5rem_6.5rem_5.5rem_6rem_5.5rem_5.5rem_5.5rem_6rem_2.5rem] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Aluno</span>
            <span>Plano</span>
            <span>Estado</span>
            <span>Valor</span>
            <span>Periodicidade</span>
            <span>Início</span>
            <span>Próxima</span>
            <span>Cartão</span>
            <span>Total pago</span>
            <span />
          </div>
          <div className="divide-y divide-white/5">
            {visible.map((row) => {
              const name = row.name ?? row.email ?? "Sem nome";
              const tone = row.status ? subscriptionStatusTone[row.status] : "muted";
              const refundable = row.latestPayment
                ? Math.max(
                    0,
                    row.latestPayment.amount_cents -
                      row.latestPayment.amount_refunded_cents,
                  )
                : 0;
              const canManage =
                row.kind === "subscription" &&
                row.status !== null &&
                ["active", "trialing", "past_due", "paused"].includes(row.status);

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[minmax(0,1.3fr)_6.5rem_6.5rem_5.5rem_6rem_5.5rem_5.5rem_5.5rem_6rem_2.5rem] items-center gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      name={row.name}
                      email={row.email}
                      avatarUrl={row.avatarUrl}
                      size="lg"
                      rounded="xl"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.email}
                        {row.billingExempt ? " · cortesia" : ""}
                        {row.cancelAtPeriodEnd ? " · cancela no fim" : ""}
                      </p>
                      {row.profileId ? (
                        <Link
                          href={`/studio/students/${row.profileId}`}
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
                    {row.kind === "no_subscription" ? (
                      <Badge variant="outline" className={subscriptionStatusToneClass.muted}>
                        Sem subscrição
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={subscriptionStatusToneClass[tone]}>
                        {row.status ? subscriptionStatusLabel[row.status] : "—"}
                      </Badge>
                    )}
                    {row.collectionPaused ? (
                      <Badge variant="outline" className={subscriptionStatusToneClass.warn}>
                        Pausada
                      </Badge>
                    ) : null}
                  </div>

                  <p className="text-sm tabular-nums">
                    {row.unitAmount != null ? formatCents(row.unitAmount) : "—"}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {cadenceLabel(row.interval, row.intervalCount)}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.currentPeriodStart) || "—"}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.currentPeriodEnd) || "—"}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {row.cardBrand
                      ? `${row.cardBrand.toUpperCase()} •• ${row.cardLast4 ?? ""}`
                      : "—"}
                  </p>

                  <p className="text-sm tabular-nums">
                    {formatCents(row.totalPaidCents)}
                  </p>

                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                        aria-label="Ações"
                        title="Ações"
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-52">
                        {canManage && !row.collectionPaused ? (
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() => setConfirm({ type: "pause", id: row.id })}
                          >
                            <Pause className="size-4" />
                            Pausar
                          </DropdownMenuItem>
                        ) : null}
                        {row.kind === "subscription" && row.collectionPaused ? (
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() => setConfirm({ type: "resume", id: row.id })}
                          >
                            <Play className="size-4" />
                            Retomar
                          </DropdownMenuItem>
                        ) : null}
                        {canManage && row.plan && row.plan !== "one_to_one" ? (
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() => setChangePlanTarget(row)}
                          >
                            <ArrowRightLeft className="size-4" />
                            Mudar plano
                          </DropdownMenuItem>
                        ) : null}
                        {canManage && !row.cancelAtPeriodEnd ? (
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() => setConfirm({ type: "cancel_period", id: row.id })}
                          >
                            <Ban className="size-4" />
                            Cancelar fim período
                          </DropdownMenuItem>
                        ) : null}
                        {canManage ? (
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={pending}
                            onClick={() => setConfirm({ type: "cancel_now", id: row.id })}
                          >
                            <Ban className="size-4" />
                            Cancelar já
                          </DropdownMenuItem>
                        ) : null}
                        {refundable > 0 && row.latestPayment ? (
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() =>
                              setConfirm({
                                type: "refund",
                                paymentId: row.latestPayment!.id,
                                maxCents: refundable,
                              })
                            }
                          >
                            <RefreshCw className="size-4" />
                            Reembolsar último pagamento
                          </DropdownMenuItem>
                        ) : null}
                        {row.profileId ? (
                          <>
                            <DropdownMenuSeparator />
                            {row.billingExempt ? (
                              <DropdownMenuItem
                                disabled={pending}
                                onClick={() =>
                                  setConfirm({ type: "revoke", profileId: row.profileId! })
                                }
                              >
                                <Gift className="size-4" />
                                Revogar cortesia
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={pending}
                                onClick={() =>
                                  setConfirm({ type: "grant", profileId: row.profileId! })
                                }
                              >
                                <Gift className="size-4" />
                                Conceder cortesia
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : null}
                        {row.kind === "subscription" ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={pending}
                              onClick={() => setConfirm({ type: "resync", id: row.id })}
                            >
                              <RefreshCw className="size-4" />
                              Ressincronizar
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {searchQuery && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum registo corresponde a «{searchQuery}».
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

      <Dialog
        open={Boolean(changePlanTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setChangePlanTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mudar plano</DialogTitle>
            <DialogDescription>
              Escolhe o novo plano para {changePlanTarget?.name ?? changePlanTarget?.email}.
              A Stripe calcula a proração.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {FIXED_PLANS.filter((p) => p !== changePlanTarget?.plan).map((plan) => (
              <Button
                key={plan}
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  if (!changePlanTarget) return;
                  setConfirm({ type: "change_plan", id: changePlanTarget.id, plan });
                  setChangePlanTarget(null);
                }}
              >
                {billingPlanLabel[plan]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
