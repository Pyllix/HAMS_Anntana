import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AssetViabilityService } from './asset-viability.service';
import { PrismaService } from 'src/prisma.service';
import {
  ViabilitySortBy,
  ViabilityStatusFilter,
} from './dto/query-asset-viability.dto';

describe('AssetViabilityService', () => {
  interface MockPrismaService {
    $queryRaw: jest.Mock<Promise<unknown>, [Prisma.Sql]>;
    $transaction: jest.Mock<
      Promise<unknown>,
      [(transaction: MockPrismaService) => Promise<unknown>]
    >;
    asset: {
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock;
      update: jest.Mock<Promise<unknown>, [unknown]>;
    };
    assetStatus: { findUnique: jest.Mock };
    availabilityStatus: { findUnique: jest.Mock };
  }

  let service: AssetViabilityService;

  const mockPrismaService: MockPrismaService = {
    $queryRaw: jest.fn<Promise<unknown>, [Prisma.Sql]>(),
    $transaction: jest.fn<
      Promise<unknown>,
      [(transaction: MockPrismaService) => Promise<unknown>]
    >(),
    asset: {
      findMany: jest.fn<Promise<unknown>, [unknown]>(),
      findUnique: jest.fn(),
      update: jest.fn<Promise<unknown>, [unknown]>(),
    },
    assetStatus: {
      findUnique: jest.fn(),
    },
    availabilityStatus: {
      findUnique: jest.fn(),
    },
  };

  const getCapturedSqlQuery = (index: number): Prisma.Sql => {
    const query = mockPrismaService.$queryRaw.mock.calls[index]?.[0];
    if (query) return query;
    throw new Error(`Expected Prisma SQL query at call ${index}`);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetViabilityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AssetViabilityService>(AssetViabilityService);
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation(
      async (callback: (transaction: typeof mockPrismaService) => unknown) =>
        await callback(mockPrismaService),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── 1. Rule-based Decision Tree Unit Tests ─────────────────────────────────

  describe('evaluateViability (Decision Tree Logic)', () => {
    const fixedNow = new Date('2026-09-11T00:00:00.000Z');

    it('TC-01: should evaluate as VIABLE for normal asset with low cost and remaining useful life', () => {
      // 1 year old asset, 10% repair cost, useful life 5 years
      const oneYearAgo = new Date('2025-09-11T00:00:00.000Z');
      const result = service.evaluateViability({
        price: 100000,
        receivedDate: oneYearAgo,
        warrantyDate: null,
        usefulLifeYears: 5,
        cumulativeRepairCost: 10000,
        totalRepairCount: 1,
        recentRepairCount: 1,
        now: fixedNow,
      });

      expect(result.viabilityStatus).toBe('VIABLE');
      expect(result.costRatioPercentage).toBe(10);
      expect(result.ageYears).toBe(1);
      expect(result.isUsefulLifeExceeded).toBe(false);
      expect(result.isWarrantyActive).toBe(false);
      expect(result.viabilityReason).toContain('คุ้มค่าต่อการซ่อมบำรุง');
    });

    it('TC-02: should evaluate as VIABLE when active warranty is present', () => {
      const result = service.evaluateViability({
        price: 200000,
        receivedDate: new Date('2025-01-01T00:00:00.000Z'),
        warrantyDate: '2028-12-31',
        usefulLifeYears: 5,
        cumulativeRepairCost: 0,
        totalRepairCount: 0,
        recentRepairCount: 0,
        now: fixedNow,
      });

      expect(result.viabilityStatus).toBe('VIABLE');
      expect(result.isWarrantyActive).toBe(true);
      expect(result.viabilityReason).toContain('อยู่ในระยะรับประกันการใช้งาน');
    });

    it('TC-03: should evaluate as UNVIABLE when cumulative repair cost ratio >= 70%', () => {
      // 3 years old, 76% repair cost
      const threeYearsAgo = new Date('2023-09-11T00:00:00.000Z');
      const result = service.evaluateViability({
        price: 50000,
        receivedDate: threeYearsAgo,
        warrantyDate: null,
        usefulLifeYears: 5,
        cumulativeRepairCost: 38000,
        totalRepairCount: 2,
        recentRepairCount: 1,
        now: fixedNow,
      });

      expect(result.viabilityStatus).toBe('UNVIABLE');
      expect(result.costRatioPercentage).toBe(76);
      expect(result.viabilityReason).toContain(
        'เกินเกณฑ์ร้อยละ 70 ตามระเบียบพัสดุ',
      );
    });

    it('TC-04: should evaluate as UNVIABLE when useful life is exceeded AND cost ratio >= 50%', () => {
      // 6 years old (useful life 5), 55% cost ratio
      const sixYearsAgo = new Date('2020-09-11T00:00:00.000Z');
      const result = service.evaluateViability({
        price: 100000,
        receivedDate: sixYearsAgo,
        warrantyDate: null,
        usefulLifeYears: 5,
        cumulativeRepairCost: 55000,
        totalRepairCount: 2,
        recentRepairCount: 1,
        now: fixedNow,
      });

      expect(result.viabilityStatus).toBe('UNVIABLE');
      expect(result.isUsefulLifeExceeded).toBe(true);
      expect(result.costRatioPercentage).toBe(55);
      expect(result.viabilityReason).toContain('เกินอายุขัยมาตรฐาน');
    });

    it('TC-05: should evaluate as WARNING when cost ratio is between 50% and 70% but useful life not exceeded', () => {
      // 3 years old (useful life 5), 55% cost ratio
      const threeYearsAgo = new Date('2023-09-11T00:00:00.000Z');
      const result = service.evaluateViability({
        price: 100000,
        receivedDate: threeYearsAgo,
        warrantyDate: null,
        usefulLifeYears: 5,
        cumulativeRepairCost: 55000,
        totalRepairCount: 2,
        recentRepairCount: 1,
        now: fixedNow,
      });

      expect(result.viabilityStatus).toBe('WARNING');
      expect(result.isUsefulLifeExceeded).toBe(false);
      expect(result.costRatioPercentage).toBe(55);
      expect(result.viabilityReason).toContain('เข้าข่ายเฝ้าระวังช่วง 50–70%');
    });

    it('TC-06: should evaluate as WARNING when useful life is exceeded but cost is low', () => {
      // 6 years old (useful life 5), 5% cost ratio, total repairs 1
      const sixYearsAgo = new Date('2020-09-11T00:00:00.000Z');
      const result = service.evaluateViability({
        price: 100000,
        receivedDate: sixYearsAgo,
        warrantyDate: null,
        usefulLifeYears: 5,
        cumulativeRepairCost: 5000,
        totalRepairCount: 1,
        recentRepairCount: 0,
        now: fixedNow,
      });

      expect(result.viabilityStatus).toBe('WARNING');
      expect(result.isUsefulLifeExceeded).toBe(true);
      expect(result.costRatioPercentage).toBe(5);
      expect(result.viabilityReason).toContain('ครบอายุขัยมาตรฐาน');
    });

    it('TC-07: should evaluate as WARNING when recent repair frequency >= 3 in past 12 months', () => {
      const twoYearsAgo = new Date('2024-09-11T00:00:00.000Z');
      const result = service.evaluateViability({
        price: 100000,
        receivedDate: twoYearsAgo,
        warrantyDate: null,
        usefulLifeYears: 5,
        cumulativeRepairCost: 20000,
        totalRepairCount: 4,
        recentRepairCount: 4,
        now: fixedNow,
      });

      expect(result.viabilityStatus).toBe('WARNING');
      expect(result.viabilityReason).toContain(
        'ส่งซ่อมถี่ผิดปกติ (4 ครั้งในรอบ 12 เดือนล่าสุด)',
      );
    });

    it('TC-08: should evaluate as UNVIABLE for donated/zero-price asset with expired life and breakdown history', () => {
      const sevenYearsAgo = new Date('2019-09-11T00:00:00.000Z');
      const result = service.evaluateViability({
        price: 0, // donated / building attachment
        receivedDate: sevenYearsAgo,
        warrantyDate: null,
        usefulLifeYears: 5,
        cumulativeRepairCost: 15000,
        totalRepairCount: 4,
        recentRepairCount: 2,
        now: fixedNow,
      });

      expect(result.viabilityStatus).toBe('UNVIABLE');
      expect(result.costRatioPercentage).toBeNull();
      expect(result.viabilityReason).toContain(
        'ไม่มีราคาจัดซื้อ (บริจาค/โอนย้าย)',
      );
    });

    it('TC-09: should fallback to default 8 years when useful life is 0 or negative', () => {
      const nineYearsAgo = new Date('2017-09-11T00:00:00.000Z');
      const result = service.evaluateViability({
        price: 100000,
        receivedDate: nineYearsAgo,
        warrantyDate: null,
        usefulLifeYears: 0, // not specified
        cumulativeRepairCost: 5000,
        totalRepairCount: 1,
        recentRepairCount: 0,
        now: fixedNow,
      });

      expect(result.usefulLifeYears).toBe(8);
      expect(result.isUsefulLifeExceeded).toBe(true);
    });

    it('TC-10: should clamp age to 0 if receivedDate is in the future or null', () => {
      const futureDate = new Date('2029-01-01T00:00:00.000Z');
      const result = service.evaluateViability({
        price: 100000,
        receivedDate: futureDate,
        warrantyDate: null,
        usefulLifeYears: 5,
        cumulativeRepairCost: 0,
        totalRepairCount: 0,
        recentRepairCount: 0,
        now: fixedNow,
      });

      expect(result.ageYears).toBe(0);
      expect(result.viabilityStatus).toBe('VIABLE');
    });
  });

  // ─── 2. Service Method findAll Tests ───────────────────────────────────────

  describe('findAll', () => {
    const makeCandidate = (
      id: string,
      price: string,
      receivedDate: string,
      repairCost: string,
      repairCount: number,
    ) => ({
      asset_id: id,
      price,
      receive_date: receivedDate,
      warranty_date: null,
      created_at: receivedDate,
      useful_life_years: 5,
      total_repair_count: repairCount,
      recent_repair_count: 0,
      cumulative_repair_cost: repairCost,
    });

    const makeAssetDetail = (id: string) => ({
      id,
      noid: `MD-${id}`,
      name: `Asset ${id}`,
      model: 'Model 1',
      serialNo: `SN-${id}`,
      type: { id: 1, name: 'เครื่องมือแพทย์' },
      section: { id: 'sec-1', name: 'ICU' },
      status: { id: 1, code: 'NORMAL', name: 'ใช้งานปกติ' },
    });

    it('should preserve summary values and fetch display details for the requested page only', async () => {
      const mockRows = [
        makeCandidate(
          'asset-viable',
          '100000',
          '2025-01-01T00:00:00.000Z',
          '10000',
          1,
        ),
        makeCandidate(
          'asset-unviable',
          '50000',
          '2020-01-01T00:00:00.000Z',
          '40000',
          4,
        ),
        makeCandidate(
          'asset-warning',
          '100000',
          '2025-01-01T00:00:00.000Z',
          '55000',
          1,
        ),
      ];

      mockPrismaService.$queryRaw.mockResolvedValueOnce(mockRows);
      mockPrismaService.asset.findMany.mockResolvedValueOnce([
        makeAssetDetail('asset-unviable'),
      ]);

      const result = await service.findAll({
        page: 1,
        limit: 1,
        viabilityStatus: ViabilityStatusFilter.ALL,
        sortBy: ViabilitySortBy.COST_RATIO,
      });

      expect(mockPrismaService.$transaction.mock.calls.length).toBe(1);
      expect(mockPrismaService.$queryRaw.mock.calls.length).toBe(1);
      expect(mockPrismaService.asset.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['asset-unviable'] } },
        select: {
          id: true,
          noid: true,
          name: true,
          model: true,
          serialNo: true,
          type: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          status: { select: { id: true, code: true, name: true } },
        },
      });
      expect(result.summary).toEqual({
        totalEvaluated: 3,
        viableCount: 1,
        warningCount: 1,
        unviableCount: 1,
        totalCumulativeRepairCost: 105000,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'asset-unviable',
        name: 'Asset asset-unviable',
        viabilityStatus: 'UNVIABLE',
        metrics: { cumulativeRepairCost: 40000 },
      });
      expect(result.items[0].viabilityReason).toContain(
        'คิดเป็น 80.0% ของราคาจัดซื้อ',
      );
      expect(result.pagination).toEqual({
        total: 3,
        page: 1,
        limit: 1,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should keep summary scoped before viability-status filtering', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([
        makeCandidate(
          'asset-viable',
          '100000',
          '2025-01-01T00:00:00.000Z',
          '10000',
          1,
        ),
        makeCandidate(
          'asset-unviable',
          '50000',
          '2020-01-01T00:00:00.000Z',
          '40000',
          4,
        ),
      ]);
      mockPrismaService.asset.findMany.mockResolvedValueOnce([
        makeAssetDetail('asset-unviable'),
      ]);

      const result = await service.findAll({
        viabilityStatus: ViabilityStatusFilter.UNVIABLE,
      });

      expect(result.summary).toEqual({
        totalEvaluated: 2,
        viableCount: 1,
        warningCount: 0,
        unviableCount: 1,
        totalCumulativeRepairCost: 50000,
      });
      expect(result.items.map((item) => item.id)).toEqual(['asset-unviable']);
      expect(result.pagination.total).toBe(1);
    });

    it('should preserve list evaluations for warranty, zero price, date, useful-life, and cost boundaries', async () => {
      const now = new Date();
      const fiveYearsAgo = new Date(
        now.getTime() - 5 * 365.25 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const futureDate = new Date(
        now.getTime() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const rows = [
        {
          ...makeCandidate(
            'asset-warranty',
            '100000',
            '2016-01-01T00:00:00.000Z',
            '70000',
            4,
          ),
          warranty_date: '2099-01-01',
        },
        {
          ...makeCandidate(
            'asset-zero-price-old-date',
            '0',
            fiveYearsAgo,
            '0',
            3,
          ),
        },
        {
          ...makeCandidate(
            'asset-zero-price-no-receive-date',
            '0',
            fiveYearsAgo,
            '0',
            3,
          ),
          receive_date: null,
          created_at: fiveYearsAgo,
        },
        {
          ...makeCandidate(
            'asset-cost-50',
            '100000',
            now.toISOString(),
            '50000',
            0,
          ),
          useful_life_years: 10,
        },
        {
          ...makeCandidate(
            'asset-cost-70',
            '100000',
            now.toISOString(),
            '70000',
            0,
          ),
          useful_life_years: 10,
        },
        makeCandidate('asset-future-receipt', '100000', futureDate, '0', 0),
        {
          ...makeCandidate(
            'asset-useful-life-cutoff',
            '100000',
            fiveYearsAgo,
            '0',
            0,
          ),
          useful_life_years: 5,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValueOnce(rows);
      mockPrismaService.asset.findMany.mockResolvedValueOnce(
        rows.map(({ asset_id }) => makeAssetDetail(asset_id)),
      );

      const result = await service.findAll({
        viabilityStatus: ViabilityStatusFilter.ALL,
      });
      const itemsById = new Map(result.items.map((item) => [item.id, item]));

      expect(result.summary).toEqual({
        totalEvaluated: 7,
        viableCount: 3,
        warningCount: 2,
        unviableCount: 2,
        totalCumulativeRepairCost: 190000,
      });
      expect(itemsById.get('asset-warranty')).toMatchObject({
        viabilityStatus: 'VIABLE',
        isWarrantyActive: true,
        metrics: { costRatioPercentage: 70 },
      });
      expect(itemsById.get('asset-zero-price-old-date')).toMatchObject({
        viabilityStatus: 'UNVIABLE',
        metrics: {
          costRatioPercentage: null,
          ageYears: 5,
          isUsefulLifeExceeded: true,
        },
      });
      expect(itemsById.get('asset-zero-price-no-receive-date')).toMatchObject({
        viabilityStatus: 'VIABLE',
        receivedDate: fiveYearsAgo,
        metrics: { costRatioPercentage: null, ageYears: 0 },
      });
      expect(itemsById.get('asset-cost-50')).toMatchObject({
        viabilityStatus: 'WARNING',
        metrics: { costRatioPercentage: 50 },
      });
      expect(itemsById.get('asset-cost-70')).toMatchObject({
        viabilityStatus: 'UNVIABLE',
        metrics: { costRatioPercentage: 70 },
      });
      expect(itemsById.get('asset-future-receipt')).toMatchObject({
        viabilityStatus: 'VIABLE',
        metrics: { ageYears: 0, isUsefulLifeExceeded: false },
      });
      expect(itemsById.get('asset-useful-life-cutoff')).toMatchObject({
        viabilityStatus: 'WARNING',
        metrics: { ageYears: 5, isUsefulLifeExceeded: true },
      });
    });

    it('should avoid fetching asset display details when the filtered page is empty', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([
        makeCandidate(
          'asset-viable',
          '100000',
          '2025-01-01T00:00:00.000Z',
          '10000',
          1,
        ),
      ]);

      const result = await service.findAll({
        viabilityStatus: ViabilityStatusFilter.UNVIABLE,
      });

      expect(result.items).toEqual([]);
      expect(mockPrismaService.$queryRaw.mock.calls.length).toBe(1);
      expect(mockPrismaService.asset.findMany).not.toHaveBeenCalled();
    });

    it('should use repair summary candidate filtering before repair aggregation', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await service.findAll({ sectionId: 'sec-icu' });

      const query = getCapturedSqlQuery(0);
      const sql = query.sql;
      expect(sql).toContain('candidate_assets AS MATERIALIZED');
      expect(sql.indexOf('candidate_assets AS MATERIALIZED')).toBeLessThan(
        sql.indexOf('repair_cost_per_job'),
      );
      expect(sql).toContain('JOIN candidate_assets');
    });

    it('should preserve the unfiltered all-assets aggregation plan', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await service.findAll({});

      const sql = getCapturedSqlQuery(0).sql;
      expect(sql).not.toContain(
        'JOIN candidate_assets ca ON ca.asset_id = rj.asset_id',
      );
      expect(sql).toContain('FROM repair_job rj');
    });

    it('should apply asset filters before repair aggregation and respect includeDisposed', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await service.findAll({
        sectionId: 'section-icu',
        assetTypeId: 4,
        search: 'monitor',
      });
      await service.findAll({ includeDisposed: true });

      const filteredQuery = getCapturedSqlQuery(0);
      expect(filteredQuery.sql).toContain('a.section_id =');
      expect(filteredQuery.sql).toContain('a.type_id =');
      expect(filteredQuery.sql).toContain('a.name ILIKE');
      expect(filteredQuery.sql).toContain(
        "ast.status_code NOT IN ('DISPOSAL', 'LOST')",
      );
      expect(filteredQuery.values).toEqual(
        expect.arrayContaining(['section-icu', 4, '%monitor%']),
      );

      const includeDisposedQuery = getCapturedSqlQuery(1);
      expect(includeDisposedQuery.sql).not.toContain(
        "ast.status_code NOT IN ('DISPOSAL', 'LOST')",
      );
    });

    it('should preserve every supported sort order before slicing a page', async () => {
      const candidates = [
        makeCandidate(
          'asset-a',
          '100000',
          '2020-01-01T00:00:00.000Z',
          '80000',
          5,
        ),
        makeCandidate(
          'asset-b',
          '100000',
          '2022-01-01T00:00:00.000Z',
          '50000',
          1,
        ),
        makeCandidate(
          'asset-c',
          '200000',
          '2024-01-01T00:00:00.000Z',
          '30000',
          3,
        ),
      ].map((candidate) => ({ ...candidate, useful_life_years: 20 }));
      for (let index = 0; index < 5; index++) {
        mockPrismaService.$queryRaw.mockResolvedValueOnce(candidates);
        mockPrismaService.asset.findMany.mockResolvedValueOnce([
          makeAssetDetail('asset-c'),
          makeAssetDetail('asset-b'),
          makeAssetDetail('asset-a'),
        ]);
      }

      const cases = [
        [ViabilitySortBy.COST_RATIO, ['asset-a', 'asset-b', 'asset-c']],
        [ViabilitySortBy.CUMULATIVE_COST, ['asset-a', 'asset-b', 'asset-c']],
        [ViabilitySortBy.REPAIR_COUNT, ['asset-a', 'asset-c', 'asset-b']],
        [ViabilitySortBy.AGE, ['asset-a', 'asset-b', 'asset-c']],
        [ViabilitySortBy.CREATED_AT, ['asset-c', 'asset-b', 'asset-a']],
      ] as const;

      for (const [sortBy, expectedIds] of cases) {
        const result = await service.findAll({
          sortBy,
          limit: 3,
        });

        expect(result.items.map((item) => item.id)).toEqual(expectedIds);
      }
    });

    it('should query assets via CTE and aggregate KPI summary correctly', async () => {
      const mockRows = [
        {
          asset_id: 'asset-1',
          price: '100000',
          receive_date: '2025-01-01T00:00:00.000Z',
          warranty_date: null,
          created_at: '2025-01-01T00:00:00.000Z',
          useful_life_years: 5,
          total_repair_count: 1,
          recent_repair_count: 1,
          cumulative_repair_cost: '10000',
        },
        {
          asset_id: 'asset-2',
          price: '50000',
          receive_date: '2020-01-01T00:00:00.000Z',
          warranty_date: null,
          created_at: '2020-01-01T00:00:00.000Z',
          useful_life_years: 5,
          total_repair_count: 4,
          recent_repair_count: 2,
          cumulative_repair_cost: '40000', // 80% -> UNVIABLE
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValueOnce(mockRows);
      mockPrismaService.asset.findMany.mockResolvedValueOnce([
        makeAssetDetail('asset-1'),
        makeAssetDetail('asset-2'),
      ]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        viabilityStatus: ViabilityStatusFilter.ALL,
        sortBy: ViabilitySortBy.COST_RATIO,
      });

      expect(mockPrismaService.$queryRaw.mock.calls.length).toBeGreaterThan(0);
      expect(result.summary.totalEvaluated).toBe(2);
      expect(result.summary.viableCount).toBe(1);
      expect(result.summary.unviableCount).toBe(1);
      expect(result.summary.totalCumulativeRepairCost).toBe(50000);
      expect(result.items.length).toBe(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter items by viabilityStatus when specified', async () => {
      const mockRows = [
        {
          asset_id: 'asset-1',
          price: '100000',
          receive_date: '2025-01-01',
          useful_life_years: 5,
          cumulative_repair_cost: '10000', // VIABLE
          total_repair_count: 1,
          recent_repair_count: 0,
        },
        {
          asset_id: 'asset-2',
          price: '50000',
          receive_date: '2020-01-01',
          useful_life_years: 5,
          cumulative_repair_cost: '40000', // 80% -> UNVIABLE
          total_repair_count: 2,
          recent_repair_count: 0,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValueOnce(mockRows);
      mockPrismaService.asset.findMany.mockResolvedValueOnce([
        makeAssetDetail('asset-2'),
      ]);

      const result = await service.findAll({
        viabilityStatus: ViabilityStatusFilter.UNVIABLE,
      });

      expect(result.summary.totalEvaluated).toBe(2); // total summary before filter
      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('asset-2');
      expect(result.items[0].viabilityStatus).toBe('UNVIABLE');
    });
  });

  // ─── 3. Service Method findOne Tests ───────────────────────────────────────

  describe('findOne', () => {
    it('should throw NotFoundException when asset is not found', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should calculate itemized repairs, net spare parts, and prefill disposal payload', async () => {
      const mockAsset = {
        id: 'asset-uuid-1',
        noid: 'MD-2567-001',
        name: 'Defibrillator',
        model: 'Zoll X Series',
        serialNo: 'SN-ZOLL-01',
        price: '300000.00',
        receivedDate: new Date('2018-01-15T00:00:00.000Z'),
        warrantyDate: '2020-01-15',
        imageUrl: '',
        type: { id: 1, name: 'เครื่องมือแพทย์', useful_life: 5 },
        section: { id: 'sec-1', name: 'ER', building: 'Emergency Building' },
        status: { id: 1, code: 'NORMAL', name: 'ใช้งานปกติ' },
        availabilityStatus: { id: 1, code: 'AVAILABLE', name: 'พร้อมใช้งาน' },
        repairJobs: [
          {
            id: 'job-1',
            jobNo: 'REP-001',
            reportType: 'Repair',
            actionType: 'WITH_PARTS',
            createdAt: new Date('2026-01-10T00:00:00.000Z'),
            symptom: 'Battery not charging',
            solution: 'Replaced internal power board',
            repairCost: '20000.00',
            sparepartTxns: [
              {
                txnType: 'WITHDRAW',
                qty: 2,
                unitPrice: '1500.00',
                sparepart: { code: 'SP-01', name: 'Capacitor' },
              },
              {
                txnType: 'RETURN',
                qty: 1,
                unitPrice: '1500.00', // returned 1 piece -> net spare parts: 1500
                sparepart: { code: 'SP-01', name: 'Capacitor' },
              },
            ],
          },
        ],
      };

      mockPrismaService.asset.findUnique.mockResolvedValue(mockAsset);

      const result = await service.findOne('asset-uuid-1');

      expect(result.asset.id).toBe('asset-uuid-1');
      expect(result.repairHistory.length).toBe(1);
      expect(result.repairHistory[0].outsourceCost).toBe(20000);
      expect(result.repairHistory[0].sparePartsCost).toBe(1500); // 3000 - 1500
      expect(result.repairHistory[0].totalCost).toBe(21500);
      expect(result.disposalRecommendation.canInitiateDisposal).toBe(true);
      expect(result.disposalRecommendation.prefillData.noid).toBe(
        'MD-2567-001',
      );
      expect(
        result.disposalRecommendation.prefillData.suggestedDocPrefix,
      ).toContain('DISP-');
    });

    it('should block disposal when asset is currently BORROWED', async () => {
      const mockAsset = {
        id: 'asset-uuid-borrowed',
        price: '100000.00',
        receivedDate: new Date('2018-01-15T00:00:00.000Z'),
        type: { useful_life: 5 },
        status: { code: 'NORMAL' },
        availabilityStatus: { code: 'BORROWED' }, // currently borrowed
        repairJobs: [],
      };

      mockPrismaService.asset.findUnique.mockResolvedValue(mockAsset);

      const result = await service.findOne('asset-uuid-borrowed');

      expect(result.disposalRecommendation.canInitiateDisposal).toBe(false);
      expect(result.disposalRecommendation.blockReason).toBe(
        'ASSET_CURRENTLY_BORROWED',
      );
    });
  });

  describe('requestDisposal', () => {
    it('should transition an asset to WAIT_DISPOSAL and UNAVAILABLE with reason', async () => {
      const mockAsset = {
        id: 'asset-1',
        noid: 'MD-001',
        name: 'เครื่องช่วยหายใจ',
        model: 'PB-840',
        remark: 'เครื่องเดิม',
        status: { id: 1, code: 'NORMAL', name: 'ใช้งานปกติ' },
        availabilityStatus: { id: 10, code: 'AVAILABLE', name: 'พร้อมใช้งาน' },
      };

      mockPrismaService.asset.findUnique.mockResolvedValue(mockAsset);
      mockPrismaService.assetStatus.findUnique.mockResolvedValue({
        id: 4,
        code: 'WAIT_DISPOSAL',
        name: 'รอจำหน่าย',
      });
      mockPrismaService.availabilityStatus.findUnique.mockResolvedValue({
        id: 13,
        code: 'UNAVAILABLE',
        name: 'ไม่พร้อมใช้งาน',
      });
      mockPrismaService.asset.update.mockResolvedValue({
        ...mockAsset,
        status: { id: 4, code: 'WAIT_DISPOSAL', name: 'รอจำหน่าย' },
        availabilityStatus: {
          id: 13,
          code: 'UNAVAILABLE',
          name: 'ไม่พร้อมใช้งาน',
        },
        remark:
          'เครื่องเดิม\n[เสนอรอจำหน่าย]: ค่าซ่อมเกิน 70% | [สถานที่พักซาก]: ห้องพักพัสดุ อาคาร A',
        updatedAt: new Date(),
      });

      const result = await service.requestDisposal(
        'asset-1',
        { reason: 'ค่าซ่อมเกิน 70%', storageLocation: 'ห้องพักพัสดุ อาคาร A' },
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(result.asset.status.code).toBe('WAIT_DISPOSAL');
      expect(result.asset.availabilityStatus.code).toBe('UNAVAILABLE');
      const updateCall: unknown =
        mockPrismaService.asset.update.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({
        where: { id: 'asset-1' },
        data: {
          asset_status_id: 4,
          availability_status_id: 13,
          updatedBy: 'user-1',
        },
      });
    });

    it('should reject when asset is currently BORROWED', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue({
        id: 'asset-borrowed',
        status: { code: 'NORMAL' },
        availabilityStatus: { code: 'BORROWED' },
      });

      await expect(
        service.requestDisposal('asset-borrowed', { reason: 'ซ่อมไม่คุ้ม' }),
      ).rejects.toThrow(
        'Cannot request disposal for an asset that is currently borrowed',
      );
    });

    it('should reject when asset is already WAIT_DISPOSAL', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue({
        id: 'asset-wait',
        status: { code: 'WAIT_DISPOSAL' },
        availabilityStatus: { code: 'UNAVAILABLE' },
      });

      await expect(
        service.requestDisposal('asset-wait', { reason: 'ซ่อมไม่คุ้ม' }),
      ).rejects.toThrow('Asset is already in WAIT_DISPOSAL status');
    });

    it('should reject when asset is already DISPOSAL', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue({
        id: 'asset-disp',
        status: { code: 'DISPOSAL' },
        availabilityStatus: { code: 'UNAVAILABLE' },
      });

      await expect(
        service.requestDisposal('asset-disp', { reason: 'ซ่อมไม่คุ้ม' }),
      ).rejects.toThrow('Asset has already been permanently disposed');
    });
  });
});
