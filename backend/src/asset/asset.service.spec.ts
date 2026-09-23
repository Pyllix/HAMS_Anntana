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
    assetStatus: {
      findUnique: jest.fn(),
    },
    availabilityStatus: {
      findUnique: jest.fn(),
    },
    disposal: {
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
              transferred_by: 'user-1',
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

      it('TC-3b: should throw BadRequestException if asset is currently UNDER_REPAIR', async () => {
        mockPrismaService.asset.findUnique.mockResolvedValue({
          ...mockAsset,
          status: { id: 5, code: 'UNDER_REPAIR', name: 'อยู่ระหว่างซ่อม' },
        });

        await expect(
          service.createTransfer('asset-1', validTransferDto, 'user-1'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.createTransfer('asset-1', validTransferDto, 'user-1'),
        ).rejects.toThrow('Cannot transfer an asset that is currently under repair');
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

  describe('currentBorrowing Transformation', () => {
    it('should map active borrow transaction (e.g. APPROVED status) to currentBorrowing', async () => {
      const mockAssetWithApprovedBorrow = {
        id: 'asset-1',
        name: 'Infusion Pump',
        borrowTransactions: [
          {
            id: 'tx-1',
            borrowNo: 'BR-202609-0001',
            borrowStatus: { code: 'APPROVED', name: 'อนุมัติแล้ว' },
          },
        ],
      };
      mockPrismaService.$transaction.mockResolvedValue([[mockAssetWithApprovedBorrow], 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toHaveProperty('currentBorrowing');
      expect((result.data[0] as any).currentBorrowing).toEqual(
        expect.objectContaining({
          id: 'tx-1',
          borrowNo: 'BR-202609-0001',
          borrowStatus: { code: 'APPROVED', name: 'อนุมัติแล้ว' },
        }),
      );
      expect((result.data[0] as any).borrowTransactions).toBeUndefined();
    });

    it('should set currentBorrowing to null when there are no active borrow transactions', async () => {
      const mockAssetWithoutBorrow = {
        id: 'asset-2',
        name: 'Defibrillator',
        borrowTransactions: [],
      };
      mockPrismaService.$transaction.mockResolvedValue([[mockAssetWithoutBorrow], 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect((result.data[0] as any).currentBorrowing).toBeNull();
      expect((result.data[0] as any).borrowTransactions).toBeUndefined();
    });
  });

  describe('Disposal (Ticket 03 - Guard Direct Disposal Against Borrowed/Reserved Assets)', () => {
    const mockAsset = {
      id: 'asset-disp-1',
      name: 'Ultrasound Machine',
      section_id: 'sec-1',
      status: { id: 1, code: 'NORMAL', name: 'ปกติ' },
      availabilityStatus: { id: 1, code: 'AVAILABLE', name: 'พร้อมใช้งาน' },
      borrowTransactions: [],
    };

    const validDisposalDto = {
      disposalDocNo: 'DSP-2026-001',
      approvedDate: '2026-09-20T00:00:00.000Z',
    };

    beforeEach(() => {
      mockPrismaService.$transaction.mockImplementation(async (arg: any) => {
        if (typeof arg === 'function') {
          return arg(mockPrismaService);
        }
        return arg;
      });
    });

    it('TC-DISP-1: should throw BadRequestException if asset is currently BORROWED', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue({
        ...mockAsset,
        availabilityStatus: { id: 2, code: 'BORROWED', name: 'ถูกยืม' },
      });

      await expect(
        service.createDisposal('asset-disp-1', validDisposalDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDisposal('asset-disp-1', validDisposalDto, 'user-1'),
      ).rejects.toThrow('Cannot dispose an asset that is currently borrowed');
    });

    it('TC-DISP-2: should throw BadRequestException if asset is currently RESERVED', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue({
        ...mockAsset,
        availabilityStatus: { id: 3, code: 'RESERVED', name: 'ถูกจอง' },
      });

      await expect(
        service.createDisposal('asset-disp-1', validDisposalDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDisposal('asset-disp-1', validDisposalDto, 'user-1'),
      ).rejects.toThrow('Cannot dispose an asset that is currently reserved');
    });

    it('TC-DISP-3: should successfully create disposal record when asset is AVAILABLE', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue(mockAsset);
      mockPrismaService.assetStatus.findUnique.mockResolvedValue({ id: 4, code: 'DISPOSAL' });
      mockPrismaService.availabilityStatus.findUnique.mockResolvedValue({ id: 10, code: 'UNAVAILABLE' });
      mockPrismaService.asset.update.mockResolvedValue({
        ...mockAsset,
        status: { id: 4, code: 'DISPOSAL' },
        availabilityStatus: { id: 10, code: 'UNAVAILABLE' },
      });
      mockPrismaService.disposal.create.mockResolvedValue({
        id: 'disp-rec-1',
        asset_id: 'asset-disp-1',
        disposalDocNo: 'DSP-2026-001',
        approvedDate: new Date('2026-09-20T00:00:00.000Z'),
        asset: mockAsset,
      });

      const result = await service.createDisposal('asset-disp-1', validDisposalDto, 'user-1');

      expect(mockPrismaService.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-disp-1' },
        data: {
          asset_status_id: 4,
          availability_status_id: 10,
          updatedBy: 'user-1',
        },
      });
      expect(mockPrismaService.disposal.create).toHaveBeenCalledWith({
        data: {
          asset_id: 'asset-disp-1',
          disposalDocNo: 'DSP-2026-001',
          approvedDate: new Date(validDisposalDto.approvedDate),
        },
        include: expect.any(Object),
      });
      expect(result).toHaveProperty('id', 'disp-rec-1');
    });
  });

  describe('updateStatus (Ticket 03 - Guard Direct Status Edits Against Borrowed/Reserved Assets)', () => {
    const mockAsset = {
      id: 'asset-status-1',
      name: 'Defibrillator Lifepak 20',
      section_id: 'sec-1',
      status: { id: 1, code: 'NORMAL', name: 'ปกติ' },
      availabilityStatus: { id: 2, code: 'BORROWED', name: 'ถูกยืม' },
      borrowTransactions: [],
    };

    const forbiddenStatuses = [
      { id: 2, code: 'DAMAGED', name: 'ชำรุด' },
      { id: 3, code: 'UNDER_REPAIR', name: 'อยู่ระหว่างซ่อม' },
      { id: 4, code: 'WAIT_DISPOSAL', name: 'รอจำหน่าย' },
      { id: 5, code: 'DISPOSAL', name: 'จำหน่ายแล้ว' },
    ];

    forbiddenStatuses.forEach(({ id: targetId, code: targetCode }) => {
      it(`TC-STATUS-BORROWED: should throw BadRequestException when updating BORROWED asset to ${targetCode}`, async () => {
        mockPrismaService.asset.findUnique.mockResolvedValue({
          ...mockAsset,
          availabilityStatus: { id: 2, code: 'BORROWED', name: 'ถูกยืม' },
        });
        mockPrismaService.assetStatus.findUnique.mockResolvedValue({ id: targetId, code: targetCode });

        await expect(
          service.updateStatus('asset-status-1', targetId, 'user-1'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.updateStatus('asset-status-1', targetId, 'user-1'),
        ).rejects.toThrow(`Cannot update asset status to ${targetCode} while asset is BORROWED`);
      });

      it(`TC-STATUS-RESERVED: should throw BadRequestException when updating RESERVED asset to ${targetCode}`, async () => {
        mockPrismaService.asset.findUnique.mockResolvedValue({
          ...mockAsset,
          availabilityStatus: { id: 3, code: 'RESERVED', name: 'ถูกจอง' },
        });
        mockPrismaService.assetStatus.findUnique.mockResolvedValue({ id: targetId, code: targetCode });

        await expect(
          service.updateStatus('asset-status-1', targetId, 'user-1'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.updateStatus('asset-status-1', targetId, 'user-1'),
        ).rejects.toThrow(`Cannot update asset status to ${targetCode} while asset is RESERVED`);
      });
    });

    it('TC-STATUS-AVAILABLE: should allow updating status to DAMAGED when asset is AVAILABLE', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue({
        ...mockAsset,
        availabilityStatus: { id: 1, code: 'AVAILABLE', name: 'พร้อมใช้งาน' },
      });
      mockPrismaService.assetStatus.findUnique.mockResolvedValue({ id: 2, code: 'DAMAGED' });
      mockPrismaService.availabilityStatus.findUnique.mockResolvedValue({ id: 10, code: 'UNAVAILABLE' });
      mockPrismaService.asset.update.mockResolvedValue({
        ...mockAsset,
        status: { id: 2, code: 'DAMAGED' },
        availabilityStatus: { id: 10, code: 'UNAVAILABLE' },
      });

      const result = await service.updateStatus('asset-status-1', 2, 'user-1');

      expect(mockPrismaService.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-status-1' },
          data: expect.objectContaining({
            asset_status_id: 2,
            availability_status_id: 10,
            updatedBy: 'user-1',
          }),
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('update (Ticket 03 - Metadata Edits vs Status Edits on Borrowed Assets)', () => {
    const mockBorrowedAsset = {
      id: 'asset-edit-1',
      name: 'Patient Monitor B40',
      model: 'B40',
      serialNo: 'SN-100200',
      price: '85000.00',
      remark: 'Stationed at ER',
      section_id: 'sec-1',
      status: { id: 1, code: 'NORMAL', name: 'ปกติ' },
      availabilityStatus: { id: 2, code: 'BORROWED', name: 'ถูกยืม' },
      borrowTransactions: [
        {
          id: 'borrow-tx-1',
          borrowNo: 'BR-2026-0901',
          borrowStatus: { id: 3, code: 'BORROWED', name: 'กำลังยืม' },
        },
      ],
    };

    it('TC-UPDATE-META: should allow general property edits on BORROWED asset without altering availability or borrow state', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue(mockBorrowedAsset);
      const updatePayload = {
        name: 'Patient Monitor B40 Plus',
        model: 'B40-Pro',
        serialNo: 'SN-100200-REV',
        price: '90000.00',
        remark: 'Upgraded battery module',
      };
      mockPrismaService.asset.update.mockResolvedValue({
        ...mockBorrowedAsset,
        ...updatePayload,
      });

      const result = await service.update('asset-edit-1', updatePayload as any, 'user-1');

      expect(mockPrismaService.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-edit-1' },
        data: expect.objectContaining({
          ...updatePayload,
          updatedBy: 'user-1',
        }),
        include: expect.any(Object),
      });

      // Ensure availability_status_id was NOT modified in the update data payload
      const updateCallData = mockPrismaService.asset.update.mock.calls[0][0].data;
      expect(updateCallData.availability_status_id).toBeUndefined();

      // Ensure borrow state and availabilityStatus are intact in returned result
      expect(result).toHaveProperty('currentBorrowing');
      expect((result as any).currentBorrowing.id).toBe('borrow-tx-1');
      expect(result.availabilityStatus.code).toBe('BORROWED');
      expect(result.name).toBe('Patient Monitor B40 Plus');
    });

    it('TC-UPDATE-STATUS-FORBIDDEN: should throw BadRequestException when updating asset_status_id to DISPOSAL on BORROWED asset', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue(mockBorrowedAsset);
      mockPrismaService.assetStatus.findUnique.mockResolvedValue({ id: 5, code: 'DISPOSAL' });

      await expect(
        service.update('asset-edit-1', { asset_status_id: 5 } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('asset-edit-1', { asset_status_id: 5 } as any, 'user-1'),
      ).rejects.toThrow('Cannot update asset status to DISPOSAL while asset is BORROWED');
    });

    it('TC-UPDATE-STATUS-FORBIDDEN: should throw BadRequestException when updating asset_status_id to WAIT_DISPOSAL on RESERVED asset', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue({
        ...mockBorrowedAsset,
        availabilityStatus: { id: 3, code: 'RESERVED', name: 'ถูกจอง' },
      });
      mockPrismaService.assetStatus.findUnique.mockResolvedValue({ id: 4, code: 'WAIT_DISPOSAL' });

      await expect(
        service.update('asset-edit-1', { asset_status_id: 4 } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('asset-edit-1', { asset_status_id: 4 } as any, 'user-1'),
      ).rejects.toThrow('Cannot update asset status to WAIT_DISPOSAL while asset is RESERVED');
    });
  });
});

