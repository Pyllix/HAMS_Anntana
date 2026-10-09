import assert from 'node:assert/strict';
import test from 'node:test';
import { apiClient } from '../src/services/apiClient';
import { getAssets } from '../src/services/assetService';
import type { Asset } from '../src/types/TypeAsset';

test('ready-to-borrow assets after the first API page remain visible in the complete asset list', async (t) => {
  const assets = Array.from({ length: 112 }, (_, index) => ({
    id: `asset-${index}`, section: { code: 'CENTER' }, status: { code: 'NORMAL' },
    availabilityStatus: { code: index < 100 ? 'UNAVAILABLE' : 'AVAILABLE' },
  } as Asset));
  const calls: Array<{ page: number; limit: number; section: unknown }> = [];
  t.mock.method(apiClient, 'get', async (url: string, config?: { params?: Record<string, unknown> }) => {
    assert.equal(url, '/asset');
    const page = Number(config?.params?.page ?? 1);
    const limit = Number(config?.params?.limit ?? 20);
    calls.push({ page, limit, section: config?.params?.section_id });
    return { data: { data: assets.slice((page - 1) * limit, page * limit), meta: {
      page, limit, total: assets.length, totalPages: Math.ceil(assets.length / limit),
      hasNextPage: page < Math.ceil(assets.length / limit),
    } } };
  });
  const result = await getAssets('center-id');
  const visible = result.filter((asset) => asset.section?.code === 'CENTER' &&
    asset.status?.code === 'NORMAL' && asset.availabilityStatus?.code === 'AVAILABLE');
  assert.equal(visible.length, 12);
  assert.equal(result.length, assets.length);
  assert.equal(new Set(result.map((asset) => asset.id)).size, assets.length);
  assert.ok(calls.every((call) => call.section === 'center-id' && call.limit <= 100));
});

test('an empty asset collection finishes after one request', async (t) => {
  let requests = 0;
  t.mock.method(apiClient, 'get', () => {
    requests += 1;
    return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0, hasNextPage: false } } });
  });
  assert.deepEqual(await getAssets(), []);
  assert.equal(requests, 1);
});
