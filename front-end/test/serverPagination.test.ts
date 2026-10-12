import assert from 'node:assert/strict';
import test from 'node:test';
import { apiClient } from '../src/services/apiClient';
import { apiFilters, getPage, statusCount } from '../src/services/pagedApi';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { queryFamiliesForWrite, refreshQueryFamilies } from '../src/services/queryRefreshPolicy';

test('sends page and all server filters while preserving false and zero', async (t) => {
  t.mock.method(apiClient, 'get', async (url: string, config: {params: Record<string, unknown>; signal?: AbortSignal}) => {
    assert.equal(url, '/repairs');
    assert.deepEqual(config.params, {page: 6, limit: 20, evaluatedOnly: false, sectionId: 0, statusCodes: 'WAITING_DELIVERY,COMPLETED'});
    assert.equal(config.signal?.aborted, false);
    return {data: {data: [{id: 'after-100'}], meta: {page: 6, limit: 20, total: 121, totalPages: 7}}};
  });
  const result = await getPage<{id: string}>('/repairs', {page: 6, limit: 20, evaluatedOnly: false, sectionId: 0, statusCodes: ['WAITING_DELIVERY', 'COMPLETED'], search: '', unused: 'ALL'}, new AbortController().signal);
  assert.equal(result.meta.total, 121);
  assert.equal(result.data[0]?.id, 'after-100');
});
test('rejects an incomplete legacy list instead of inventing pagination totals', async (t) => {
  t.mock.method(apiClient, 'get', async () => ({data: [{id: 'legacy'}]}));
  await assert.rejects(getPage('/repairs', {}), /pagination/);
});
test('summary distinguishes unloaded from a real zero and uses confirmed pending codes', () => {
  assert.equal(statusCount(undefined, ['PENDING_APPROVE']), undefined);
  assert.equal(statusCount({total: 200, byStatusCode: {PENDING_APPROVE: 60, APPROVED: 40, PENDING_RETURN: 90}}, ['PENDING_APPROVE', 'APPROVED']), 100);
  assert.equal(statusCount({total: 0, byStatusCode: {}}, ['PENDING_APPROVE']), 0);
  assert.deepEqual(apiFilters({empty: [], removed: undefined, all: 'ALL', falseValue: false}), {falseValue: false});
});
test('refresh targets affected modules including cross-module stock and asset changes', () => {
  const repair = queryFamiliesForWrite('/repairs/job/spare-parts/withdraw');
  for (const family of ['spareParts', 'assets', 'borrowHistory', 'repairHistory', 'spare-approval-requests']) assert.ok(repair.includes(family));
  const stock = queryFamiliesForWrite('/spare-parts/stock-in');
  assert.ok(stock.includes('partOrders'));
  assert.ok(stock.includes('spareParts'));
  assert.ok(!stock.includes('users'));
  assert.deepEqual(queryFamiliesForWrite('/auth/sign-in'), []);
});

import { assetDateRange } from '../src/services/assetDateRange';
test('date filter includes the full selected local day before paging, including month boundaries', () => {
  const date = new Date(2026, 1, 28);
  const range = assetDateRange(date, '28/2/2569', true);
  assert.equal(new Date(range.updatedAtFrom!).getTime(), new Date(2026, 1, 28).getTime());
  assert.equal(new Date(range.updatedAtTo!).getTime(), new Date(2026, 2, 1).getTime() - 1);
  assert.deepEqual(assetDateRange(date, '28/2/2569', false), {});
  const month = assetDateRange(null, 'เดือนนี้', true, new Date(2026, 9, 12));
  assert.equal(new Date(month.updatedAtFrom!).getTime(), new Date(2026, 9, 1).getTime());
  assert.equal(new Date(month.updatedAtTo!).getTime(), new Date(2026, 10, 1).getTime() - 1);
});

test('a post-write refresh replaces a pending cold-cache read and leaves unrelated queries alone', async () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false, cacheTime: Infinity}}});
  let release!: (value: string) => void;
  const oldRead = new Promise<string>(resolve => { release = resolve; });
  let calls = 0;
  const observer = new QueryObserver(client, {queryKey: ['partOrders', 'page', 1], queryFn: () => ++calls === 1 ? oldRead : Promise.resolve('fresh-after-write')});
  const unsubscribe = observer.subscribe(() => {});
  client.setQueryData(['users', 'page', 1], 'unaffected');
  try {
    assert.equal(calls, 1);
    assert.equal(client.getQueryData(['partOrders', 'page', 1]), undefined);
    await refreshQueryFamilies(client, new Set(['partOrders']));
    release('stale-before-write');
    await oldRead;
    await Promise.resolve();
    assert.equal(calls, 2);
    assert.equal(client.getQueryData(['partOrders', 'page', 1]), 'fresh-after-write');
    assert.equal(client.getQueryData(['users', 'page', 1]), 'unaffected');
  } finally { unsubscribe(); client.clear(); }
});
