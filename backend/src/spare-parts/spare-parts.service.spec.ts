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
      count: jest.fn(),
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

    it('should create sparepart with initial stock and auto-generated code inside transaction', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({ id: 1, name: 'Electrical' });
      mockPrismaService.sparepart.findFirst.mockResolvedValue(null);

      const mockCreatedPart = {
        id: 10,
        code: 'SP01-0001',
        name: 'Fuse 10A',
        price: 50,
        minStock: 5,
        qtyInStock: 20,
        groupId: 1,
      };

      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        return cb({
          sparepart: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCreatedPart),
          },
          sparepartAdd: { create: jest.fn().mockResolvedValue({ id: 1 }) },
        });
      });

      const result = await service.create(
        {
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

    it('should auto-generate code SP01-0001 when no existing items in group', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({ id: 1, name: 'Electrical' });

      let capturedCode = '';
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const txMock = {
          sparepart: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((args) => {
              capturedCode = args.data.code;
              return { id: 1, ...args.data };
            }),
          },
          sparepartAdd: { create: jest.fn() },
        };
        return cb(txMock);
      });

      await service.create(
        {
          name: 'Capacitor 100uF',
          price: 15,
          groupId: 1,
        },
        'user-admin',
      );

      expect(capturedCode).toBe('SP01-0001');
    });

    it('should auto-generate next sequence code (e.g. SP02-0005) when previous codes exist in group', async () => {
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({ id: 2, name: 'Plumbing' });

      let capturedCode = '';
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const txMock = {
          sparepart: {
            findFirst: jest.fn().mockResolvedValue({ code: 'SP02-0004' }),
            create: jest.fn().mockImplementation((args) => {
              capturedCode = args.data.code;
              return { id: 2, ...args.data };
            }),
          },
          sparepartAdd: { create: jest.fn() },
        };
        return cb(txMock);
      });

      await service.create(
        {
          name: 'Ball Valve 1/2"',
          price: 120,
          groupId: 2,
        },
        'user-admin',
      );

      expect(capturedCode).toBe('SP02-0005');
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

  describe('findAllTransactions', () => {
    it('should filter transactions by userId, startDate, and endDate', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      await service.findAllTransactions({
        userId: 'user-uuid-1',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        page: 1,
        limit: 10,
      });

      expect(mockPrismaService.sparepartTxn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            txnBy: 'user-uuid-1',
            createdAt: {
              gte: new Date('2026-08-01T00:00:00.000Z'),
              lte: new Date('2026-08-31T23:59:59.999Z'),
            },
          }),
        }),
      );
    });
  });

  describe('findStockInHistory', () => {
    it('should return paginated stock-in history with filters and search applied', async () => {
      const mockAdds = [
        {
          id: 1,
          sparepartId: 10,
          qty: 20,
          totalPrice: 1000,
          sparepartAddDoc: 'PO-999',
          addBy: 'user-uuid-1',
          createdAt: new Date('2026-08-15T10:00:00.000Z'),
          sparepart: { id: 10, code: 'SP01-0001', name: 'Fuse 10A', unit: 'ชิ้น' },
          user: { id: 'user-uuid-1', firstname: 'John', lastname: 'Doe', email: 'john@example.com' },
        },
      ];
      mockPrismaService.$transaction.mockResolvedValue([mockAdds, 1]);

      const result = await service.findStockInHistory({
        sparepartId: 10,
        addBy: 'user-uuid-1',
        sparepartAddDoc: 'PO-999',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        search: 'Fuse',
        page: 1,
        limit: 10,
      });

      expect(mockPrismaService.sparepartAdd.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            sparepartId: 10,
            addBy: 'user-uuid-1',
            sparepartAddDoc: { contains: 'PO-999', mode: 'insensitive' },
            createdAt: {
              gte: new Date('2026-08-01T00:00:00.000Z'),
              lte: new Date('2026-08-31T23:59:59.999Z'),
            },
            OR: [
              { sparepartAddDoc: { contains: 'Fuse', mode: 'insensitive' } },
              { sparepart: { code: { contains: 'Fuse', mode: 'insensitive' } } },
              { sparepart: { name: { contains: 'Fuse', mode: 'insensitive' } } },
            ],
          }),
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );

      expect(result).toEqual({
        data: mockAdds,
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });
  });
});

