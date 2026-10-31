import type { CalendarDate } from '@fant/filters';

/** Days in a month (month 1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Moves one field of a date, keeping the day valid for the month. */
export function stepDate(
  date: CalendarDate,
  field: keyof CalendarDate,
  delta: number,
): CalendarDate {
  const year = field === 'year' ? Math.min(2099, Math.max(1990, date.year + delta)) : date.year;
  const month = field === 'month' ? ((date.month - 1 + delta + 12) % 12) + 1 : date.month;
  const maxDay = daysInMonth(year, month);
  const day =
    field === 'day' ? ((date.day - 1 + delta + maxDay) % maxDay) + 1 : Math.min(date.day, maxDay);
  return { year, month, day };
}
