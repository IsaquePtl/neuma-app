import { fridayOfWeek, weekFridayForPath } from "@/lib/path-period";

const MAX_WEEKS = 52;

export type AnchoredDuePlan =
  | {
      ok: true;
      durationWeeks: number;
      extendedWeeks: number;
      dueDate: string;
    }
  | { ok: false; error: string };

function utcNoon(isoDate: string) {
  return Date.parse(`${isoDate}T12:00:00Z`);
}

/**
 * Level deadlines are the Friday of the level's last week
 * (`week_number + duration_weeks + extended_weeks`). Moving the date
 * keeps that week model: extra time goes to `extended_weeks`, and an
 * earlier date spends the extension before it shortens `duration_weeks`.
 */
export function planAnchoredDueDate(input: {
  startDate: string;
  weekNumber: number;
  durationWeeks: number;
  extendedWeeks: number;
  pickedDate: string;
}): AnchoredDuePlan {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.pickedDate)) {
    return { ok: false, error: "Data inválida." };
  }
  if (!input.startDate || input.weekNumber < 1) {
    return { ok: false, error: "Este nível ainda não tem semanas no percurso." };
  }

  const dueDate = fridayOfWeek(input.pickedDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { ok: false, error: "Data inválida." };
  }

  const planned = Math.min(
    MAX_WEEKS,
    Math.max(1, Math.floor(input.durationWeeks || 1)),
  );
  const extended = Math.min(
    MAX_WEEKS,
    Math.max(0, Math.floor(input.extendedWeeks || 0)),
  );
  const currentDue = weekFridayForPath(
    input.startDate,
    input.weekNumber + planned + extended - 1,
  );
  const delta = Math.round(
    (utcNoon(dueDate) - utcNoon(currentDue)) / (7 * 86_400_000),
  );
  const nextSpan = planned + extended + delta;
  if (nextSpan < 1) {
    return { ok: false, error: "Este dia é antes do início deste nível." };
  }

  const durationWeeks = nextSpan >= planned ? planned : nextSpan;
  const extendedWeeks = nextSpan >= planned ? nextSpan - planned : 0;
  if (durationWeeks > MAX_WEEKS || extendedWeeks > MAX_WEEKS) {
    return { ok: false, error: "Este prazo fica demasiado longe." };
  }

  return { ok: true, durationWeeks, extendedWeeks, dueDate };
}
