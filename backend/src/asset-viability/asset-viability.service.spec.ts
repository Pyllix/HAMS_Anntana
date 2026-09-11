import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssetViabilityService } from './asset-viability.service';
import { PrismaService } from 'src/prisma.service';
import { ViabilitySortBy, ViabilityStatusFilter } from './dto/query-asset-viability.dto';

describe('AssetViabilityService', () => {
  let service: AssetViabilityService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    asset: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    assetStatus: {
      findUnique: jest.fn(),
    },
    availabilityStatus: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetViabilityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AssetViabilityService>(AssetViabilityService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
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
      expect(result.viabilityReason).toContain('เกินเกณฑ์ร้อยละ 70 ตามระเบียบพัสดุ');
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
      expect(result.viabilityReason).toContain('ส่งซ่อมถี่ผิดปกติ (4 ครั้งในรอบ 12 เดือนล่าสุด)');
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
      expect(result.viabilityReason).toContain('ไม่มีราคาจัดซื้อ (บริจาค/โอนย้าย)');
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
    it('should query assets via CTE and aggregate KPI summary correctly', async () => {
      const mockRows = [
        {
          asset_id: 'asset-1',
          noid: 'MD-001',
          name: 'Ventilator 1',
          model: 'PB840',
          serial_no: 'SN1',
          price: '100000',
          receive_date: '2025-01-01T00:00:00.000Z',
          warranty_date: null,
          created_at: '2025-01-01T00:00:00.000Z',
          asset_type_id: 1,
          asset_type_name: 'เครื่องมือแพทย์',
          useful_life_years: 5,
          section_id: 'sec-1',
          section_name: 'ICU',
          asset_status_id: 1,
          asset_status_code: 'NORMAL',
          asset_status_name: 'ใช้งานปกติ',
          total_repair_count: 1,
          recent_repair_count: 1,
          cumulative_repair_cost: '10000',
        },
        {
          asset_id: 'asset-2',
          noid: 'MD-002',
          name: 'Ventilator 2',
          model: 'PB840',
          serial_no: 'SN2',
          price: '50000',
          receive_date: '2020-01-01T00:00:00.000Z',
          warranty_date: null,
          created_at: '2020-01-01T00:00:00.000Z',
          asset_type_id: 1,
          asset_type_name: 'เครื่องมือแพทย์',
          useful_life_years: 5,
          section_id: 'sec-1',
          section_name: 'ICU',
          asset_status_id: 1,
          asset_status_code: 'NORMAL',
          asset_status_name: 'ใช้งานปกติ',
          total_repair_count: 4,
          recent_repair_count: 2,
          cumulative_repair_cost: '40000', // 80% -> UNVIABLE
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockRows);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        viabilityStatus: ViabilityStatusFilter.ALL,
        sortBy: ViabilitySortBy.COST_RATIO,
      });

      expect(prisma.$queryRaw).toHaveBeenCalled();
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

      mockPrismaService.$queryRaw.mockResolvedValue(mockRows);

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

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
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
      expect(result.disposalRecommendation.prefillData.noid).toBe('MD-2567-001');
      expect(result.disposalRecommendation.prefillData.suggestedDocPrefix).toContain('DISP-');
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
      expect(result.disposalRecommendation.blockReason).toBe('ASSET_CURRENTLY_BORROWED');
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
        availabilityStatus: { id: 13, code: 'UNAVAILABLE', name: 'ไม่พร้อมใช้งาน' },
        remark: 'เครื่องเดิม\n[เสนอรอจำหน่าย]: ค่าซ่อมเกิน 70% | [สถานที่พักซาก]: ห้องพักพัสดุ อาคาร A',
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
      expect(mockPrismaService.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: expect.objectContaining({
            asset_status_id: 4,
            availability_status_id: 13,
            updatedBy: 'user-1',
          }),
        }),
      );
    });

    it('should reject when asset is currently BORROWED', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue({
        id: 'asset-borrowed',
        status: { code: 'NORMAL' },
        availabilityStatus: { code: 'BORROWED' },
      });

      await expect(
        service.requestDisposal('asset-borrowed', { reason: 'ซ่อมไม่คุ้ม' }),
      ).rejects.toThrow('Cannot request disposal for an asset that is currently borrowed');
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
