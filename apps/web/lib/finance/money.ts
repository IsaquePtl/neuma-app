export function formatCents(cents: number | null | undefined, currency = "eur") {
  const n = (cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(n);
}

export function monthsInInterval(
  interval: string | null,
  intervalCount: number | null,
) {
  const count = Math.max(1, intervalCount ?? 1);
  if (interval === "year") return 12 * count;
  if (interval === "week") return (count * 7) / 30.437;
  if (interval === "day") return count / 30.437;
  return count; // month
}

/** Variação percentual entre o valor actual e o do período anterior. */
export function deltaPercent(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  const c = current ?? 0;
  const p = previous ?? 0;
  if (p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}
