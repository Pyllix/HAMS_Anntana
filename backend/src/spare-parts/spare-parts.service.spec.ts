import { Test, TestingModule } from '@nestjs/testing';
import { SparePartsService } from './spare-parts.service';
import { PrismaService } from 'src/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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
      fields: { minStock: { name: 'minStock' } },
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
    it.each(['price', 'minStock', 'qtyInStock'] as const)(
      'does not save a new spare part with negative %s',
      async (field) => {
        await expect(
          service.create(
            { name: 'Fuse', price: 0, groupId: 1, [field]: -1 },
            'user-admin',
          ),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      },
    );

    it.each(['price', 'minStock', 'qtyInStock'] as const)(
      'does not update a spare part with negative %s',
      async (field) => {
        await expect(service.update(1, { [field]: -1 })).rejects.toThrow(
          BadRequestException,
        );
        expect(mockPrismaService.sparepart.update).not.toHaveBeenCalled();
      },
    );

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
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({
        id: 1,
        name: 'Electrical',
      });
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
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({
        id: 1,
        name: 'Electrical',
      });

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
      mockPrismaService.sparepartGroup.findFirst.mockResolvedValue({
        id: 2,
        name: 'Plumbing',
      });

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

    it('filters low-stock results in the database while keeping list filters and pagination', async () => {
      const part = {
        id: 1,
        code: 'SP01-0001',
        name: 'Fuse 10A',
        unit: 'ชิ้น',
        price: 50,
        minStock: 5,
        qtyInStock: 2,
        groupId: 2,
        group: { id: 2, name: 'Electrical' },
      };
      mockPrismaService.sparepart.findMany.mockResolvedValue([part]);
      mockPrismaService.sparepart.count.mockResolvedValue(1);
      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockPrismaService.$transaction.mockImplementation(async (operations) =>
        Promise.all(operations),
      );

      const result = await service.findAll({
        page: 2,
        limit: 10,
        lowStock: true,
        groupId: 2,
        search: ' Fuse ',
      });

      const where = {
        deletedAt: null,
        groupId: 2,
        OR: [
          { code: { contains: 'Fuse', mode: 'insensitive' } },
          { name: { contains: 'Fuse', mode: 'insensitive' } },
        ],
        qtyInStock: {
          lte: mockPrismaService.sparepart.fields.minStock,
        },
      };
      expect(mockPrismaService.sparepart.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 10, take: 10 }),
      );
      expect(mockPrismaService.sparepart.count).toHaveBeenCalledWith({ where });
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: [expect.objectContaining({ id: 1, isLowStock: true })],
        meta: {
          page: 2,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: true,
        },
      });
    });

    it('queries the low-stock summary directly and preserves its threshold and order', async () => {
      mockPrismaService.sparepart.findMany.mockResolvedValue([
        { id: 3, name: 'Part C', minStock: 0, qtyInStock: 0 },
        { id: 4, name: 'Part D', minStock: 3, qtyInStock: 0 },
        { id: 1, name: 'Part A', minStock: 10, qtyInStock: 2 },
        { id: 2, name: 'Part B', minStock: 5, qtyInStock: 5 },
      ]);

      const summary = await service.findLowStockSummary();
      expect(mockPrismaService.sparepart.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          qtyInStock: {
            lte: mockPrismaService.sparepart.fields.minStock,
          },
        },
        include: { group: { select: { id: true, name: true } } },
        orderBy: [{ qtyInStock: 'asc' }, { id: 'asc' }],
      });
      expect(summary.totalLowStockCount).toBe(4);
      expect(summary.items.map(({ id, deficit }) => ({ id, deficit }))).toEqual(
        [
          { id: 3, deficit: 0 },
          { id: 4, deficit: 3 },
          { id: 1, deficit: 8 },
          { id: 2, deficit: 0 },
        ],
      );
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
          sparepartAdd: {
            create: jest.fn().mockResolvedValue(mockStockInRecord),
          },
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
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });
  });

  describe('findSparepartHistory', () => {
    it('uses a stable order for equal timestamps across stock-in and transaction history', async () => {
      const timestamp = new Date('2026-10-01T10:00:00.000Z');
      mockPrismaService.sparepart.findFirst.mockResolvedValue({
        id: 10,
      });
      mockPrismaService.$queryRaw.mockResolvedValue([
        {
          total: 4n,
          source: 'ADD',
          recordId: 12,
          qty: 5,
          amountBase: '50.00',
          transactionType: null,
          docOrJob: 'PO-12',
          actorId: 'user-1',
          actorName: 'Ada One',
          actorEmail: 'ada@example.com',
          timestamp,
        },
        {
          total: 4n,
          source: 'ADD',
          recordId: 11,
          qty: 4,
          amountBase: '40.00',
          transactionType: null,
          docOrJob: 'PO-11',
          actorId: 'user-1',
          actorName: 'Ada One',
          actorEmail: 'ada@example.com',
          timestamp,
        },
        {
          total: 4n,
          source: 'TXN',
          recordId: 22,
          qty: 3,
          amountBase: '10.00',
          transactionType: 'RETURN',
          docOrJob: null,
          actorId: 'user-1',
          actorName: 'Ada One',
          actorEmail: 'ada@example.com',
          timestamp,
        },
      ]);

      const result = await service.findSparepartHistory(10, {
        page: 1,
        limit: 3,
      });

      expect(result.data.map(({ id }) => id)).toEqual([
        'ADD-12',
        'ADD-11',
        'TXN-22',
      ]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 3,
        total: 4,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });
  });

  describe('findStockInHistory', () => {
    it('should return paginated stock-in history with filters and short search applied', async () => {
      const mockAdds = [
        {
          id: 1,
          sparepartId: 10,
          qty: 20,
          totalPrice: 1000,
          sparepartAddDoc: 'PO-999',
          addBy: 'user-uuid-1',
          createdAt: new Date('2026-08-15T10:00:00.000Z'),
          sparepart: {
            id: 10,
            code: 'SP01-0001',
            name: 'Fuse 10A',
            unit: 'ชิ้น',
          },
          user: {
            id: 'user-uuid-1',
            firstname: 'John',
            lastname: 'Doe',
            email: 'john@example.com',
          },
        },
      ];
      mockPrismaService.sparepartAdd.findMany.mockResolvedValue(mockAdds);
      mockPrismaService.sparepartAdd.count.mockResolvedValue(1);

      const expectedWhere = {
        deletedAt: null,
        sparepartId: 10,
        addBy: 'user-uuid-1',
        sparepartAddDoc: { contains: 'PO-999', mode: 'insensitive' },
        createdAt: {
          gte: new Date('2026-08-01T00:00:00.000Z'),
          lte: new Date('2026-08-31T23:59:59.999Z'),
        },
        OR: [
          { sparepartAddDoc: { contains: 'PO', mode: 'insensitive' } },
          { sparepart: { code: { contains: 'PO', mode: 'insensitive' } } },
          { sparepart: { name: { contains: 'PO', mode: 'insensitive' } } },
        ],
      };

      const result = await service.findStockInHistory({
        sparepartId: 10,
        addBy: 'user-uuid-1',
        sparepartAddDoc: 'PO-999',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        search: 'PO',
        page: 1,
        limit: 10,
      });

      expect(mockPrismaService.sparepartAdd.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          skip: 0,
          take: 10,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
      expect(mockPrismaService.sparepartAdd.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();

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

    it('uses a parameterized database query for cross-table contains search', async () => {
      const createdAt = new Date('2026-08-15T10:00:00.000Z');
      const updatedAt = new Date('2026-08-16T10:00:00.000Z');
      const row = {
        total: 2n,
        id: 1,
        sparepartId: 10,
        qty: 20,
        totalPrice: new Prisma.Decimal('1000.00'),
        sparepartAddDoc: 'PO-999',
        addBy: 'user-uuid-1',
        createdAt,
        updatedAt,
        deletedAt: null,
        partId: 10,
        partCode: 'SP01-0001',
        partName: 'Fuse 10A',
        partUnit: 'ชิ้น',
        userId: 'user-uuid-1',
        userFirstname: 'John',
        userLastname: 'Doe',
        userEmail: 'john@example.com',
      };
      mockPrismaService.$transaction.mockReset();
      mockPrismaService.$queryRaw.mockResolvedValue([row]);

      const result = await service.findStockInHistory({
        search: 'Fuse',
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual([
        {
          id: 1,
          sparepartId: 10,
          qty: 20,
          totalPrice: new Prisma.Decimal('1000.00'),
          sparepartAddDoc: 'PO-999',
          addBy: 'user-uuid-1',
          createdAt,
          updatedAt,
          deletedAt: null,
          sparepart: {
            id: 10,
            code: 'SP01-0001',
            name: 'Fuse 10A',
            unit: 'ชิ้น',
          },
          user: {
            id: 'user-uuid-1',
            firstname: 'John',
            lastname: 'Doe',
            email: 'john@example.com',
          },
        },
      ]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      const query = mockPrismaService.$queryRaw.mock.calls[0][0] as {
        sql: string;
        values: unknown[];
      };
      expect(query.sql).not.toContain('Fuse');
      expect(query.values).toContain('%Fuse%');
    });
  });
});
