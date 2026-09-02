import Link from "next/link";

import { PageHero } from "@/components/page-hero";
import { FinanceDashboardCharts } from "@/components/finance-dashboard-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatEuros, monthsForInterval } from "@/lib/stripe/plans";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RangeKey = "day" | "week" | "month";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "day", label: "Hoje" },
  { key: "week", label: "7 dias" },
  { key: "month", label: "Mês" },
];

const LISBON = "Europe/Lisbon";

function lisbonYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Meia-noite civil em Europe/Lisbon → instante UTC. */
function lisbonMidnightUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 12, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: LISBON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(utcGuess))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asUtc - utcGuess;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset);
}

function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

function rangeStart(range: RangeKey, now = new Date()): Date {
  const today = lisbonYmd(now);
  if (range === "day") return lisbonMidnightUtc(today);
  if (range === "week") return lisbonMidnightUtc(addCalendarDays(today, -6));
  // month: primeiro dia do mês civil em Lisboa
  const monthStart = `${today.slice(0, 7)}-01`;
  return lisbonMidnightUtc(monthStart);
}

function eachDayYmd(from: Date, to: Date): string[] {
  const days: string[] = [];
  let cursor = lisbonYmd(from);
  const end = lisbonYmd(to);
  while (cursor <= end) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

function parseRange(raw: string | undefined): RangeKey {
  if (raw === "day" || raw === "week" || raw === "month") return raw;
  return "month";
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="gap-2 p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  );
}

export default async function FinanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeRaw } = await searchParams;
  const range = parseRange(rangeRaw);
  const now = new Date();
  const start = rangeStart(range, now);
  const startIso = start.toISOString();

  const supabase = await createClient();

  const [
    { data: subscriptions },
    { data: payments },
    { data: refunds },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, status, unit_amount, interval, interval_count, created_at, canceled_at, collection_paused",
      ),
    supabase
      .from("payments")
      .select("id, amount_cents, amount_refunded_cents, paid_at")
      .gte("paid_at", startIso),
    supabase
      .from("refunds")
      .select("id, amount_cents, refunded_at")
      .gte("refunded_at", startIso),
  ]);

  const activeLike = (subscriptions ?? []).filter(
    (s) =>
      (s.status === "active" || s.status === "trialing") &&
      !s.collection_paused,
  );

  let mrrCents = 0;
  for (const s of activeLike) {
    if (s.unit_amount == null) continue;
    const months = monthsForInterval(s.interval, s.interval_count);
    if (months <= 0) continue;
    mrrCents += s.unit_amount / months;
  }
  const arrCents = mrrCents * 12;

  const revenueCents = (payments ?? []).reduce(
    (sum, p) => sum + (p.amount_cents ?? 0),
    0,
  );
  const refundsCents = (refunds ?? []).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0,
  );
  const netRevenueCents = revenueCents - refundsCents;

  const activeCount = (subscriptions ?? []).filter(
    (s) => s.status === "active" || s.status === "trialing",
  ).length;

  const newCount = (subscriptions ?? []).filter(
    (s) => s.created_at && new Date(s.created_at) >= start,
  ).length;

  const canceledCount = (subscriptions ?? []).filter(
    (s) => s.canceled_at && new Date(s.canceled_at) >= start,
  ).length;

  const churnBase = activeCount + canceledCount;
  const churnPct = churnBase > 0 ? (canceledCount / churnBase) * 100 : 0;

  const dayKeys = eachDayYmd(start, now);
  const revenueByDay = new Map(dayKeys.map((d) => [d, 0]));
  const refundsByDay = new Map(dayKeys.map((d) => [d, 0]));

  for (const p of payments ?? []) {
    if (!p.paid_at) continue;
    const key = lisbonYmd(new Date(p.paid_at));
    if (revenueByDay.has(key)) {
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + (p.amount_cents ?? 0));
    }
  }
  for (const r of refunds ?? []) {
    if (!r.refunded_at) continue;
    const key = lisbonYmd(new Date(r.refunded_at));
    if (refundsByDay.has(key)) {
      refundsByDay.set(
        key,
        (refundsByDay.get(key) ?? 0) + (r.amount_cents ?? 0),
      );
    }
  }

  const chartData = dayKeys.map((day) => ({
    day,
    label: new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      timeZone: LISBON,
    }),
    receita: (revenueByDay.get(day) ?? 0) / 100,
    reembolsos: (refundsByDay.get(day) ?? 0) / 100,
  }));

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Studio"
        title="Dashboard"
        subtitle="MRR, receita do período e movimento de subscrições (fuso Europe/Lisbon)."
      >
        <div className="flex flex-wrap gap-1 rounded-xl bg-white/[0.04] p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/studio/finance?range=${r.key}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                range === r.key
                  ? "bg-[var(--neuma-coral)]/20 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </PageHero>

      <div className="grid gap-3 sm:grid-cols-2 desktop:grid-cols-4">
        <KpiCard
          label="MRR"
          value={formatEuros(Math.round(mrrCents))}
          hint="Subscrições activas / em teste"
        />
        <KpiCard
          label="ARR"
          value={formatEuros(Math.round(arrCents))}
          hint="MRR × 12"
        />
        <KpiCard
          label="Receita do período"
          value={formatEuros(netRevenueCents)}
          hint={`Bruto ${formatEuros(revenueCents)}`}
        />
        <KpiCard
          label="Reembolsos"
          value={formatEuros(refundsCents)}
          hint="Pela data do reembolso"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 desktop:grid-cols-4">
        <KpiCard label="Activas" value={String(activeCount)} />
        <KpiCard label="Novas" value={String(newCount)} hint="No período" />
        <KpiCard
          label="Canceladas"
          value={String(canceledCount)}
          hint="No período"
        />
        <KpiCard
          label="Churn"
          value={`${churnPct.toFixed(1)}%`}
          hint="Canceladas / (activas + canceladas)"
        />
      </div>

      <Card className="gap-0 p-0">
        <CardHeader className="border-b border-white/10 px-4 py-3">
          <CardTitle className="text-sm font-medium">
            Receita diária
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <FinanceDashboardCharts data={chartData} />
        </CardContent>
      </Card>
    </div>
  );
}
