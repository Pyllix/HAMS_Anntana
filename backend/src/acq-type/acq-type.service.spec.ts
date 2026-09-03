import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AcqTypeService } from './acq-type.service';
import { PrismaService } from 'src/prisma.service';

describe('AcqTypeService', () => {
  let service: AcqTypeService;
  let prisma: PrismaService;

  const mockPrisma = {
    acqType: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcqTypeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AcqTypeService>(AcqTypeService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an acquisition type', async () => {
    const dto = { name: 'บริจาค', description: 'ได้รับบริจาค' };
    mockPrisma.acqType.create.mockResolvedValue({ id: 1, ...dto });

    const result = await service.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
    expect(mockPrisma.acqType.create).toHaveBeenCalledWith({ data: dto });
  });

  it('should return all active acquisition types', async () => {
    mockPrisma.acqType.findMany.mockResolvedValue([{ id: 1, name: 'บริจาค' }]);

    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, name: 'บริจาค' }]);
    expect(mockPrisma.acqType.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
  });

  it('should return one acquisition type by ID', async () => {
    mockPrisma.acqType.findFirst.mockResolvedValue({ id: 1, name: 'บริจาค' });

    const result = await service.findOne(1);
    expect(result).toEqual({ id: 1, name: 'บริจาค' });
  });

  it('should throw NotFoundException if acquisition type not found', async () => {
    mockPrisma.acqType.findFirst.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should update an acquisition type', async () => {
    mockPrisma.acqType.findFirst.mockResolvedValue({ id: 1, name: 'บริจาค' });
    mockPrisma.acqType.update.mockResolvedValue({ id: 1, name: 'บริจาคพิเศษ' });

    const result = await service.update(1, { name: 'บริจาคพิเศษ' });
    expect(result.name).toEqual('บริจาคพิเศษ');
  });

  it('should soft delete an acquisition type', async () => {
    mockPrisma.acqType.findFirst.mockResolvedValue({ id: 1, name: 'บริจาค' });
    mockPrisma.acqType.update.mockResolvedValue({ id: 1, deletedAt: new Date() });

    await service.remove(1);
    expect(mockPrisma.acqType.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should restore a soft-deleted acquisition type', async () => {
    mockPrisma.acqType.findFirst.mockResolvedValue({ id: 1, deletedAt: new Date() });
    mockPrisma.acqType.update.mockResolvedValue({ id: 1, deletedAt: null });

    const result = await service.restore(1);
    expect(result.deletedAt).toBeNull();
  });
});
