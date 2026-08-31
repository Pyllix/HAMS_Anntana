import { Test, TestingModule } from '@nestjs/testing';
import { SparePartsService } from './spare-parts.service';
import { PrismaService } from 'src/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('SparePartsService', () => {
  let service: SparePartsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    sparepartGroup: {
      findFirst: jest.fn(),
    },
    sparepart: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    sparepartAdd: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    sparepartTxn: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SparePartsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SparePartsService>(SparePartsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Sparepart', () => {
    it('should throw NotFoundException if groupId does not exist when creating sparepart', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            code: 'SP-001',
            name: 'Fuse 10A',
            price: 50,
            groupId: 99,
            minStock: 5,
            qtyInStock: 10,
          },
          'user-admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if sparepart code already exists', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({ id: 1, name: 'Electrical' });
      mockPrismaService.sparepart.findFirst.mockResolvedValue({ id: 1, code: 'SP-001' });

      await expect(
        service.create(
          {
            code: 'SP-001',
            name: 'Fuse 10A',
            price: 50,
            groupId: 1,
          },
          'user-admin',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create sparepart with initial stock inside transaction', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({ id: 1, name: 'Electrical' });
      mockPrismaService.sparepart.findFirst.mockResolvedValue(null);

      const mockCreatedPart = {
        id: 10,
        code: 'SP-001',
        name: 'Fuse 10A',
        price: 50,
        minStock: 5,
        qtyInStock: 20,
        groupId: 1,
      };

      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        return cb({
          sparepart: { create: jest.fn().mockResolvedValue(mockCreatedPart) },
          sparepartAdd: { create: jest.fn().mockResolvedValue({ id: 1 }) },
        });
      });

      const result = await service.create(
        {
          code: 'SP-001',
          name: 'Fuse 10A',
          price: 50,
          groupId: 1,
          minStock: 5,
          qtyInStock: 20,
        },
        'user-admin',
      );

      expect(result).toEqual(mockCreatedPart);
    });

    it('should return low stock summary correctly', async () => {
      mockPrismaService.sparepart.findMany.mockResolvedValue([
        { id: 1, name: 'Part A', minStock: 10, qtyInStock: 2 },
        { id: 2, name: 'Part B', minStock: 5, qtyInStock: 5 },
        { id: 3, name: 'Part C', minStock: 5, qtyInStock: 10 },
      ]);

      const summary = await service.findLowStockSummary();
      expect(summary.totalLowStockCount).toBe(2);
      expect(summary.items).toHaveLength(2);
      expect(summary.items[0].id).toBe(1);
      expect(summary.items[0].deficit).toBe(8);
      expect(summary.items[1].id).toBe(2);
      expect(summary.items[1].deficit).toBe(0);
    });
  });

  describe('Stock-In', () => {
    it('should increase qty_in_stock and record in SparepartAdd', async () => {
      mockPrismaService.sparepart.findFirst.mockResolvedValue({
        id: 1,
        code: 'SP-001',
        name: 'Fuse 10A',
        price: 50,
        minStock: 5,
        qtyInStock: 10,
        _count: { sparepartAdds: 1, sparepartTxns: 0 },
      });

      const mockStockInRecord = {
        id: 100,
        sparepartId: 1,
        qty: 15,
        totalPrice: 750,
        sparepartAddDoc: 'PO-1234',
        addBy: 'user-admin',
      };

      const mockUpdatedPart = {
        id: 1,
        code: 'SP-001',
        qtyInStock: 25,
        minStock: 5,
      };

      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        return cb({
          sparepartAdd: { create: jest.fn().mockResolvedValue(mockStockInRecord) },
          sparepart: { update: jest.fn().mockResolvedValue(mockUpdatedPart) },
        });
      });

      const res = await service.stockIn(
        {
          sparepartId: 1,
          qty: 15,
          sparepartAddDoc: 'PO-1234',
        },
        'user-admin',
      );

      expect(res.stockInRecord).toEqual(mockStockInRecord);
      expect(res.updatedSparepart.qtyInStock).toBe(25);
      expect(res.updatedSparepart.isLowStock).toBe(false);
    });
  });
});
