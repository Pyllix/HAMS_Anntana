const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  calendar: "gregory",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

const displayDateOptions: Intl.DateTimeFormatOptions = {
  timeZone: "Asia/Bangkok",
  calendar: "buddhist",
  day: "2-digit",
  month: "short",
  year: "numeric",
};
const displayDateFormatter = new Intl.DateTimeFormat("th-TH", displayDateOptions);
const displayNumericDateFormatter = new Intl.DateTimeFormat("th-TH", { ...displayDateOptions, month: "2-digit" });
const displayDateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  ...displayDateOptions,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDisplayDate(value: string | null | undefined, formatter: Intl.DateTimeFormat, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : formatter.format(date);
}

export function formatThaiDisplayDate(value: string | null | undefined, fallback = "-"): string {
  return formatDisplayDate(value, displayDateFormatter, fallback);
}

export function formatThaiDisplayNumericDate(value: string | null | undefined, fallback = "-"): string {
  return formatDisplayDate(value, displayNumericDateFormatter, fallback);
}

export function formatThaiDisplayDateTime(value: string | null | undefined, fallback = "-"): string {
  return formatDisplayDate(value, displayDateTimeFormatter, fallback);
}

/** Preserve fields whose API contract is a calendar date, including a UTC-midnight encoding. */
export function calendarDateString(value?: string | null): string {
  if (!value) return "";
  const day = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(value)?.[1];
  if (!day) return "";
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return "";
  if (value.length > 10 && Number.isNaN(new Date(value).getTime())) return "";
  return day;
}

const calendarFormatters = {
  "2-digit": new Intl.DateTimeFormat("th-TH", { ...displayDateOptions, timeZone: "UTC", month: "2-digit" }),
  short: new Intl.DateTimeFormat("th-TH", { ...displayDateOptions, timeZone: "UTC", month: "short" }),
  long: new Intl.DateTimeFormat("th-TH", { ...displayDateOptions, timeZone: "UTC", month: "long" }),
};

export function formatThaiCalendarDate(value?: string | null, month: keyof typeof calendarFormatters = "short"): string {
  const day = calendarDateString(value);
  return day ? calendarFormatters[month].format(new Date(`${day}T00:00:00.000Z`)) : "-";
}

export function thaiDateString(now = new Date()): string {
  const parts = Object.fromEntries(dateFormatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function thaiTimeString(now = new Date()): string {
  return timeFormatter.format(now);
}

/** Convert a server timestamp to its calendar day in Thailand. */
export function timestampDateString(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : thaiDateString(date);
}

export function thaiDateTimeRange(startDay: string, endDay = startDay): { startDate: Date; endDate: Date } {
  return {
    startDate: new Date(`${startDay}T00:00:00.000+07:00`),
    endDate: new Date(`${endDay}T23:59:59.999+07:00`),
  };
}

export function thaiMonthDateRange(month: string): { startDate: Date; endDate: Date } {
  const firstDay = `${month}-01`;
  const nextMonth = new Date(`${firstDay}T00:00:00.000Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return thaiDateTimeRange(firstDay, addCalendarDays(nextMonth.toISOString().slice(0, 10), -1));
}

/** A local Date used only as a date-picker container, not as an API timestamp. */
export function thaiCalendarToday(now = new Date()): Date {
  return new Date(`${thaiDateString(now)}T00:00:00`);
}

/** Calendar arithmetic only: UTC avoids the host's timezone and daylight-saving changes. */
export function addCalendarDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
