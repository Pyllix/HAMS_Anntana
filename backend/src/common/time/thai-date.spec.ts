import { BadRequestException } from '@nestjs/common';
import { parseThaiDeadline, thaiCalendarDate, thaiDayEnd, thaiDayStart } from './thai-date';

describe('Thai business calendar', () => {
  it('uses the Thai date at midnight across a year boundary', () => {
    expect(thaiCalendarDate(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
  });

  it.each(['2027-01-01', '2028-02-29', '2026-10-25'])('covers the complete Thai calendar day %s', (day) => {
    const start = thaiDayStart(day);
    const end = thaiDayEnd(day);
    expect(end.getTime() - start.getTime()).toBe(86_400_000 - 1);
    expect(thaiCalendarDate(start)).toBe(day);
    expect(thaiCalendarDate(end)).toBe(day);
    expect(thaiCalendarDate(new Date(end.getTime() + 1))).not.toBe(day);
  });

  it.each(['2026-02-30', '2027-02-29', 'invalid', '2026-10-25T00:00:00Z'])('rejects invalid calendar input %s', (day) => {
    expect(() => thaiDayStart(day)).toThrow(BadRequestException);
    expect(() => thaiDayEnd(day)).toThrow(BadRequestException);
  });

  it('uses end of day for calendar deadlines and preserves supplied instants', () => {
    expect(parseThaiDeadline('2026-10-25').toISOString()).toBe('2026-10-25T16:59:59.999Z');
    expect(parseThaiDeadline('2026-10-25T23:59:59.999+07:00').toISOString()).toBe('2026-10-25T16:59:59.999Z');
    expect(parseThaiDeadline('2026-10-25T12:30:00Z').toISOString()).toBe('2026-10-25T12:30:00.000Z');
    expect(parseThaiDeadline('2026-10-25T12:30:00').toISOString()).toBe('2026-10-25T05:30:00.000Z');
  });
});
