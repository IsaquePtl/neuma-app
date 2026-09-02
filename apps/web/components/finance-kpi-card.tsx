import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { deltaPercent } from "@/lib/finance/money";
import { cn } from "@/lib/utils";

export function FinanceKpiCard({
  label,
  value,
  hint,
  prevValue,
  invertTone = false,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Valor numérico do período anterior, para calcular a variação. */
  prevValue?: { current: number; previous: number };
  /** Quando true, uma subida é tratada como negativa (ex. churn). */
  invertTone?: boolean;
}) {
  const delta = prevValue
    ? deltaPercent(prevValue.current, prevValue.previous)
    : null;

  return (
    <Card className="gap-2 p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {delta !== null ? (
        <DeltaBadge delta={delta} invertTone={invertTone} />
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  );
}

function DeltaBadge({
  delta,
  invertTone,
}: {
  delta: number;
  invertTone: boolean;
}) {
  const rounded = Math.round(delta * 10) / 10;
  const isFlat = Math.abs(rounded) < 0.1;
  const isPositive = rounded > 0;
  const good = isFlat ? null : invertTone ? !isPositive : isPositive;

  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        isFlat
          ? "text-muted-foreground"
          : good
            ? "text-emerald-400"
            : "text-rose-400",
      )}
    >
      {isFlat ? (
        <Minus className="size-3" />
      ) : isPositive ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )}
      {Math.abs(rounded).toFixed(1)}% vs. período anterior
    </p>
  );
}
