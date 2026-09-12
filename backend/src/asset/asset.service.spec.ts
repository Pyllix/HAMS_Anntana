import { Test, TestingModule } from '@nestjs/testing';
import { AssetService } from './asset.service';
import { PrismaService } from 'src/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AssetService', () => {
  let service: AssetService;
  let prisma: PrismaService;

  const mockPrismaService = {
    asset: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    section: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    transfer: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AssetService>(AssetService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should filter by section_id when provided in query', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          name: 'Monitor',
          section_id: 'sec-1',
          borrowTransactions: [],
        },
      ];
      mockPrismaService.$transaction.mockResolvedValue([mockAssets, 1]);

      const result = await service.findAll({ page: 1, limit: 10, section_id: 'sec-1' });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status and type IDs when provided in query', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 10,
        asset_status_id: 1,
        availability_status_id: 1,
        asset_type_id: 2,
        equipment_type_id: 3,
      });

      expect(mockPrismaService.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            asset_status_id: 1,
            availability_status_id: 1,
            type_id: 2,
            equipment_type_id: 3,
          }),
        }),
      );
    });
  });

  describe('findBySection', () => {
    it('should throw NotFoundException if section does not exist', async () => {
      mockPrismaService.section.findUnique.mockResolvedValue(null);

      await expect(service.findBySection('invalid-sec', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return assets for existing section', async () => {
      mockPrismaService.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        name: 'IT',
      });
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findBySection('sec-1', { page: 1, limit: 10 });
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findMySectionAssets', () => {
    it('should throw BadRequestException if user has no section_id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        section_id: null,
      });

      await expect(service.findMySectionAssets('user-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return assets of user section', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        section_id: 'sec-1',
      });
      mockPrismaService.$transaction.mockResolvedValue([
        [
          {
            id: 'asset-1',
            name: 'Laptop',
            section_id: 'sec-1',
            borrowTransactions: [],
          },
        ],
        1,
      ]);

      const result = await service.findMySectionAssets('user-1', { page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('Transfer (การโอนย้ายครุภัณฑ์)', () => {
    const mockAsset = {
      id: 'asset-1',
      name: 'Ventilator PB840',
      section_id: 'sec-from',
      section: { id: 'sec-from', name: 'Center', building: 'Building A' },
      status: { id: 1, code: 'NORMAL', name: 'ปกติ' },
      availabilityStatus: { id: 1, code: 'AVAILABLE', name: 'พร้อมใช้งาน' },
      borrowTransactions: [],
    };

    const validTransferDto = {
      to_section_id: 'sec-to',
      transferDocNo: 'TF-2026-001',
      transferDate: '2026-09-15T00:00:00.000Z',
      toLocation: 'Room 301',
      remark: 'Permanent relocation to ICU',
    };

    beforeEach(() => {
      mockPrismaService.$transaction.mockImplementation(async (arg: any) => {
        if (typeof arg === 'function') {
          return arg(mockPrismaService);
        }
        return arg;
      });
    });

    describe('createTransfer', () => {
      it('TC-1: should successfully create transfer record and update asset section', async () => {
        mockPrismaService.asset.findUnique.mockResolvedValue(mockAsset);
        mockPrismaService.section.findUnique.mockResolvedValue({ id: 'sec-to', name: 'ICU' });
        mockPrismaService.asset.update.mockResolvedValue({ ...mockAsset, section_id: 'sec-to' });
        mockPrismaService.transfer.create.mockResolvedValue({
          id: 'transfer-1',
          asset_id: 'asset-1',
          transferDocNo: 'TF-2026-001',
          to_section_id: 'sec-to',
        });

        const result = await service.createTransfer('asset-1', validTransferDto, 'user-1');

        expect(mockPrismaService.asset.update).toHaveBeenCalledWith({
          where: { id: 'asset-1' },
          data: {
            section_id: 'sec-to',
            updatedBy: 'user-1',
          },
        });
        expect(mockPrismaService.transfer.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              asset_id: 'asset-1',
              to_section_id: 'sec-to',
              from_section_id: 'sec-from',
              transferDocNo: 'TF-2026-001',
            }),
          }),
        );
        expect(result.id).toBe('transfer-1');
      });

      it('TC-2: should throw BadRequestException if asset is in DISPOSAL status', async () => {
        mockPrismaService.asset.findUnique.mockResolvedValue({
          ...mockAsset,
          status: { id: 4, code: 'DISPOSAL', name: 'จำหน่าย' },
        });

        await expect(
          service.createTransfer('asset-1', validTransferDto, 'user-1'),
        ).rejects.toThrow(BadRequestException);
      });

      it('TC-3: should throw BadRequestException if asset is currently BORROWED', async () => {
        mockPrismaService.asset.findUnique.mockResolvedValue({
          ...mockAsset,
          availabilityStatus: { id: 2, code: 'BORROWED', name: 'ถูกยืม' },
        });

        await expect(
          service.createTransfer('asset-1', validTransferDto, 'user-1'),
        ).rejects.toThrow(BadRequestException);
      });

      it('TC-4: should throw BadRequestException if target section is identical to current section', async () => {
        mockPrismaService.asset.findUnique.mockResolvedValue(mockAsset);

        await expect(
          service.createTransfer('asset-1', { ...validTransferDto, to_section_id: 'sec-from' }, 'user-1'),
        ).rejects.toThrow(BadRequestException);
      });

      it('TC-5: should throw NotFoundException if target section does not exist', async () => {
        mockPrismaService.asset.findUnique.mockResolvedValue(mockAsset);
        mockPrismaService.section.findUnique.mockResolvedValue(null);

        await expect(
          service.createTransfer('asset-1', validTransferDto, 'user-1'),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('findTransferRecords', () => {
      it('TC-6: should return transfer records for a specific asset', async () => {
        mockPrismaService.asset.findUnique.mockResolvedValue(mockAsset);
        mockPrismaService.transfer.findMany.mockResolvedValue([
          { id: 'transfer-1', transferDocNo: 'TF-2026-001' },
        ]);

        const result = await service.findTransferRecords('asset-1');

        expect(mockPrismaService.transfer.findMany).toHaveBeenCalledWith({
          where: { asset_id: 'asset-1' },
          orderBy: { transferDate: 'desc' },
          include: expect.any(Object),
        });
        expect(result).toHaveLength(1);
      });
    });

    describe('findAllTransferRecords', () => {
      it('TC-7: should return paginated transfer records across all assets', async () => {
        const mockTransfers = [{ id: 'transfer-1', transferDocNo: 'TF-2026-001' }];
        mockPrismaService.$transaction.mockResolvedValue([mockTransfers, 1]);

        const result = await service.findAllTransferRecords({ page: 1, limit: 10, search: 'TF-2026' });

        expect(mockPrismaService.$transaction).toHaveBeenCalled();
        expect(result.data).toHaveLength(1);
        expect(result.meta.total).toBe(1);
      });
    });
  });
});
