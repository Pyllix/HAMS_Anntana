import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateForecastKpis,
  formatForecastValue,
  getForecastStatusCopy,
  type ForecastStatus,
} from '../src/services/forecastPresentation';

test('provides distinct user-facing copy for every forecast status', () => {
  const statuses: ForecastStatus[] = [
    'disabled',
    'insufficient_data',
    'unavailable',
    'available',
  ];

  const messages = statuses.map((status) => getForecastStatusCopy(status).title);

  assert.equal(new Set(messages).size, statuses.length);
  assert.match(getForecastStatusCopy('disabled').message, /ย้อนหลัง/);
  assert.match(getForecastStatusCopy('unavailable').message, /ย้อนหลัง/);
});

test('shows unavailable forecast values as a dash instead of zero baht', () => {
  const kpis = calculateForecastKpis([]);

  assert.deepEqual(kpis, {
    total: null,
    average: null,
    peakMonth: null,
    peakValue: null,
  });
  assert.equal(formatForecastValue(kpis.total), '—');
  assert.equal(formatForecastValue(0), '฿0');
});

test('calculates forecast totals only from available forecast points', () => {
  const kpis = calculateForecastKpis([
    { date: '2026-09', forecast: 2000 },
    { date: '2026-10', forecast: 5000 },
  ]);

  assert.deepEqual(kpis, {
    total: 7000,
    average: 3500,
    peakMonth: '2026-10',
    peakValue: 5000,
  });
});
