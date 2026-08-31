import { Test, TestingModule } from '@nestjs/testing';
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
});
