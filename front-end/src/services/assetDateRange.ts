import { thaiDateString, thaiDateTimeRange, thaiMonthDateRange } from "./thaiDate";

export function assetDateRange(date: Date | null, label: string, enabled: boolean, now = new Date()): { updatedAtFrom?: string; updatedAtTo?: string } {
  if (!enabled || (!date && label !== "เดือนนี้")) return {};
  // The selected Date is a calendar container from CalendarFilterDialog.
  const selectedDay = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : null;
  const range = selectedDay ? thaiDateTimeRange(selectedDay) : thaiMonthDateRange(thaiDateString(now).slice(0, 7));
  return { updatedAtFrom: range.startDate.toISOString(), updatedAtTo: range.endDate.toISOString() };
}
