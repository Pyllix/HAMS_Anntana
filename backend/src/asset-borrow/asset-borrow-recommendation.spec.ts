import { Test, TestingModule } from '@nestjs/testing';
import { AssetBorrowService } from './asset-borrow.service';
import { AssetBorrowController } from './asset-borrow.controller';
import { PrismaService } from '../prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('Smart Asset Borrow Recommendation & Swap Nudge', () => {
  let service: AssetBorrowService;
  let controller: AssetBorrowController;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      asset: {
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetBorrowController],
      providers: [
        AssetBorrowService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AssetBorrowService>(AssetBorrowService);
    controller = module.get<AssetBorrowController>(AssetBorrowController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AssetBorrowService.getBorrowRecommendations', () => {
    it('TC-01: should return candidates sorted by usageDays90d ASC and mark the first as recommended', async () => {
      const mockDbRows = [
        {
          asset_id: 'asset-1',
          noid: 'MD-01',
          name: 'Ventilator PB840',
          model: 'PB840',
          serial_no: 'SN-01',
          receive_date: new Date('2026-01-01'),
          image_url: 'img1.png',
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 2.5,
          idle_days: 10.0,
          borrow_count_90d: 1,
        },
        {
          asset_id: 'asset-2',
          noid: 'MD-02',
          name: 'Ventilator PB840',
          model: 'PB840',
          serial_no: 'SN-02',
          receive_date: new Date('2026-01-01'),
          image_url: 'img2.png',
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 15.0,
          idle_days: 2.0,
          borrow_count_90d: 4,
        },
      ];

      prisma.$queryRaw.mockResolvedValueOnce(mockDbRows);

      const result = await service.getBorrowRecommendations({ model: 'PB840' });

      expect(result.model).toBe('PB840');
      expect(result.totalAvailable).toBe(2);
      expect(result.recommendedAssetId).toBe('asset-1');
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].isRecommended).toBe(true);
      expect(result.candidates[0].recommendationReason).toContain('ผ่านการใช้งานเพียง 2.5 วัน');
      expect(result.candidates[1].isRecommended).toBe(false);
      expect(result.candidates[1].recommendationReason).toBe('');
    });

    it('TC-02: should tie-break by idleDays DESC when usage days are identical', async () => {
      const mockDbRows = [
        {
          asset_id: 'asset-rested',
          noid: 'MD-02',
          name: 'Ventilator',
          model: 'PB840',
          serial_no: 'SN-02',
          receive_date: new Date('2026-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 5.0,
          idle_days: 30.0,
          borrow_count_90d: 2,
        },
        {
          asset_id: 'asset-busy',
          noid: 'MD-01',
          name: 'Ventilator',
          model: 'PB840',
          serial_no: 'SN-01',
          receive_date: new Date('2026-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 5.0,
          idle_days: 2.0,
          borrow_count_90d: 2,
        },
      ];

      prisma.$queryRaw.mockResolvedValueOnce(mockDbRows);

      const result = await service.getBorrowRecommendations({ model: 'PB840' });

      expect(result.recommendedAssetId).toBe('asset-rested');
      expect(result.candidates[0].idleDays).toBe(30.0);
      expect(result.candidates[0].recommendationReason).toContain('จอดพักมาแล้ว 30 วัน');
    });

    it('TC-03: should tie-break by borrowCount90d ASC when usage and idle days are identical', async () => {
      const mockDbRows = [
        {
          asset_id: 'asset-fewer-borrows',
          noid: 'MD-02',
          name: 'Ventilator',
          model: 'PB840',
          serial_no: 'SN-02',
          receive_date: new Date('2026-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 10.0,
          idle_days: 15.0,
          borrow_count_90d: 1,
        },
        {
          asset_id: 'asset-more-borrows',
          noid: 'MD-01',
          name: 'Ventilator',
          model: 'PB840',
          serial_no: 'SN-01',
          receive_date: new Date('2026-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 10.0,
          idle_days: 15.0,
          borrow_count_90d: 3,
        },
      ];

      prisma.$queryRaw.mockResolvedValueOnce(mockDbRows);

      const result = await service.getBorrowRecommendations({ model: 'PB840' });

      expect(result.recommendedAssetId).toBe('asset-fewer-borrows');
      expect(result.candidates[0].borrowCount90d).toBe(1);
    });

    it('TC-04: should fallback deterministically by ca.noid ASC', async () => {
      const mockDbRows = [
        {
          asset_id: 'asset-a',
          noid: 'MD-01',
          name: 'Ventilator',
          model: 'PB840',
          serial_no: 'SN-01',
          receive_date: new Date('2026-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 0,
          idle_days: 50.0,
          borrow_count_90d: 0,
        },
        {
          asset_id: 'asset-b',
          noid: 'MD-02',
          name: 'Ventilator',
          model: 'PB840',
          serial_no: 'SN-02',
          receive_date: new Date('2026-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 0,
          idle_days: 50.0,
          borrow_count_90d: 0,
        },
      ];

      prisma.$queryRaw.mockResolvedValueOnce(mockDbRows);

      const result = await service.getBorrowRecommendations({ model: 'PB840' });

      expect(result.recommendedAssetId).toBe('asset-a');
      expect(result.candidates[0].noid).toBe('MD-01');
    });

    it('TC-05: should display brand new asset reason when usageDays90d and borrowCount90d are 0', async () => {
      const mockDbRows = [
        {
          asset_id: 'asset-new',
          noid: 'MD-NEW',
          name: 'New Ventilator',
          model: 'PB840',
          serial_no: 'SN-NEW',
          receive_date: new Date('2026-08-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 0,
          idle_days: 41.0,
          borrow_count_90d: 0,
        },
      ];

      prisma.$queryRaw.mockResolvedValueOnce(mockDbRows);

      const result = await service.getBorrowRecommendations({ model: 'PB840' });

      expect(result.candidates[0].recommendationReason).toBe(
        '🌟 แนะนำเครื่องนี้: ครุภัณฑ์ใหม่พร้อมใช้งาน ยังไม่มีประวัติการยืมในรอบ 90 วัน',
      );
    });

    it('TC-06: should auto-derive model and equipmentTypeId when assetId is provided', async () => {
      prisma.asset.findUnique.mockResolvedValueOnce({
        model: 'DerivedModel',
        equipment_type_id: 42,
      });

      prisma.$queryRaw.mockResolvedValueOnce([]);

      await service.getBorrowRecommendations({
        assetId: 'ref-uuid',
      });

      expect(prisma.asset.findUnique).toHaveBeenCalledWith({
        where: { id: 'ref-uuid' },
        select: { model: true, equipment_type_id: true },
      });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('AssetBorrowService.checkSwapRecommendation', () => {
    it('TC-07: should return hasBetterAlternative=true when alternative has >= 3 fewer usage days', async () => {
      // 1. Mock selected asset
      prisma.asset.findUnique.mockResolvedValueOnce({
        id: 'selected-id',
        noid: 'MD-SEL-01',
        name: 'Ventilator PB840',
        model: 'PB840',
        equipment_type_id: 1,
        receivedDate: new Date('2025-01-01'),
      });

      // 2. Mock selected asset metrics query
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          borrow_count_90d: 5,
          last_return_date: new Date('2026-09-08'),
          usage_days_90d: 25.0,
          idle_days: 3.0,
        },
      ]);

      // 3. Mock getBorrowRecommendations query raw rows
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          asset_id: 'alt-id',
          noid: 'MD-ALT-02',
          name: 'Ventilator PB840',
          model: 'PB840',
          serial_no: 'SN-ALT',
          receive_date: new Date('2025-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 5.0, // 25.0 - 5.0 = 20.0 days difference (>= 3)
          idle_days: 40.0,
          borrow_count_90d: 1,
        },
        {
          asset_id: 'selected-id',
          noid: 'MD-SEL-01',
          name: 'Ventilator PB840',
          model: 'PB840',
          serial_no: 'SN-SEL',
          receive_date: new Date('2025-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 25.0,
          idle_days: 3.0,
          borrow_count_90d: 5,
        },
      ]);

      const result = await service.checkSwapRecommendation('selected-id');

      expect(result.hasBetterAlternative).toBe(true);
      expect(result.selectedAsset.id).toBe('selected-id');
      expect(result.selectedAsset.usageDays90d).toBe(25.0);
      expect(result.recommendedAsset).toBeDefined();
      expect(result.recommendedAsset?.id).toBe('alt-id');
      expect(result.recommendedAsset?.daysUsageDifference).toBe(20.0);
      expect(result.recommendedAsset?.nudgeReason).toContain('จอดพักมาแล้ว 40 วัน');
      expect(result.recommendedAsset?.nudgeReason).toContain('ผ่านการใช้งานน้อยกว่าเครื่องนี้ 20 วัน');
    });

    it('TC-08: should return hasBetterAlternative=true when selected asset usage >= 7 and alternative rested >= 7 days longer', async () => {
      // Condition 2: selectedUsageDays >= 7 && idleDiff >= 7
      // e.g. Selected usage = 8.0, idle = 2.0
      // Alternative usage = 7.0 (difference 1.0 < 3, so Condition 1 fails),
      // but alternative idle = 15.0 (idleDiff = 13 >= 7) -> Condition 2 passes!
      prisma.asset.findUnique.mockResolvedValueOnce({
        id: 'selected-id',
        noid: 'MD-SEL-01',
        name: 'Ventilator PB840',
        model: 'PB840',
        equipment_type_id: 1,
        receivedDate: new Date('2025-01-01'),
      });

      // Selected asset metrics
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          borrow_count_90d: 2,
          last_return_date: new Date('2026-09-09'),
          usage_days_90d: 8.0,
          idle_days: 2.0,
        },
      ]);

      // Recommendation pool
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          asset_id: 'alt-id',
          noid: 'MD-ALT-02',
          name: 'Ventilator PB840',
          model: 'PB840',
          serial_no: 'SN-ALT',
          receive_date: new Date('2025-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 7.0, // daysDiff = 1.0 (< 3)
          idle_days: 15.0, // idleDiff = 15 - 2 = 13 (>= 7)
          borrow_count_90d: 2,
        },
      ]);

      const result = await service.checkSwapRecommendation('selected-id');

      expect(result.hasBetterAlternative).toBe(true);
      expect(result.recommendedAsset?.id).toBe('alt-id');
      expect(result.recommendedAsset?.nudgeReason).toContain('จอดพักมาแล้ว 15 วัน');
    });

    it('TC-09: should return hasBetterAlternative=false when selected asset is already the optimal candidate', async () => {
      prisma.asset.findUnique.mockResolvedValueOnce({
        id: 'optimal-id',
        noid: 'MD-OPT-01',
        name: 'Ventilator PB840',
        model: 'PB840',
        equipment_type_id: 1,
        receivedDate: new Date('2025-01-01'),
      });

      // Selected asset has low usage and high idle
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          borrow_count_90d: 1,
          last_return_date: new Date('2026-08-01'),
          usage_days_90d: 2.0,
          idle_days: 40.0,
        },
      ]);

      // Alternative has higher usage
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          asset_id: 'optimal-id',
          noid: 'MD-OPT-01',
          name: 'Ventilator PB840',
          model: 'PB840',
          serial_no: 'SN-01',
          receive_date: new Date('2025-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 2.0,
          idle_days: 40.0,
          borrow_count_90d: 1,
        },
        {
          asset_id: 'other-id',
          noid: 'MD-OTH-02',
          name: 'Ventilator PB840',
          model: 'PB840',
          serial_no: 'SN-02',
          receive_date: new Date('2025-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 20.0,
          idle_days: 5.0,
          borrow_count_90d: 4,
        },
      ]);

      const result = await service.checkSwapRecommendation('optimal-id');

      expect(result.hasBetterAlternative).toBe(false);
      expect(result.recommendedAsset).toBeNull();
    });

    it('TC-10: should return hasBetterAlternative=false when no other available alternatives exist', async () => {
      prisma.asset.findUnique.mockResolvedValueOnce({
        id: 'sole-id',
        noid: 'MD-SOLE-01',
        name: 'Ventilator PB840',
        model: 'PB840',
        equipment_type_id: 1,
        receivedDate: new Date('2025-01-01'),
      });

      prisma.$queryRaw.mockResolvedValueOnce([
        {
          borrow_count_90d: 1,
          last_return_date: new Date('2026-09-01'),
          usage_days_90d: 15.0,
          idle_days: 10.0,
        },
      ]);

      // Candidates only return the selected asset itself
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          asset_id: 'sole-id',
          noid: 'MD-SOLE-01',
          name: 'Ventilator PB840',
          model: 'PB840',
          serial_no: 'SN-01',
          receive_date: new Date('2025-01-01'),
          image_url: null,
          equipment_type_id: 1,
          section_name: 'Center',
          usage_days_90d: 15.0,
          idle_days: 10.0,
          borrow_count_90d: 1,
        },
      ]);

      const result = await service.checkSwapRecommendation('sole-id');

      expect(result.hasBetterAlternative).toBe(false);
      expect(result.recommendedAsset).toBeNull();
    });

    it('TC-11: should throw NotFoundException when asset is not found', async () => {
      prisma.asset.findUnique.mockResolvedValueOnce(null);

      await expect(service.checkSwapRecommendation('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('AssetBorrowController Recommendations Routing', () => {
    it('should delegate getRecommendations to service.getBorrowRecommendations', async () => {
      const spy = jest
        .spyOn(service, 'getBorrowRecommendations')
        .mockResolvedValueOnce({
          model: 'PB840',
          totalAvailable: 1,
          recommendedAssetId: 'asset-1',
          candidates: [],
        });

      const query = { model: 'PB840', limit: 5 };
      const response = await controller.getRecommendations(query);

      expect(spy).toHaveBeenCalledWith(query);
      expect(response.totalAvailable).toBe(1);
    });

    it('should delegate checkSwap to service.checkSwapRecommendation', async () => {
      const spy = jest
        .spyOn(service, 'checkSwapRecommendation')
        .mockResolvedValueOnce({
          selectedAsset: {
            id: 'asset-1',
            noid: 'MD-01',
            usageDays90d: 10,
            idleDays: 2,
          },
          hasBetterAlternative: false,
          recommendedAsset: null,
        });

      const response = await controller.checkSwap({ assetId: 'asset-1' });

      expect(spy).toHaveBeenCalledWith('asset-1');
      expect(response.hasBetterAlternative).toBe(false);
    });
  });
});
