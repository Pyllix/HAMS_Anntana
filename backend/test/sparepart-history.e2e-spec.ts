import { randomUUID } from 'crypto';
import type { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import request from 'supertest';
import { SparePartsController } from '../src/spare-parts/spare-parts.controller';
import { SparePartsService } from '../src/spare-parts/spare-parts.service';
import { PrismaService } from '../src/prisma.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL!;

describe('Spare part history API (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let userId: string;
  let userEmail: string;
  let groupId: number;
  let mixedPartId: number;
  let stockInOnlyPartId: number;
  let transactionOnlyPartId: number;
  let emptyPartId: number;
  let deletedPartId: number;
  let orderedHistoryIds: string[];

  type HistoryItem = {
    id: string;
    activityType: 'STOCK_IN' | 'TXN';
    type: string;
    qty: number;
    amount: number;
    docOrJob: string | null;
    actor: { id: string; name: string; email: string };
    timestamp: string;
  };

  type HistoryResponse = {
    data: HistoryItem[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };

  const server = () => app.getHttpServer() as Server;
  const timestamp = (day: number) =>
    new Date(`2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`);

  async function getHistory(
    sparepartId: number,
    page?: number,
    limit?: number,
  ): Promise<HistoryResponse> {
    const response = await request(server())
      .get(`/spare-parts/${sparepartId}/history`)
      .query(page === undefined ? {} : { page, limit })
      .expect(200);
    return response.body as HistoryResponse;
  }

  async function createStockIn(
    sparepartId: number,
    createdAt: Date,
    doc: string,
    deletedAt: Date | null = null,
  ) {
    return prisma.sparepartAdd.create({
      data: {
        sparepartId,
        qty: 4,
        totalPrice: new Prisma.Decimal('100.50'),
        sparepartAddDoc: doc,
        addBy: userId,
        createdAt,
        deletedAt,
      },
    });
  }

  async function createTransaction(
    sparepartId: number,
    createdAt: Date,
    txnType: string,
  ) {
    return prisma.sparepartTxn.create({
      data: {
        sparepartId,
        txnType,
        qty: 2,
        unitPrice: new Prisma.Decimal('5.25'),
        txnBy: userId,
        createdAt,
      },
    });
  }

  async function createPart(name: string, deletedAt: Date | null = null) {
    return prisma.sparepart.create({
      data: {
        code: `T03-${randomUUID()}`,
        name,
        price: new Prisma.Decimal('25.00'),
        groupId,
        deletedAt,
      },
    });
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    });
    await prisma.$connect();

    const unique = randomUUID();
    userEmail = `ticket03-${unique}@example.test`;
    const user = await prisma.user.create({
      data: {
        id: unique,
        email: userEmail,
        emailVerified: false,
        firstname: 'History',
        lastname: 'Tester',
        role: UserRole.PARCEL_STAFF,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    userId = user.id;

    const group = await prisma.sparepartGroup.create({
      data: { name: `Ticket 03 ${unique}` },
    });
    groupId = group.id;

    const mixedPart = await createPart('Mixed history');
    mixedPartId = mixedPart.id;
    const stockInOnlyPart = await createPart('Stock-in only history');
    stockInOnlyPartId = stockInOnlyPart.id;
    const transactionOnlyPart = await createPart('Transaction only history');
    transactionOnlyPartId = transactionOnlyPart.id;
    const emptyPart = await createPart('Empty history');
    emptyPartId = emptyPart.id;
    const deletedPart = await createPart('Deleted history', new Date());
    deletedPartId = deletedPart.id;

    const newestAdd = await createStockIn(
      mixedPartId,
      timestamp(4),
      'PO-NEWEST',
    );
    const tiedAddLow = await createStockIn(
      mixedPartId,
      timestamp(3),
      'PO-TIE-LOW',
    );
    const tiedAddHigh = await createStockIn(
      mixedPartId,
      timestamp(3),
      'PO-TIE-HIGH',
    );
    const deletedAdd = await createStockIn(
      mixedPartId,
      timestamp(5),
      'PO-DELETED',
      new Date(),
    );
    const newestTransaction = await createTransaction(
      mixedPartId,
      timestamp(4),
      'WITHDRAW',
    );
    const tiedTransactionLow = await createTransaction(
      mixedPartId,
      timestamp(3),
      'RETURN',
    );
    const tiedTransactionHigh = await createTransaction(
      mixedPartId,
      timestamp(3),
      'WITHDRAW',
    );
    const olderTransaction = await createTransaction(
      mixedPartId,
      timestamp(2),
      'WITHDRAW',
    );

    await createStockIn(stockInOnlyPartId, timestamp(4), 'PO-ONLY');
    await createTransaction(transactionOnlyPartId, timestamp(4), 'RETURN');

    orderedHistoryIds = [
      `ADD-${newestAdd.id}`,
      `TXN-${newestTransaction.id}`,
      `ADD-${tiedAddHigh.id}`,
      `ADD-${tiedAddLow.id}`,
      `TXN-${tiedTransactionHigh.id}`,
      `TXN-${tiedTransactionLow.id}`,
      `TXN-${olderTransaction.id}`,
    ];
    expect(deletedAdd.id).toBeGreaterThan(0);

    const moduleRef = await Test.createTestingModule({
      controllers: [SparePartsController],
      providers: [
        SparePartsService,
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (prisma) {
      const sparepartIds = [
        mixedPartId,
        stockInOnlyPartId,
        transactionOnlyPartId,
        emptyPartId,
        deletedPartId,
      ].filter((id): id is number => Number.isInteger(id));

      if (sparepartIds.length > 0) {
        await prisma.sparepartTxn.deleteMany({
          where: { sparepartId: { in: sparepartIds } },
        });
        await prisma.sparepartAdd.deleteMany({
          where: { sparepartId: { in: sparepartIds } },
        });
        await prisma.sparepart.deleteMany({
          where: { id: { in: sparepartIds } },
        });
      }
      if (Number.isInteger(groupId)) {
        await prisma.sparepartGroup.deleteMany({ where: { id: groupId } });
      }
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.$disconnect();
    }
  });

  it('returns complete mixed history in stable pages without duplicates or gaps', async () => {
    const pages = await Promise.all(
      [1, 2, 3, 4].map((page) => getHistory(mixedPartId, page, 3)),
    );

    const pageIds = pages.map((response) =>
      response.data.map((item) => item.id),
    );
    expect(pageIds).toEqual([
      orderedHistoryIds.slice(0, 3),
      orderedHistoryIds.slice(3, 6),
      orderedHistoryIds.slice(6),
      [],
    ]);
    expect(new Set(pageIds.flat()).size).toBe(orderedHistoryIds.length);
    expect(pages[0].meta).toEqual({
      page: 1,
      limit: 3,
      total: 7,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
    });
    expect(pages[3].meta).toEqual({
      page: 4,
      limit: 3,
      total: 7,
      totalPages: 3,
      hasNextPage: false,
      hasPrevPage: true,
    });

    expect(pages[0].data[0]).toMatchObject({
      id: orderedHistoryIds[0],
      activityType: 'STOCK_IN',
      type: 'RESTOCK',
      qty: 4,
      amount: 100.5,
      docOrJob: 'PO-NEWEST',
      actor: {
        id: userId,
        name: 'History Tester',
        email: userEmail,
      },
      timestamp: timestamp(4).toISOString(),
    });
    expect(pages[0].data[1]).toMatchObject({
      id: orderedHistoryIds[1],
      activityType: 'TXN',
      type: 'WITHDRAW',
      qty: 2,
      amount: 10.5,
      docOrJob: null,
      timestamp: timestamp(4).toISOString(),
    });
  });

  it('handles empty and single-source timelines and hides deleted spare parts', async () => {
    const stockInOnly = await getHistory(stockInOnlyPartId);
    expect(stockInOnly.data).toHaveLength(1);
    expect(stockInOnly.data[0]).toMatchObject({
      activityType: 'STOCK_IN',
      docOrJob: 'PO-ONLY',
      amount: 100.5,
    });
    expect(stockInOnly.meta.total).toBe(1);

    const transactionOnly = await getHistory(transactionOnlyPartId);
    expect(transactionOnly.data).toHaveLength(1);
    expect(transactionOnly.data[0]).toMatchObject({
      activityType: 'TXN',
      type: 'RETURN',
      amount: 10.5,
    });
    expect(transactionOnly.meta.total).toBe(1);

    const empty = await getHistory(emptyPartId);
    expect(empty).toEqual({
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    await request(server())
      .get(`/spare-parts/${deletedPartId}/history`)
      .expect(404);
  });
});
