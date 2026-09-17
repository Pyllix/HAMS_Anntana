import { Test, TestingModule } from '@nestjs/testing';
import { SparePartsController } from './spare-parts.controller';
import { SparePartsService } from './spare-parts.service';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { RolesGuard } from 'src/common/guards/roles.guard';

describe('SparePartsController', () => {
  let controller: SparePartsController;
  let service: SparePartsService;

  const mockSparePartsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findLowStockSummary: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    stockIn: jest.fn(),
    findSparepartHistory: jest.fn(),
    findAllTransactions: jest.fn(),
    findStockInHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SparePartsController],
      providers: [
        { provide: SparePartsService, useValue: mockSparePartsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SparePartsController>(SparePartsController);
    service = module.get<SparePartsService>(SparePartsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.create with user session id', async () => {
    const dto = {
      code: 'SP-TEST',
      name: 'Test Part',
      price: 100,
      groupId: 1,
    };
    mockSparePartsService.create.mockResolvedValue({ id: 1, ...dto });

    const session: any = { user: { id: 'u1' } };
    const res = await controller.create(dto, session);

    expect(service.create).toHaveBeenCalledWith(dto, 'u1');
    expect(res.id).toBe(1);
  });

  it('should call service.findLowStockSummary', async () => {
    mockSparePartsService.findLowStockSummary.mockResolvedValue({
      totalLowStockCount: 1,
      items: [],
    });

    const res = await controller.getLowStockSummary();
    expect(res.totalLowStockCount).toBe(1);
  });

  it('should call service.findStockInHistory with query params', async () => {
    const query = { page: 1, limit: 10, search: 'Fuse' };
    mockSparePartsService.findStockInHistory.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    const res = await controller.findStockInHistory(query);
    expect(service.findStockInHistory).toHaveBeenCalledWith(query);
    expect(res.meta.total).toBe(0);
  });
});
