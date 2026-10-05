/** Week budget shared by client steppers and server checks. */

export const MAX_LEVEL_WEEKS = 52;
export const MAX_EXTENSION_WEEKS = 12;

export function plannedWeeks(value: number | null | undefined): number {
  return value != null && value >= 1 ? Math.min(Math.floor(value), MAX_LEVEL_WEEKS) : 1;
}

export function weeksWord(n: number): string {
  return n === 1 ? "1 semana" : `${n} semanas`;
}

/** `maxForLevel` = total minus every other level's weeks. */
export function weeksOverBudgetMessage(maxForLevel: number, total: number): string {
  if (maxForLevel <= 0) {
    return `As ${total} semanas do percurso já estão todas distribuídas. Tira semanas a outro nível ou aumenta a duração.`;
  }
  return `Este nível pode ter no máximo ${weeksWord(maxForLevel)} — o resto das ${total} semanas já está distribuído.`;
}

export type WeekBudgetView = {
  total: number | null;
  used: number;
  free: number | null;
};

export function weekBudgetView(
  total: number | null,
  levels: Array<{ duration_weeks: number | null }>,
): WeekBudgetView {
  const used = levels.reduce((sum, l) => sum + plannedWeeks(l.duration_weeks), 0);
  return { total, used, free: total == null ? null : total - used };
}

/** Largest value a level's stepper may reach (current + free weeks). */
export function maxWeeksForLevel(
  budget: WeekBudgetView,
  currentWeeks: number,
): number {
  if (budget.free == null) return MAX_LEVEL_WEEKS;
  return Math.min(MAX_LEVEL_WEEKS, Math.max(currentWeeks, currentWeeks + budget.free));
}
