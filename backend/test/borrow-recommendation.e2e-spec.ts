import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { Client } from 'pg';
import { AssetBorrowService } from '../src/asset-borrow/asset-borrow.service';
import { PrismaService } from '../src/prisma.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

// These CTEs shadow the application tables. Only SELECTs run, inside a
// read-only transaction; no schema, customer records or fixtures are written.
const fixtureTables = `WITH
  asset AS (
    SELECT * FROM (VALUES
      ('suction-selected', 'EQ-2567-CEN-015', 'Suction unit', 'Devilbiss Vacu-Aide 7305', 'SN-015', DATE '2024-01-10', '', 5, 1, 'CENTER', 1, 1),
      ('suction-alternative', 'EQ-2567-CEN-016', 'Suction unit', 'Devilbiss Vacu-Aide 7305', 'SN-016', DATE '2024-02-01', '', 6, 1, 'CENTER', 1, 1),
      ('computer', 'EQ-2567-CEN-005', 'Computer', 'Lenovo ThinkPad P16s Gen 2', 'SN-005', DATE '2024-01-01', '', 5, 2, 'CENTER', 1, 1),
      ('different-type', 'EQ-2567-CEN-006', 'Different asset type', 'Devilbiss Vacu-Aide 7305', 'SN-006', DATE '2024-01-02', '', 5, 2, 'CENTER', 1, 1),
      ('different-model', 'EQ-2567-CEN-007', 'Different suction model', 'Other suction model', 'SN-007', DATE '2024-01-03', '', 5, 1, 'CENTER', 1, 1),
      ('damaged', 'EQ-2567-CEN-008', 'Damaged suction unit', 'Devilbiss Vacu-Aide 7305', 'SN-008', DATE '2024-01-04', '', 5, 1, 'CENTER', 2, 1),
      ('unavailable', 'EQ-2567-CEN-009', 'Unavailable suction unit', 'Devilbiss Vacu-Aide 7305', 'SN-009', DATE '2024-01-05', '', 5, 1, 'CENTER', 1, 2),
      ('sole-asset', 'EQ-2567-CEN-010', 'Only unit of this model', 'Unique model', 'SN-010', DATE '2024-01-06', '', 5, 1, 'CENTER', 1, 1)
    ) AS a(asset_id, noid, name, model, serial_no, receive_date, image_url, equipment_type, type_id, section_id, asset_status_id, availability_status_id)
  ),
  asset_status AS (
    SELECT * FROM (VALUES (1, 'NORMAL'), (2, 'DAMAGED')) AS s(asset_status_id, status_code)
  ),
  availability_status AS (
    SELECT * FROM (VALUES (1, 'AVAILABLE'), (2, 'UNAVAILABLE')) AS s(availability_status_id, status_code)
  ),
  sections AS (SELECT 'CENTER' AS section_id, 'Center' AS name),
  borrow_transaction AS (
    SELECT 'borrow-1' AS borrow_transaction_id, 'suction-selected' AS asset_id,
      TIMESTAMP '2026-10-01' AS return_date, TIMESTAMP '2026-09-11' AS handover_date,
      TIMESTAMP '2026-09-10' AS created_at
  )`;

interface ReferenceAsset {
  id: string;
  noid: string;
  model: string;
  type_id: number;
  equipment_type_id: number;
  receivedDate: Date;
}

describeWithDatabase(
  'Borrow recommendation eligibility (PostgreSQL fixtures)',
  () => {
    let client: Client;
    let module: TestingModule;
    let service: AssetBorrowService;

    async function queryFixtures(sql: string, values: unknown[] = []) {
      const frozenSql = sql.replace(/NOW\(\)/g, "TIMESTAMP '2026-10-08'");
      const query = /^\s*WITH\b/i.test(frozenSql)
        ? `${fixtureTables}${frozenSql.replace(/^\s*WITH\b/i, ',')}`
        : `${fixtureTables} ${frozenSql}`;
      return client.query(query, values);
    }

    beforeAll(async () => {
      client = new Client({
        connectionString: testDatabaseUrl,
        connectionTimeoutMillis: 10000,
      });
      await client.connect();
      await client.query('BEGIN READ ONLY');

      const database = {
        asset: {
          async findUnique({ where }: { where: { id: string } }) {
            const result = await queryFixtures(
              `SELECT asset_id AS id, noid, model, type_id,
              equipment_type AS equipment_type_id, receive_date AS "receivedDate"
             FROM asset WHERE asset_id = $1`,
              [where.id],
            );
            return (result.rows[0] as ReferenceAsset | undefined) ?? null;
          },
        },
        async $queryRaw(statement: Prisma.Sql) {
          return (await queryFixtures(statement.text, statement.values)).rows;
        },
      };
      module = await Test.createTestingModule({
        providers: [
          AssetBorrowService,
          { provide: PrismaService, useValue: database },
        ],
      }).compile();
      service = module.get(AssetBorrowService);
    }, 15000);

    afterAll(async () => {
      if (client) {
        await client.query('ROLLBACK');
        await client.end();
      }
      if (module) await module.close();
    });

    it('offers only available normal assets of the selected type and model, regardless of equipment category', async () => {
      const result = await service.getBorrowRecommendations({
        assetId: 'suction-selected',
      });

      expect(result.candidates.map((candidate) => candidate.assetId)).toEqual([
        'suction-alternative',
        'suction-selected',
      ]);
    });

    it('nudges toward a less-used asset of the same type and model', async () => {
      const result = await service.checkSwapRecommendation('suction-selected');

      expect(result.hasBetterAlternative).toBe(true);
      expect(result.recommendedAsset?.id).toBe('suction-alternative');
    });

    it('matches the same model despite surrounding whitespace and letter case', async () => {
      const result = await service.getBorrowRecommendations({
        assetTypeId: 1,
        model: '  devilbiss vacu-aide 7305  ',
      });

      expect(result.candidates.map((candidate) => candidate.assetId)).toEqual([
        'suction-alternative',
        'suction-selected',
      ]);
    });

    it('uses the reference type and model even when callers provide conflicting filters', async () => {
      const result = await service.getBorrowRecommendations({
        assetId: 'suction-selected',
        assetTypeId: 2,
        model: 'Lenovo ThinkPad P16s Gen 2',
      });

      expect(result.candidates.map((candidate) => candidate.assetId)).toEqual([
        'suction-alternative',
        'suction-selected',
      ]);
    });

    it('allows an explicit equipment category to narrow the type and model pool', async () => {
      const result = await service.getBorrowRecommendations({
        assetId: 'suction-selected',
        equipmentTypeId: 5,
      });

      expect(result.candidates.map((candidate) => candidate.assetId)).toEqual([
        'suction-selected',
      ]);
    });

    it('applies the same-model rule to other asset types', async () => {
      const result = await service.getBorrowRecommendations({
        assetTypeId: 2,
        model: 'Devilbiss Vacu-Aide 7305',
      });

      expect(result.candidates.map((candidate) => candidate.assetId)).toEqual([
        'different-type',
      ]);
    });

    it('limits the ranked list while preserving the total eligible count', async () => {
      const result = await service.getBorrowRecommendations({
        assetId: 'suction-selected',
        limit: 1,
      });

      expect(result.totalAvailable).toBe(2);
      expect(result.recommendedAssetId).toBe('suction-alternative');
      expect(result.candidates.map((candidate) => candidate.assetId)).toEqual([
        'suction-alternative',
      ]);
    });

    it('keeps the selected asset when no other asset shares its type and model', async () => {
      const result = await service.getBorrowRecommendations({
        assetId: 'sole-asset',
      });
      const swap = await service.checkSwapRecommendation('sole-asset');

      expect(result.candidates.map((candidate) => candidate.assetId)).toEqual([
        'sole-asset',
      ]);
      expect(swap.hasBetterAlternative).toBe(false);
      expect(swap.recommendedAsset).toBeNull();
    });
  },
);
