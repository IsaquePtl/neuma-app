export type RangeKey = "day" | "week" | "month";
export type Bucket = "day" | "week" | "month";

export type FinanceRange = {
  key: RangeKey;
  label: string;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  bucket: Bucket;
};

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "day", label: "Hoje" },
  { key: "week", label: "7 dias" },
  { key: "month", label: "Mês" },
];

const LISBON_TZ = "Europe/Lisbon";

function lisbonYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Meia-noite civil em Europe/Lisbon → instante UTC. */
function lisbonMidnightUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const utcGuess = Date.UTC(y!, m! - 1, d!, 12, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: LISBON_TZ,
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
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0) - offset);
}

function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d! + days));
  return utc.toISOString().slice(0, 10);
}

function addCalendarMonths(ymd: string, months: number): string {
  const [y, m] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1 + months, 1));
  return utc.toISOString().slice(0, 10);
}

export function parseRangeKey(raw: string | undefined): RangeKey {
  if (raw === "day" || raw === "week" || raw === "month") return raw;
  return "month";
}

/**
 * Resolve o parametro ?range= num intervalo [from, to) + o intervalo
 * imediatamente anterior de igual duracao, ambos ancorados a meia-noite
 * civil em Europe/Lisbon. `to` e sempre "agora".
 */
export function resolveFinanceRange(
  raw: string | undefined,
  now: Date = new Date(),
): FinanceRange {
  const key = parseRangeKey(raw);
  const today = lisbonYmd(now);

  if (key === "day") {
    const from = lisbonMidnightUtc(today);
    const prevFrom = lisbonMidnightUtc(addCalendarDays(today, -1));
    return {
      key,
      label: "Hoje",
      from,
      to: now,
      prevFrom,
      prevTo: from,
      bucket: "day",
    };
  }

  if (key === "week") {
    const from = lisbonMidnightUtc(addCalendarDays(today, -6));
    const prevFrom = lisbonMidnightUtc(addCalendarDays(today, -13));
    return {
      key,
      label: "7 dias",
      from,
      to: now,
      prevFrom,
      prevTo: from,
      bucket: "day",
    };
  }

  // month: do primeiro dia do mês civil em Lisboa até agora.
  const monthStartYmd = `${today.slice(0, 7)}-01`;
  const from = lisbonMidnightUtc(monthStartYmd);
  const prevMonthStartYmd = addCalendarMonths(monthStartYmd, -1);
  const prevFrom = lisbonMidnightUtc(prevMonthStartYmd);
  return {
    key,
    label: "Mês",
    from,
    to: now,
    prevFrom,
    prevTo: from,
    bucket: "day",
  };
}
