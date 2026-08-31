import { Test, TestingModule } from '@nestjs/testing';
import { SparePartGroupService } from './spare-part-group.service';
import { PrismaService } from 'src/prisma.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('SparePartGroupService', () => {
  let service: SparePartGroupService;
  let prisma: PrismaService;

  const mockPrismaService = {
    sparepartGroup: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    sparepart: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SparePartGroupService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SparePartGroupService>(SparePartGroupService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a spare part group when not existing', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue(null);
      mockPrismaService.sparepartGroup.create.mockResolvedValue({
        id: 1,
        name: 'Electrical Parts',
      });

      const result = await service.create({ name: 'Electrical Parts' });
      expect(result).toEqual({ id: 1, name: 'Electrical Parts' });
      expect(mockPrismaService.sparepartGroup.create).toHaveBeenCalledWith({
        data: { name: 'Electrical Parts' },
      });
    });

    it('should throw ConflictException if group name already exists', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({ id: 1, name: 'Electrical Parts' });

      await expect(service.create({ name: 'Electrical Parts' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should prevent deleting a group if it has active spare parts', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({ id: 1, name: 'Electrical Parts' });
      mockPrismaService.sparepart.count.mockResolvedValue(3);

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    });

    it('should soft delete group if no active spare parts', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({ id: 1, name: 'Electrical Parts' });
      mockPrismaService.sparepart.count.mockResolvedValue(0);
      mockPrismaService.sparepartGroup.update.mockResolvedValue({ id: 1, name: 'Electrical Parts', deletedAt: new Date() });

      const res = await service.remove(1);
      expect(mockPrismaService.sparepartGroup.update).toHaveBeenCalled();
    });
  });
});
