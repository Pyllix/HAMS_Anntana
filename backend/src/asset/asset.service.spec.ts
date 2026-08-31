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
});
