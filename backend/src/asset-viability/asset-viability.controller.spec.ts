import { Test, TestingModule } from '@nestjs/testing';
import { AssetViabilityController } from './asset-viability.controller';
import { AssetViabilityService } from './asset-viability.service';
import { ViabilitySortBy, ViabilityStatusFilter } from './dto/query-asset-viability.dto';

describe('AssetViabilityController', () => {
  let controller: AssetViabilityController;
  let service: AssetViabilityService;

  const mockAssetViabilityService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetViabilityController],
      providers: [
        { provide: AssetViabilityService, useValue: mockAssetViabilityService },
      ],
    }).compile();

    controller = module.get<AssetViabilityController>(AssetViabilityController);
    service = module.get<AssetViabilityService>(AssetViabilityService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate query to assetViabilityService.findAll', async () => {
      const mockResult = { summary: {} as any, items: [], pagination: {} as any };
      mockAssetViabilityService.findAll.mockResolvedValue(mockResult);

      const query = { page: 1, limit: 20, viabilityStatus: ViabilityStatusFilter.UNVIABLE, sortBy: ViabilitySortBy.COST_RATIO };
      const result = await controller.findAll(query);

      expect(mockAssetViabilityService.findAll).toHaveBeenCalledWith(query);
      expect(result).toBe(mockResult);
    });

    it('should support findAllAlias for singular path', async () => {
      const mockResult = { summary: {} as any, items: [], pagination: {} as any };
      mockAssetViabilityService.findAll.mockResolvedValue(mockResult);

      const query = { page: 1, limit: 10 };
      const result = await controller.findAllAlias(query);

      expect(mockAssetViabilityService.findAll).toHaveBeenCalledWith(query);
      expect(result).toBe(mockResult);
    });
  });

  describe('findOne', () => {
    it('should delegate assetId to assetViabilityService.findOne', async () => {
      const mockResult = { asset: {}, viability: {} } as any;
      mockAssetViabilityService.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOne('asset-uuid-1');

      expect(mockAssetViabilityService.findOne).toHaveBeenCalledWith('asset-uuid-1');
      expect(result).toBe(mockResult);
    });

    it('should support findOneAlias for singular path', async () => {
      const mockResult = { asset: {}, viability: {} } as any;
      mockAssetViabilityService.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOneAlias('asset-uuid-1');

      expect(mockAssetViabilityService.findOne).toHaveBeenCalledWith('asset-uuid-1');
      expect(result).toBe(mockResult);
    });
  });
});
