import { BadRequestException } from '@nestjs/common';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  calendar: 'gregory',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function thaiCalendarDate(now = new Date()): string {
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function assertCalendarDate(day: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new BadRequestException('Expected a calendar date in YYYY-MM-DD format');
  }
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    throw new BadRequestException('Invalid calendar date');
  }
}

export function thaiDayStart(day: string): Date {
  assertCalendarDate(day);
  return new Date(`${day}T00:00:00.000+07:00`);
}

export function thaiDayEnd(day: string): Date {
  assertCalendarDate(day);
  return new Date(`${day}T23:59:59.999+07:00`);
}

/** Date-only deadlines mean the end of that Thai day; explicit-offset instants stay intact. */
export function parseThaiDeadline(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return thaiDayEnd(value);
  const explicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(explicitOffset ? value : `${value}+07:00`);
}
