import { addCalendarDays, calendarDateString, thaiDateString } from "./thaiDate";

/** The assessment form accepts either a positive day count or a selected calendar date. */
export function repairDueDate(value: string | number, now = new Date()): string {
  const today = thaiDateString(now);
  const days = Number(value);
  if (Number.isFinite(days) && days > 0) return addCalendarDays(today, days);
  return calendarDateString(String(value)) || today;
}
