import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BudgetTypeService } from './budget-type.service';
import { PrismaService } from 'src/prisma.service';

describe('BudgetTypeService', () => {
  let service: BudgetTypeService;
  let prisma: PrismaService;

  const mockPrisma = {
    budgetType: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetTypeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BudgetTypeService>(BudgetTypeService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a budget type', async () => {
    const dto = { name: 'งบปี 2567', fiscalYear: 2567 };
    mockPrisma.budgetType.create.mockResolvedValue({ id: 1, ...dto });

    const result = await service.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
  });

  it('should return all active budget types', async () => {
    mockPrisma.budgetType.findMany.mockResolvedValue([{ id: 1, name: 'งบปี 2567' }]);

    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, name: 'งบปี 2567' }]);
  });

  it('should filter by fiscalYear and isActive', async () => {
    mockPrisma.budgetType.findMany.mockResolvedValue([{ id: 1, fiscalYear: 2567, isActive: true }]);

    await service.findAll(2567, true);
    expect(mockPrisma.budgetType.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, fiscalYear: 2567, isActive: true },
      orderBy: [{ fiscalYear: 'desc' }, { id: 'asc' }],
    });
  });

  it('should soft delete a budget type', async () => {
    mockPrisma.budgetType.findFirst.mockResolvedValue({ id: 1, name: 'งบปี 2567' });
    mockPrisma.budgetType.update.mockResolvedValue({ id: 1, deletedAt: new Date() });

    await service.remove(1);
    expect(mockPrisma.budgetType.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should restore a soft-deleted budget type', async () => {
    mockPrisma.budgetType.findFirst.mockResolvedValue({ id: 1, deletedAt: new Date() });
    mockPrisma.budgetType.update.mockResolvedValue({ id: 1, deletedAt: null });

    const result = await service.restore(1);
    expect(result.deletedAt).toBeNull();
  });
});
