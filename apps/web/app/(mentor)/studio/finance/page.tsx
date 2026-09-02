import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import {
  FinanceByPlanChart,
  FinanceMovementChart,
  FinanceRevenueChart,
} from "@/components/finance-dashboard-charts";
import { FinanceKpiCard } from "@/components/finance-kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  diagnoseStripe,
  loadFinanceDashboard,
  loadFinanceSettings,
  type StripeDiagnosticCheck,
} from "@/lib/finance/dashboard";
import { formatCents } from "@/lib/finance/money";
import { RANGE_OPTIONS, resolveFinanceRange } from "@/lib/finance/range";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeRaw } = await searchParams;
  const range = resolveFinanceRange(rangeRaw);

  const [dashboard, settings, diagnostics] = await Promise.all([
    loadFinanceDashboard(range.from, range.to, range.bucket),
    loadFinanceSettings(),
    diagnoseStripe(),
  ]);

  const goalCents = settings.mrrGoalCents;
  const goalProgress =
    goalCents && goalCents > 0
      ? Math.min(100, Math.round((dashboard.mrr_cents / goalCents) * 100))
      : null;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Studio"
        title="Dashboard"
        subtitle="MRR, receita do período e movimento de subscrições (fuso Europe/Lisbon)."
      >
        <div className="flex flex-wrap gap-1 rounded-xl bg-white/[0.04] p-1">
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r.key}
              href={`/studio/finance?range=${r.key}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                range.key === r.key
                  ? "bg-[var(--neuma-coral)]/20 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </PageHero>

      <StripeDiagnosticsPanel checks={diagnostics.checks} ok={diagnostics.ok} />

      <div className="grid gap-3 sm:grid-cols-2 desktop:grid-cols-3">
        <FinanceKpiCard
          label="MRR"
          value={formatCents(dashboard.mrr_cents)}
          hint="Subscrições activas / em teste"
          prevValue={{ current: dashboard.mrr_cents, previous: dashboard.prev.mrr_cents }}
        />
        <FinanceKpiCard
          label="ARR"
          value={formatCents(dashboard.arr_cents)}
          hint="MRR × 12"
        />
        <FinanceKpiCard
          label="Ticket médio"
          value={formatCents(dashboard.avg_ticket_cents)}
          hint="Por pagamento no período"
          prevValue={{
            current: dashboard.avg_ticket_cents,
            previous: dashboard.prev.avg_ticket_cents,
          }}
        />
        <FinanceKpiCard
          label="Receita"
          value={formatCents(dashboard.revenue_cents)}
          hint="Bruto, no período"
          prevValue={{
            current: dashboard.revenue_cents,
            previous: dashboard.prev.revenue_cents,
          }}
        />
        <FinanceKpiCard
          label="Receita líquida"
          value={formatCents(dashboard.net_revenue_cents)}
          hint={`Reembolsos: ${formatCents(dashboard.refunds_cents)}`}
          prevValue={{
            current: dashboard.net_revenue_cents,
            previous: dashboard.prev.net_revenue_cents,
          }}
        />
        <FinanceKpiCard
          label="Activas"
          value={String(dashboard.active_subscribers)}
          prevValue={{
            current: dashboard.active_subscribers,
            previous: dashboard.prev.active_subscribers,
          }}
        />
        <FinanceKpiCard
          label="Novas subscrições"
          value={String(dashboard.new_subscriptions)}
          hint="No período"
          prevValue={{
            current: dashboard.new_subscriptions,
            previous: dashboard.prev.new_subscriptions,
          }}
        />
        <FinanceKpiCard
          label="Cancelamentos"
          value={String(dashboard.cancellations)}
          hint="No período"
          invertTone
          prevValue={{
            current: dashboard.cancellations,
            previous: dashboard.prev.cancellations,
          }}
        />
        <FinanceKpiCard
          label="Churn"
          value={`${dashboard.churn_rate.toFixed(1)}%`}
          hint="Cancelamentos / (activas + cancelamentos)"
          invertTone
          prevValue={{ current: dashboard.churn_rate, previous: dashboard.prev.churn_rate }}
        />
      </div>

      {goalProgress !== null ? (
        <Card className="gap-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Meta de MRR</p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {formatCents(dashboard.mrr_cents)} / {formatCents(goalCents)}
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[var(--neuma-coral)] transition-all"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{goalProgress}% da meta</p>
        </Card>
      ) : null}

      <div className="grid gap-4 desktop:grid-cols-2">
        <Card className="gap-0 p-0">
          <CardHeader className="border-b border-white/10 px-4 py-3">
            <CardTitle className="text-sm font-medium">Receita e reembolsos</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <FinanceRevenueChart data={dashboard.series} />
          </CardContent>
        </Card>

        <Card className="gap-0 p-0">
          <CardHeader className="border-b border-white/10 px-4 py-3">
            <CardTitle className="text-sm font-medium">Novas vs. cancelamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <FinanceMovementChart data={dashboard.series} />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 p-0">
        <CardHeader className="border-b border-white/10 px-4 py-3">
          <CardTitle className="text-sm font-medium">Receita por plano</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <FinanceByPlanChart data={dashboard.by_plan} />
        </CardContent>
      </Card>
    </div>
  );
}

function StripeDiagnosticsPanel({
  checks,
  ok,
}: {
  checks: StripeDiagnosticCheck[];
  ok: boolean;
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="border-b border-white/10 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          Diagnóstico Stripe
          {ok ? (
            <CheckCircle2 className="size-4 text-emerald-400" />
          ) : (
            <XCircle className="size-4 text-rose-400" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-white/5 p-0">
        {checks.map((check) => (
          <div
            key={check.key}
            className="flex items-start gap-3 px-4 py-2.5 text-sm"
          >
            {check.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
            )}
            <div className="min-w-0">
              <p className="font-medium">{check.label}</p>
              <p className="text-xs text-muted-foreground">{check.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
