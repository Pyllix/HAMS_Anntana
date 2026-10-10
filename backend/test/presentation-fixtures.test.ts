import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { StepActionType, type PrismaClient } from '@prisma/client';
import {
  buildPresentationFixture,
  presentationDate,
  presentationId,
  stockBalance,
  validateFixture,
} from '../prisma/presentation/fixtures';
import {
  nextDocument,
  seedPresentation,
  type PresentationManifest,
} from '../prisma/presentation/seed';
import { assertPresentationTarget } from '../prisma/seed-presentation';
import { AssetViabilityService } from '../src/asset-viability/asset-viability.service';
import type { PrismaService } from '../src/prisma.service';
import { presentationSectionData } from '../prisma/presentation/sections';
import { originalUsers } from '../prisma/demo-identities';
import { partReceiptPlan } from '../prisma/presentation/parts';
import { partLabels } from '../prisma/presentation/labels';
import {
  originalPresentationUsers,
  originalProfile,
} from '../prisma/presentation/user-profiles';

const build = (date = '2026-10-09') =>
  buildPresentationFixture(presentationDate(date));

void test('expanded spare-part catalog has priced receipt lots, documents and consistent stock', () => {
  const fixture = build();
  assert.equal(fixture.parts.length, 20);
  const documents: string[] = [];
  for (const [index, part] of fixture.parts.entries()) {
    const receipts = partReceiptPlan(part, index, fixture.date);
    assert.equal(
      receipts.reduce((qty, receipt) => qty + receipt.qty, 0),
      part.opening,
    );
    for (const receipt of receipts) {
      assert.ok(receipt.qty > 0);
      assert.equal(receipt.totalPrice, receipt.qty * part.price);
      assert.ok(receipt.date <= fixture.date);
      documents.push(receipt.document);
    }
    if (index >= 5) {
      assert.equal(receipts.length, 2);
      assert.ok(receipts[0].date < receipts[1].date);
      assert.equal(stockBalance(fixture, part), part.opening);
      assert.equal(part.name, partLabels[part.key].name);
      assert.ok(part.unit);
    }
  }
  assert.equal(new Set(documents).size, documents.length);
  assert.ok(
    fixture.users.some(
      (user) => user.key === 'parcel' && user.role === 'PARCEL_STAFF',
    ),
  );
  validateFixture(fixture);
});

void test('presentation center can be found by the ready-assets UI and borrow API', () => {
  const fixture = build();
  const sections = fixture.sections.map(presentationSectionData);
  const center = sections.find((section) => section.code === 'CENTER');
  assert.ok(
    center,
    'Ready-assets UI disables its query without a CENTER section',
  );
  assert.equal(center.id, presentationId('section:CENTER'));
  const machines = fixture.assets.filter(
    (asset) =>
      presentationSectionData(asset.section).code === 'CENTER' &&
      asset.status === 'NORMAL' &&
      asset.availability === 'AVAILABLE',
  );
  assert.ok(machines.some((asset) => asset.key === 'live-start'));
  assert.equal(presentationSectionData('ICU').code, 'ICU');
});

void test('presentation uses all original identities and preserves workflow actor keys', () => {
  const fixture = build();
  assert.equal(fixture.users.length, originalUsers.length + 3);
  assert.equal(originalUsers.length, 28);
  assert.equal(
    new Set(originalPresentationUsers.map((user) => user.key)).size,
    28,
  );
  for (const { key, profile } of originalPresentationUsers) {
    const user = fixture.users.find((row) => row.key === key);
    assert.equal(user?.role, profile.role);
    assert.equal(user?.section, profile.sectionCode);
    assert.deepEqual(originalProfile(key), profile);
  }
  assert.equal(originalProfile('admin')?.email, 'admin@hospital.go.th');
  assert.equal(originalProfile('center')?.email, 'assetcenter@hospital.go.th');
  assert.equal(originalProfile('tech-a')?.email, 'maintenance@hospital.go.th');
  validateFixture(fixture);
});

void test('fixtures remain consistent across day/month/year/leap-year boundaries', () => {
  for (const date of [
    '2026-10-09',
    '2026-10-01',
    '2026-01-01',
    '2028-02-29',
    '2027-12-31',
  ]) {
    assert.doesNotThrow(() => validateFixture(build(date)));
  }
  assert.throws(() => presentationDate('2026-02-29'), /real YYYY-MM-DD/);
  assert.throws(() => presentationDate('2026-10-9'), /real YYYY-MM-DD/);
});

void test('business coverage includes all loan states, extension modes, repair tracks and account roles', () => {
  const f = build();
  assert.equal(new Set(f.users.map((user) => user.role)).size, 7);
  assert.equal(new Set(f.borrows.map((loan) => loan.status)).size, 8);
  assert.deepEqual(
    new Set(f.extensions.map((extension) => extension.type)),
    new Set(['ONLINE', 'DESK']),
  );
  assert.equal(
    new Set(f.extensions.map((extension) => extension.status)).size,
    4,
  );
  assert.deepEqual(
    new Set(f.repairs.filter((job) => job.track).map((job) => job.track)),
    new Set(Object.values(StepActionType)),
  );
  assert.ok(f.repairs.some((job) => job.technicians.length > 1));
  assert.ok(!f.repairs.some((job) => job.technicians.includes('tech-idle')));
  assert.ok(f.repairs.some((job) => job.rejected));
  assert.ok(f.users.some((user) => !user.verified));
  assert.ok(f.users.some((user) => user.deleted));
});

void test('recommendation fixtures have genuinely different completed usage windows and a balanced pair', () => {
  const f = build();
  const usage = (key: string) =>
    f.borrows
      .filter((loan) => loan.asset === key)
      .reduce(
        (days, loan) =>
          days +
          (loan.returnAt!.getTime() - loan.handoverAt!.getTime()) / 86_400_000,
        0,
      );
  assert.equal(usage('rotation-heavy'), 30);
  assert.equal(usage('rotation-medium'), 10);
  assert.equal(usage('rotation-new'), 0);
  assert.equal(usage('rotation-even-a'), usage('rotation-even-b'));
  const candidates = f.assets.filter(
    (asset) =>
      asset.model ===
      f.assets.find((machine) => machine.key === 'rotation-new')!.model,
  );
  assert.equal(candidates.length, 3);
  assert.ok(
    candidates.every(
      (asset) =>
        asset.status === 'NORMAL' && asset.availability === 'AVAILABLE',
    ),
  );
});

void test('real viability rules produce every intended result, including warranty precedence and zero-price assets', () => {
  const f = build();
  const service = new AssetViabilityService({} as PrismaService);
  for (const machine of f.assets.filter((asset) => asset.expectedViability)) {
    const jobs = f.repairs.filter((job) => job.asset === machine.key);
    const parts = f.txns
      .filter((txn) => jobs.some((job) => job.key === txn.job))
      .reduce(
        (sum, txn) =>
          sum +
          (txn.type === 'WITHDRAW' ? 1 : txn.type === 'RETURN' ? -1 : 0) *
            txn.qty *
            txn.unitPrice,
        0,
      );
    const result = service.evaluateViability({
      price: machine.price,
      receivedDate: machine.receivedDate,
      warrantyDate: machine.warrantyDate,
      usefulLifeYears: 5,
      cumulativeRepairCost: jobs.reduce((sum, job) => sum + job.cost, parts),
      totalRepairCount: jobs.length,
      recentRepairCount: jobs.filter(
        (job) => job.createdAt.getTime() >= f.date.getTime() - 365 * 86_400_000,
      ).length,
      now: f.date,
    });
    assert.equal(
      result.viabilityStatus,
      machine.expectedViability,
      machine.key,
    );
    if (machine.price === 0) assert.equal(result.costRatioPercentage, null);
  }
});

void test('forecast includes 18 completed calendar months and multiple departments, not only outsource bills', () => {
  const f = build();
  const txns = f.txns.filter((txn) => txn.key.startsWith('forecast-month-'));
  assert.equal(
    new Set(txns.map((txn) => txn.date.toISOString().slice(0, 7))).size,
    18,
  );
  const sections = txns.map(
    (txn) =>
      f.assets.find(
        (asset) =>
          asset.key === f.repairs.find((job) => job.key === txn.job)!.asset,
      )!.section,
  );
  assert.equal(new Set(sections).size, 3);
  assert.ok(txns.every((txn) => txn.type === 'WITHDRAW' && txn.date < f.date));
});

void test('inventory covers normal, low, empty and threshold stock without counting pending/external withdrawals', () => {
  const f = build();
  const balance = (key: string) =>
    stockBalance(f, f.parts.find((part) => part.key === key)!);
  assert.ok(balance('filter') > 5);
  assert.equal(balance('battery-low'), 2);
  assert.equal(balance('motor-empty'), 0);
  assert.equal(balance('cable-threshold'), 5);
  f.txns.push({
    ...f.txns[0],
    key: 'external-withdraw-test',
    stock: 'EXTERNAL',
    type: 'WITHDRAW',
    part: 'motor-empty',
    qty: 1,
  });
  assert.equal(balance('motor-empty'), 0);
});

void test('validator rejects mismatched state, impossible return stock, orphan references and future histories', () => {
  let f = build();
  f.assets.find((asset) => asset.key === 'loan-borrowed')!.availability =
    'AVAILABLE';
  assert.throws(() => validateFixture(f), /Inconsistent asset state/);
  f = build();
  f.txns.find((txn) => txn.type === 'RETURN')!.qty = 100;
  assert.throws(() => validateFixture(f), /Return exceeds/);
  f = build();
  f.borrows[0].asset = 'nonexistent';
  assert.throws(
    () => validateFixture(f),
    /Inconsistent asset state|Missing borrow asset/,
  );
  f = build();
  f.repairs[0].createdAt = new Date(f.date.getTime() + 86_400_000);
  assert.throws(() => validateFixture(f), /Invalid repair dates/);
});

void test('document allocation continues existing series and refuses malformed or exhausted sequences', () => {
  assert.equal(
    nextDocument('BR-202610-', [
      'BR-202609-9999',
      'BR-202610-0007',
      'BR-202610-0002',
    ]),
    'BR-202610-0008',
  );
  assert.equal(nextDocument('GOV-69', ['GOV-690028']), 'GOV-690029');
  assert.throws(
    () => nextDocument('REP-202610-', ['REP-202610-10000']),
    /Unsupported document/,
  );
  assert.throws(
    () => nextDocument('REP-202610-', ['REP-202610-9999']),
    /exhausted/,
  );
  assert.equal(
    presentationId('asset:live-start'),
    presentationId('asset:live-start'),
  );
  assert.notEqual(
    presentationId('asset:live-start'),
    presentationId('asset:metadata-edit'),
  );
});

void test('rerun preserves an existing dataset without executing fixture mutations', async () => {
  const saved: PresentationManifest = {
    version: 1,
    date: '2026-10-09',
    rows: [],
    preparation: [],
  };
  let reads = 0;
  const tx = {
    $queryRaw: () => Promise.resolve([]),
    company: {
      findUnique: () => {
        reads++;
        return Promise.resolve({
          id: presentationId('marker'),
          remark: JSON.stringify(saved),
        });
      },
    },
  };
  const prisma = {
    $transaction: (callback: (value: unknown) => unknown) =>
      Promise.resolve(callback(tx)),
  } as unknown as PrismaClient;
  const result = await seedPresentation(
    prisma,
    build(),
    'Temporary-Test-Password-Only!',
  );
  assert.equal(result.created, false);
  assert.deepEqual(result.manifest, saved);
  assert.equal(reads, 1);
});

void test('database target must be explicit and production is always rejected', () => {
  assert.throws(
    () => assertPresentationTarget(undefined, 'development'),
    /DEMO_DATABASE_URL/,
  );
  assert.throws(
    () =>
      assertPresentationTarget(
        'postgresql://localhost/hams_demo',
        'production',
        true,
      ),
    /disabled in production/,
  );
  assert.throws(
    () =>
      assertPresentationTarget('postgresql://localhost/hams', 'development'),
    /dedicated/,
  );
  assert.equal(
    assertPresentationTarget('postgresql://localhost/hams_demo', 'development'),
    'postgresql://localhost/hams_demo',
  );
  assert.equal(
    assertPresentationTarget(
      'postgresql://localhost/hams',
      'development',
      true,
    ),
    'postgresql://localhost/hams',
  );
});
