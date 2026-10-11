import { randomUUID } from 'crypto';
import type { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import request from 'supertest';
import { PrismaService } from '../src/prisma.service';
import { SparePartsController } from '../src/spare-parts/spare-parts.controller';
import { SparePartsService } from '../src/spare-parts/spare-parts.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

type StockInHistoryResponse = {
  data: Array<{
    id: number;
    sparepartAddDoc?: string;
    qty?: number;
    totalPrice?: string;
    createdAt?: string;
    deletedAt?: string | null;
    sparepart?: { code?: string };
    user?: { id: string; firstname: string; lastname: string };
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

function asStockInHistoryResponse(value: unknown): StockInHistoryResponse {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected a stock-in history response object');
  }

  return value as StockInHistoryResponse;
}

describeWithDatabase('Stock-in history search API (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let userId: string;
  let groupId: number;
  let alphaPartId: number;
  let betaPartId: number;
  let gammaPartId: number;
  let alphaDocId: number;
  let alphaOtherId: number;
  let betaId: number;
  let deletedStockInId: number;
  const dynamicAddIds: number[] = [];
  let specialPatternIds: number[];
  let tieIds: number[];

  const server = () => app.getHttpServer() as Server;
  const date = (day: number) =>
    new Date(`2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`);

  async function createPart(code: string, name: string) {
    return prisma.sparepart.create({
      data: {
        code: `T05-${code}-${randomUUID()}`,
        name,
        price: new Prisma.Decimal('12.50'),
        groupId,
      },
    });
  }

  async function createStockIn(
    sparepartId: number,
    doc: string,
    createdAt: Date,
    deletedAt: Date | null = null,
  ) {
    return prisma.sparepartAdd.create({
      data: {
        sparepartId,
        qty: 3,
        totalPrice: new Prisma.Decimal('37.50'),
        sparepartAddDoc: doc,
        addBy: userId,
        createdAt,
        deletedAt,
      },
    });
  }

  beforeAll(async () => {
    if (!testDatabaseUrl || !/test/i.test(new URL(testDatabaseUrl).pathname)) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated database with "test" in its name',
      );
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    });
    await prisma.$connect();

    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        id: unique,
        email: `ticket05-${unique}@example.test`,
        emailVerified: false,
        firstname: 'Search',
        lastname: 'Tester',
        role: UserRole.PARCEL_STAFF,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    userId = user.id;
    const group = await prisma.sparepartGroup.create({
      data: { name: `Ticket 05 ${unique}` },
    });
    groupId = group.id;

    const alpha = await createPart('INV-ALPHA-7788', 'ตัวเก็บไฟทดสอบพิเศษ');
    const beta = await createPart('PART-BETA-QX-92', 'ตัวต้านทานสำรอง');
    const gamma = await createPart('PART-GAMMA-310', 'มอเตอร์ทดสอบทั่วไป');
    alphaPartId = alpha.id;
    betaPartId = beta.id;
    gammaPartId = gamma.id;

    const alphaDoc = await createStockIn(alphaPartId, 'PO-2026-QX-92', date(5));
    const alphaOther = await createStockIn(
      alphaPartId,
      'INVOICE-2026-001',
      date(4),
    );
    const betaAdd = await createStockIn(betaPartId, 'PO-QX-92', date(3));
    const softDeletedAdd = await createStockIn(
      gammaPartId,
      'SOFTDEL-QX-92',
      date(2),
      new Date(),
    );
    alphaDocId = alphaDoc.id;
    alphaOtherId = alphaOther.id;
    betaId = betaAdd.id;
    deletedStockInId = softDeletedAdd.id;
    specialPatternIds = (
      await Promise.all([
        createStockIn(gammaPartId, 'LITERAL-X_92', date(3)),
        createStockIn(gammaPartId, 'LITERAL-XA92', date(3)),
      ])
    ).map(({ id }) => id);

    tieIds = (
      await Promise.all([
        createStockIn(alphaPartId, 'TIE-A', date(1)),
        createStockIn(alphaPartId, 'TIE-B', date(1)),
        createStockIn(alphaPartId, 'TIE-C', date(1)),
      ])
    ).map(({ id }) => id);

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
      const addIds = [
        alphaDocId,
        alphaOtherId,
        betaId,
        deletedStockInId,
        ...dynamicAddIds,
        ...(specialPatternIds ?? []),
        ...(tieIds ?? []),
      ].filter((id): id is number => Number.isInteger(id));
      const partIds = [alphaPartId, betaPartId, gammaPartId].filter(
        (id): id is number => Number.isInteger(id),
      );

      if (addIds.length > 0) {
        await prisma.sparepartAdd.deleteMany({ where: { id: { in: addIds } } });
      }
      if (partIds.length > 0) {
        await prisma.sparepart.deleteMany({ where: { id: { in: partIds } } });
      }
      if (Number.isInteger(groupId)) {
        await prisma.sparepartGroup.deleteMany({ where: { id: groupId } });
      }
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.$disconnect();
    }
  });

  it('keeps exact totals and stable pages on the database-filtered query path', async () => {
    const query = {
      sparepartId: alphaPartId,
      addBy: userId,
      startDate: '2026-10-01',
      endDate: '2026-10-01',
      limit: 2,
    };

    const firstPage = asStockInHistoryResponse(
      (
        await request(server())
          .get('/spare-parts/stock-in-history')
          .query({ ...query, page: 1 })
          .expect(200)
      ).body,
    );
    const secondPage = asStockInHistoryResponse(
      (
        await request(server())
          .get('/spare-parts/stock-in-history')
          .query({ ...query, page: 2 })
          .expect(200)
      ).body,
    );
    const expectedTieOrder = tieIds.slice().sort((a, b) => b - a);

    expect(firstPage.data.map(({ id }) => id)).toEqual(
      expectedTieOrder.slice(0, 2),
    );
    expect(secondPage.data.map(({ id }) => id)).toEqual(
      expectedTieOrder.slice(2),
    );
    expect(firstPage.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });
    expect(secondPage.meta).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPrevPage: true,
    });

    const added = await createStockIn(
      alphaPartId,
      `TICKET-07-${randomUUID()}`,
      date(1),
    );
    dynamicAddIds.push(added.id);

    const afterInsert = asStockInHistoryResponse(
      (
        await request(server())
          .get('/spare-parts/stock-in-history')
          .query({ ...query, page: 1 })
          .expect(200)
      ).body,
    );
    expect(afterInsert.meta).toMatchObject({ total: 4, totalPages: 2 });

    await prisma.sparepartAdd.update({
      where: { id: added.id },
      data: { deletedAt: new Date() },
    });
    const afterSoftDelete = asStockInHistoryResponse(
      (
        await request(server())
          .get('/spare-parts/stock-in-history')
          .query({ ...query, page: 1 })
          .expect(200)
      ).body,
    );
    expect(afterSoftDelete.meta).toMatchObject({ total: 3, totalPages: 2 });

    const outOfRangePage = asStockInHistoryResponse(
      (
        await request(server())
          .get('/spare-parts/stock-in-history')
          .query({ ...query, page: 3 })
          .expect(200)
      ).body,
    );
    expect(outOfRangePage.data).toEqual([]);
    expect(outOfRangePage.meta).toEqual({
      page: 3,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPrevPage: true,
    });

    const noMatches = asStockInHistoryResponse(
      (
        await request(server())
          .get('/spare-parts/stock-in-history')
          .query({
            sparepartId: alphaPartId,
            startDate: '2027-01-01',
            endDate: '2027-01-01',
            limit: 100,
          })
          .expect(200)
      ).body,
    );
    expect(noMatches.data).toEqual([]);
    expect(noMatches.meta).toEqual({
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('keeps contains matching across documents and part fields without OR duplicates', async () => {
    const response = await request(server())
      .get('/spare-parts/stock-in-history')
      .query({ search: 'qX-92', limit: 20 })
      .expect(200);
    const body = asStockInHistoryResponse(response.body);

    expect(body.data.map((row) => row.id)).toEqual([alphaDocId, betaId]);
    expect(body.meta.total).toBe(2);
    expect(body.data[0]).toMatchObject({
      sparepartAddDoc: 'PO-2026-QX-92',
      qty: 3,
      totalPrice: '37.5',
      createdAt: date(5).toISOString(),
      deletedAt: null,
      user: { id: userId, firstname: 'Search', lastname: 'Tester' },
    });
    expect(body.data[0]?.sparepart?.code).toContain('INV-ALPHA-7788');
    expect(body.data.map((row) => row.id)).not.toContain(deletedStockInId);
  });

  it('preserves Thai-name and middle-of-document searches with combined filters', async () => {
    const thai = await request(server())
      .get('/spare-parts/stock-in-history')
      .query({ search: 'เก็บไฟทดสอบ', limit: 20 })
      .expect(200);
    const thaiBody = asStockInHistoryResponse(thai.body);
    expect(thaiBody.data.map((row) => row.id)).toEqual([
      alphaDocId,
      alphaOtherId,
      ...tieIds.slice().sort((a, b) => b - a),
    ]);

    const filtered = await request(server())
      .get('/spare-parts/stock-in-history')
      .query({
        search: '2026-qx',
        sparepartId: alphaPartId,
        sparepartAddDoc: 'PO-2026',
        addBy: userId,
        startDate: '2026-10-05',
        endDate: '2026-10-05',
        page: 1,
        limit: 1,
      })
      .expect(200);
    const filteredBody = asStockInHistoryResponse(filtered.body);
    expect(filteredBody.data.map((row) => row.id)).toEqual([alphaDocId]);
    expect(filteredBody.meta).toMatchObject({ total: 1, totalPages: 1 });
  });

  it('keeps short and missing-term results and stable pagination for timestamp ties', async () => {
    const short = await request(server())
      .get('/spare-parts/stock-in-history')
      .query({ search: 'O-', limit: 20 })
      .expect(200);
    const shortBody = asStockInHistoryResponse(short.body);
    expect(shortBody.data.map((row) => row.id)).toEqual([alphaDocId, betaId]);

    const missing = await request(server())
      .get('/spare-parts/stock-in-history')
      .query({ search: 'NO-SUCH-TERM', limit: 20 })
      .expect(200);
    const missingBody = asStockInHistoryResponse(missing.body);
    expect(missingBody.data).toEqual([]);
    expect(missingBody.meta.total).toBe(0);

    const firstPage = await request(server())
      .get('/spare-parts/stock-in-history')
      .query({ search: 'TIE', page: 1, limit: 2 })
      .expect(200);
    const firstPageBody = asStockInHistoryResponse(firstPage.body);
    const secondPage = await request(server())
      .get('/spare-parts/stock-in-history')
      .query({ search: 'TIE', page: 2, limit: 2 })
      .expect(200);
    const secondPageBody = asStockInHistoryResponse(secondPage.body);
    expect(firstPageBody.data.map((row) => row.id)).toEqual(
      tieIds
        .slice()
        .sort((a, b) => b - a)
        .slice(0, 2),
    );
    expect(secondPageBody.data.map((row) => row.id)).toEqual(
      tieIds
        .slice()
        .sort((a, b) => b - a)
        .slice(2),
    );
    expect(firstPageBody.meta.total).toBe(3);
    expect(secondPageBody.meta.hasPrevPage).toBe(true);
  });

  it('keeps wildcard-character search behavior compatible with Prisma contains', async () => {
    const expected = await prisma.sparepartAdd.findMany({
      where: {
        deletedAt: null,
        OR: [
          { sparepartAddDoc: { contains: 'X_92', mode: 'insensitive' } },
          {
            sparepart: {
              code: { contains: 'X_92', mode: 'insensitive' },
            },
          },
          {
            sparepart: {
              name: { contains: 'X_92', mode: 'insensitive' },
            },
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    const response = await request(server())
      .get('/spare-parts/stock-in-history')
      .query({ search: 'X_92', limit: 20 })
      .expect(200);
    const body = asStockInHistoryResponse(response.body);

    expect(body.data.map((row) => row.id)).toEqual(
      expected.map(({ id }) => id),
    );
  });
});
