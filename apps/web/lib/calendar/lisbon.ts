/** Civil date/time in Europe/Lisbon, independent of the server timezone. */

const LISBON = "Europe/Lisbon";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function partsInLisbon(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LISBON,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  let hour = pick("hour");
  if (hour === 24) hour = 0;
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour,
    minute: pick("minute"),
    second: pick("second"),
  };
}

/** Offset of Europe/Lisbon at this UTC instant, in milliseconds (Lisbon − UTC). */
function lisbonOffsetMs(utcMs: number) {
  const wall = partsInLisbon(new Date(utcMs));
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  return asUtc - utcMs;
}

/** `YYYY-MM-DDTHH:mm` as shown in Portugal. */
export function lisbonDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const wall = partsInLisbon(instant);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

/**
 * Interpret a datetime-local value as Europe/Lisbon and return a UTC ISO string.
 * Returns null when the input is not `YYYY-MM-DDTHH:mm`.
 */
export function lisbonLocalToUtcIso(local: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const corrected = utcGuess - lisbonOffsetMs(utcGuess);
  return new Date(utcGuess - lisbonOffsetMs(corrected)).toISOString();
}
