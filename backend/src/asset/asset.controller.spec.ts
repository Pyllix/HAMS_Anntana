import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';

describe('AssetController', () => {
  let controller: AssetController;
  let service: AssetService;

  const mockAssetService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    findAllDisposalRecords: jest.fn(),
    createDisposal: jest.fn(),
    findDisposalRecords: jest.fn(),
    findAllTransferRecords: jest.fn(),
    createTransfer: jest.fn(),
    findTransferRecords: jest.fn(),
    findBySection: jest.fn(),
    findMySectionAssets: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetController],
      providers: [
        { provide: AssetService, useValue: mockAssetService },
      ],
    }).compile();

    controller = module.get<AssetController>(AssetController);
    service = module.get<AssetService>(AssetService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call assetService.findAll', async () => {
      const query = { page: 1, limit: 10, section_id: 'sec-1' };
      mockAssetService.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await controller.findAll(query);
      expect(mockAssetService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('findBySection', () => {
    it('should call assetService.findBySection', async () => {
      const query = { page: 1, limit: 10 };
      mockAssetService.findBySection.mockResolvedValue({ data: [], total: 0 });

      const result = await controller.findBySection('sec-1', query);
      expect(mockAssetService.findBySection).toHaveBeenCalledWith('sec-1', query);
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('findMySectionAssets', () => {
    it('should call assetService.findMySectionAssets with session user id', async () => {
      const query = { page: 1, limit: 10 };
      const session = { user: { id: 'user-123' } } as any;
      mockAssetService.findMySectionAssets.mockResolvedValue({ data: [], total: 0 });

      const result = await controller.findMySectionAssets(query, session);
      expect(mockAssetService.findMySectionAssets).toHaveBeenCalledWith('user-123', query);
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('Transfer', () => {
    it('should call assetService.createTransfer with session user id', async () => {
      const dto = {
        to_section_id: 'sec-2',
        transferDocNo: 'TF-001',
        transferDate: '2026-09-15',
      } as any;
      const session = { user: { id: 'user-1' } } as any;
      mockAssetService.createTransfer.mockResolvedValue({ id: 'tf-1' });

      const result = await controller.createTransfer('asset-1', dto, session);
      expect(mockAssetService.createTransfer).toHaveBeenCalledWith('asset-1', dto, 'user-1');
      expect(result).toEqual({ id: 'tf-1' });
    });

    it('should propagate BadRequestException when asset is UNDER_REPAIR', async () => {
      const dto = {
        to_section_id: 'sec-2',
        transferDocNo: 'TF-001',
        transferDate: '2026-09-15',
      } as any;
      const session = { user: { id: 'user-1' } } as any;
      mockAssetService.createTransfer.mockRejectedValue(
        new BadRequestException('Cannot transfer an asset that is currently under repair'),
      );

      await expect(
        controller.createTransfer('asset-1', dto, session),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call assetService.findTransferRecords', async () => {
      mockAssetService.findTransferRecords.mockResolvedValue([{ id: 'tf-1' }]);

      const result = await controller.findTransferRecords('asset-1');
      expect(mockAssetService.findTransferRecords).toHaveBeenCalledWith('asset-1');
      expect(result).toEqual([{ id: 'tf-1' }]);
    });

    it('should call assetService.findAllTransferRecords', async () => {
      const query = { page: 1, limit: 10 };
      mockAssetService.findAllTransferRecords.mockResolvedValue({ data: [], total: 0 });

      const result = await controller.findAllTransferRecords(query);
      expect(mockAssetService.findAllTransferRecords).toHaveBeenCalledWith(query);
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('updateStatus (Ticket 03)', () => {
    it('should call assetService.updateStatus with session user id', async () => {
      const session = { user: { id: 'user-1' } } as any;
      mockAssetService.updateStatus.mockResolvedValue({ id: 'asset-1', status: { code: 'NORMAL' } });

      const result = await controller.updateStatus('asset-1', 1, session);
      expect(mockAssetService.updateStatus).toHaveBeenCalledWith('asset-1', 1, 'user-1');
      expect(result).toEqual({ id: 'asset-1', status: { code: 'NORMAL' } });
    });

    it('should propagate BadRequestException when asset is BORROWED or RESERVED', async () => {
      const session = { user: { id: 'user-1' } } as any;
      mockAssetService.updateStatus.mockRejectedValue(
        new BadRequestException('Cannot update asset status to DAMAGED while asset is BORROWED'),
      );

      await expect(
        controller.updateStatus('asset-1', 2, session),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createDisposal (Ticket 03)', () => {
    it('should call assetService.createDisposal with session user id', async () => {
      const dto = {
        disposalDocNo: 'DSP-2026-001',
        approvedDate: '2026-09-20',
      } as any;
      const session = { user: { id: 'user-1' } } as any;
      mockAssetService.createDisposal.mockResolvedValue({ id: 'disp-1' });

      const result = await controller.createDisposal('asset-1', dto, session);
      expect(mockAssetService.createDisposal).toHaveBeenCalledWith('asset-1', dto, 'user-1');
      expect(result).toEqual({ id: 'disp-1' });
    });

    it('should propagate BadRequestException when asset is BORROWED or RESERVED', async () => {
      const dto = {
        disposalDocNo: 'DSP-2026-001',
        approvedDate: '2026-09-20',
      } as any;
      const session = { user: { id: 'user-1' } } as any;
      mockAssetService.createDisposal.mockRejectedValue(
        new BadRequestException('Cannot dispose an asset that is currently borrowed'),
      );

      await expect(
        controller.createDisposal('asset-1', dto, session),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update (Ticket 03)', () => {
    it('should call assetService.update with session user id for metadata updates', async () => {
      const dto = {
        name: 'Updated Name',
        model: 'Updated Model',
      } as any;
      const session = { user: { id: 'user-1' } } as any;
      mockAssetService.update.mockResolvedValue({ id: 'asset-1', name: 'Updated Name' });

      const result = await controller.update('asset-1', dto, session);
      expect(mockAssetService.update).toHaveBeenCalledWith('asset-1', dto, 'user-1');
      expect(result).toEqual({ id: 'asset-1', name: 'Updated Name' });
    });

    it('should propagate BadRequestException when updating to forbidden status on borrowed asset', async () => {
      const dto = { asset_status_id: 5 } as any;
      const session = { user: { id: 'user-1' } } as any;
      mockAssetService.update.mockRejectedValue(
        new BadRequestException('Cannot update asset status to DISPOSAL while asset is BORROWED'),
      );

      await expect(
        controller.update('asset-1', dto, session),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
