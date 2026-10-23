import { addCalendarDays, thaiDateString } from "./thaiDate";

/** Convert a calendar date (YYYY-MM-DD) to the final instant of that day in Thailand. */
export function borrowDeadlineAtEndOfDay(date: string): string {
  return new Date(`${date}T23:59:59.999+07:00`).toISOString();
}
/** Keep the existing rule: extend from tomorrow, or the day after a later current deadline. */
export function minimumBorrowExtensionDate(currentReturnDate?: string | null, now = new Date()): string {
  const today = thaiDateString(now);
  const current = currentReturnDate ? new Date(currentReturnDate) : null;
  const currentDay = current && !Number.isNaN(current.getTime()) ? thaiDateString(current) : today;
  return addCalendarDays(currentDay > today ? currentDay : today, 1);
}
