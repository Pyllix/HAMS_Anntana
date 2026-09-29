import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BudgetTypeService } from './budget-type.service';
import { PrismaService } from 'src/prisma.service';

describe('BudgetTypeService', () => {
  let service: BudgetTypeService;
  let prisma: PrismaService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
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
    mockPrisma.$queryRaw.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a budget type', async () => {
    const dto = { name: 'งบปี 2567', fiscalYear: 2567 };
    mockPrisma.budgetType.create.mockResolvedValue({ id: 1, ...dto });

    const result = await service.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
    expect(mockPrisma.budgetType.create).toHaveBeenCalledWith({ data: dto });
  });

  it('should trim the name before creating a budget type', async () => {
    mockPrisma.budgetType.create.mockResolvedValue({
      id: 1,
      name: 'งบปี 2567',
    });

    await service.create({ name: '  งบปี 2567  ' });

    expect(mockPrisma.budgetType.create).toHaveBeenCalledWith({
      data: { name: 'งบปี 2567' },
    });
  });

  it('should reject an existing name regardless of fiscal year', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 2 }]);

    await expect(
      service.create({ name: 'งบปี 2567', fiscalYear: 2568 }),
    ).rejects.toThrow(ConflictException);

    expect(mockPrisma.budgetType.create).not.toHaveBeenCalled();
  });

  it('should reject a whitespace-only name', async () => {
    await expect(service.create({ name: '   ' })).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.budgetType.create).not.toHaveBeenCalled();
  });

  it('should return a conflict when the database rejects a concurrent duplicate', async () => {
    mockPrisma.budgetType.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create({ name: 'งบปี 2567' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('should reject a duplicate name when updating a budget type', async () => {
    mockPrisma.budgetType.findFirst.mockResolvedValueOnce({
      id: 1,
      name: 'งบเดิม',
      deletedAt: null,
    });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 2 }]);

    await expect(service.update(1, { name: 'งบซ้ำ' })).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.budgetType.update).not.toHaveBeenCalled();
  });

  it('should reject a duplicate name when restoring a budget type', async () => {
    mockPrisma.budgetType.findFirst.mockResolvedValueOnce({
      id: 1,
      name: 'งบซ้ำ',
      deletedAt: new Date(),
    });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 2 }]);

    await expect(service.restore(1)).rejects.toThrow(ConflictException);
    expect(mockPrisma.budgetType.update).not.toHaveBeenCalled();
  });

  it('should return all active budget types', async () => {
    mockPrisma.budgetType.findMany.mockResolvedValue([
      { id: 1, name: 'งบปี 2567' },
    ]);

    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, name: 'งบปี 2567' }]);
  });

  it('should filter by fiscalYear and isActive', async () => {
    mockPrisma.budgetType.findMany.mockResolvedValue([
      { id: 1, fiscalYear: 2567, isActive: true },
    ]);

    await service.findAll(2567, true);
    expect(mockPrisma.budgetType.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, fiscalYear: 2567, isActive: true },
      orderBy: [{ fiscalYear: 'desc' }, { id: 'asc' }],
    });
  });

  it('should soft delete a budget type', async () => {
    mockPrisma.budgetType.findFirst.mockResolvedValue({
      id: 1,
      name: 'งบปี 2567',
    });
    mockPrisma.budgetType.update.mockResolvedValue({
      id: 1,
      deletedAt: new Date(),
    });

    await service.remove(1);
    expect(mockPrisma.budgetType.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should restore a soft-deleted budget type', async () => {
    mockPrisma.budgetType.findFirst.mockResolvedValue({
      id: 1,
      name: 'งบปี 2567',
      deletedAt: new Date(),
    });
    mockPrisma.budgetType.update.mockResolvedValue({ id: 1, deletedAt: null });

    const result = await service.restore(1);
    expect(result.deletedAt).toBeNull();
  });
});
