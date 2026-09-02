"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCents } from "@/lib/finance/money";
import { billingPlanLabel } from "@/lib/labels";
import type {
  FinanceDashboardByPlan,
  FinanceDashboardSeriesPoint,
} from "@/lib/finance/dashboard";

const AXIS_TICK = { fill: "rgba(255,255,255,0.45)", fontSize: 11 };
const TOOLTIP_STYLE = {
  background: "rgba(20,20,20,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
};

const PLAN_COLORS: Record<string, string> = {
  monthly: "var(--neuma-coral)",
  quarterly: "var(--neuma-blue)",
  annual: "#a78bfa",
  one_to_one: "#34d399",
  desconhecido: "rgba(255,255,255,0.3)",
};

function formatBucketLabel(bucket: string): string {
  const d = new Date(`${bucket}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return bucket;
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Lisbon",
  });
}

function planLabel(plan: string): string {
  return (billingPlanLabel as Record<string, string>)[plan] ?? plan;
}

export function FinanceRevenueChart({
  data,
}: {
  data: FinanceDashboardSeriesPoint[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sem movimentos neste período.
      </p>
    );
  }

  const chartData = data.map((point) => ({
    label: formatBucketLabel(point.bucket),
    receita: point.revenue_cents / 100,
    reembolsos: point.refunds_cents / 100,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="financeRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--neuma-coral)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--neuma-coral)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [
              new Intl.NumberFormat("pt-PT", {
                style: "currency",
                currency: "EUR",
              }).format(typeof value === "number" ? value : Number(value ?? 0)),
              name === "receita" ? "Receita" : "Reembolsos",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
            formatter={(value) => (value === "receita" ? "Receita" : "Reembolsos")}
          />
          <Area
            type="monotone"
            dataKey="receita"
            stroke="var(--neuma-coral)"
            fill="url(#financeRevenueFill)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="reembolsos"
            stroke="rgba(251, 113, 133, 0.7)"
            fill="rgba(251, 113, 133, 0.12)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinanceMovementChart({
  data,
}: {
  data: FinanceDashboardSeriesPoint[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sem movimentos neste período.
      </p>
    );
  }

  const chartData = data.map((point) => ({
    label: formatBucketLabel(point.bucket),
    novas: point.new_subs,
    cancelamentos: point.cancellations,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={30}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [
              value,
              name === "novas" ? "Novas subscrições" : "Cancelamentos",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
            formatter={(value) => (value === "novas" ? "Novas" : "Cancelamentos")}
          />
          <Bar dataKey="novas" fill="var(--neuma-blue)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar
            dataKey="cancelamentos"
            fill="rgba(251, 113, 133, 0.65)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinanceByPlanChart({
  data,
}: {
  data: FinanceDashboardByPlan[];
}) {
  const total = data.reduce((sum, d) => sum + d.revenue_cents, 0);

  if (data.length === 0 || total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sem receita por plano neste período.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="h-48 w-full max-w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue_cents"
              nameKey="plan"
              innerRadius={44}
              outerRadius={72}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.plan}
                  fill={PLAN_COLORS[entry.plan] ?? "rgba(255,255,255,0.3)"}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, _name, item) => [
                formatCents(typeof value === "number" ? value : Number(value ?? 0)),
                planLabel(String(item?.payload?.plan ?? "")),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5">
        {data.map((entry) => (
          <div
            key={entry.plan}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{
                  backgroundColor: PLAN_COLORS[entry.plan] ?? "rgba(255,255,255,0.3)",
                }}
              />
              {planLabel(entry.plan)}
            </span>
            <span className="tabular-nums">
              {formatCents(entry.revenue_cents)}
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({entry.count})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}