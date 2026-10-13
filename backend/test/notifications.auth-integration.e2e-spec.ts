import 'dotenv/config';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PrismaClient,
  NotificationResourceType,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { generateSync } from 'otplib';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { TwoFactorService } from '../src/auth/two-factor.service';
import { NotificationsService } from '../src/notifications/notifications.service';

jest.setTimeout(60_000);

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

interface SseFrame {
  event: string;
  data: unknown;
  id?: string;
}

interface BorrowingApiResponse {
  id: string;
  borrowNo: string;
  borrowStatus: { code: string };
}

interface NotificationApiResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: NotificationResourceType;
  resourceId: string;
  readAt: string | null;
  createdAt: string;
  [key: string]: unknown;
}

interface NotificationListApiResponse {
  data: NotificationApiResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

const notificationTypes = Object.values(NotificationType);
const notificationResourceTypes = Object.values(NotificationResourceType);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  description: string,
): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid ${description} response`);
  return value;
}

function requireString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field} in API response`);
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== 'number') {
    throw new Error(`Invalid ${field} in API response`);
  }
  return value;
}

function requireBoolean(
  record: Record<string, unknown>,
  field: string,
): boolean {
  const value = record[field];
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${field} in API response`);
  }
  return value;
}

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return (
    typeof value === 'string' && options.some((option) => option === value)
  );
}

function requireOneOf<T extends string>(
  record: Record<string, unknown>,
  field: string,
  options: readonly T[],
): T {
  const value = record[field];
  if (!isOneOf(value, options)) {
    throw new Error(`Invalid ${field} in API response`);
  }
  return value;
}

function parseSignInResponse(response: { body: unknown }): {
  requiresTwoFactor: boolean;
} {
  const body = requireRecord(response.body, 'sign-in');
  return { requiresTwoFactor: requireBoolean(body, 'requiresTwoFactor') };
}

function parseBorrowingResponse(response: {
  body: unknown;
}): BorrowingApiResponse {
  const body = requireRecord(response.body, 'borrowing');
  const borrowStatus = requireRecord(body.borrowStatus, 'borrow status');
  return {
    id: requireString(body, 'id'),
    borrowNo: requireString(body, 'borrowNo'),
    borrowStatus: { code: requireString(borrowStatus, 'code') },
  };
}

function parseNotificationResponse(value: unknown): NotificationApiResponse {
  const body = requireRecord(value, 'notification');
  expect(body).not.toHaveProperty('eventKey');
  expect(body).not.toHaveProperty('userId');
  const readAt = body.readAt;
  if (readAt !== null && typeof readAt !== 'string') {
    throw new Error('Invalid readAt in API response');
  }
  return {
    id: requireString(body, 'id'),
    type: requireOneOf(body, 'type', notificationTypes),
    title: requireString(body, 'title'),
    message: requireString(body, 'message'),
    resourceType: requireOneOf(body, 'resourceType', notificationResourceTypes),
    resourceId: requireString(body, 'resourceId'),
    readAt,
    createdAt: requireString(body, 'createdAt'),
  };
}

function parseNotificationListResponse(response: {
  body: unknown;
}): NotificationListApiResponse {
  const body = requireRecord(response.body, 'notification list');
  const items = body.data;
  if (!Array.isArray(items)) throw new Error('Invalid data in API response');
  const meta = requireRecord(body.meta, 'pagination');
  return {
    data: items.map(parseNotificationResponse),
    meta: {
      page: requireNumber(meta, 'page'),
      limit: requireNumber(meta, 'limit'),
      total: requireNumber(meta, 'total'),
      totalPages: requireNumber(meta, 'totalPages'),
      hasNextPage: requireBoolean(meta, 'hasNextPage'),
      hasPrevPage: requireBoolean(meta, 'hasPrevPage'),
    },
  };
}

function parseUnreadCountResponse(response: { body: unknown }): {
  count: number;
} {
  const body = requireRecord(response.body, 'unread count');
  return { count: requireNumber(body, 'count') };
}

class SseEventReader {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder = new TextDecoder();
  private buffer = '';
  private pendingRead?: Promise<ReadableStreamReadResult<Uint8Array>>;
  private readonly frames: SseFrame[] = [];
  private done = false;

  constructor(body: ReadableStream<Uint8Array>) {
    this.reader = body.getReader();
  }

  async next(timeoutMs: number): Promise<{
    frame?: SseFrame;
    closed: boolean;
    timedOut: boolean;
  }> {
    const queued = this.frames.shift();
    if (queued) return { frame: queued, closed: false, timedOut: false };
    if (this.done) return { closed: true, timedOut: false };

    const deadline = Date.now() + timeoutMs;
    while (this.frames.length === 0 && !this.done) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        return { closed: false, timedOut: true };
      }

      this.pendingRead ??= this.reader.read();
      let timer: NodeJS.Timeout | undefined;
      const outcome = await Promise.race([
        this.pendingRead.then((result) => ({ kind: 'read' as const, result })),
        new Promise<{ kind: 'timeout' }>((resolve) => {
          timer = setTimeout(() => resolve({ kind: 'timeout' }), remainingMs);
        }),
      ]).catch(() => ({ kind: 'closed' as const }));
      if (timer) clearTimeout(timer);

      if (outcome.kind === 'timeout') {
        return { closed: false, timedOut: true };
      }
      if (outcome.kind === 'closed') {
        this.done = true;
        break;
      }

      this.pendingRead = undefined;
      if (outcome.result.done) {
        this.done = true;
        break;
      }
      this.buffer += this.decoder.decode(outcome.result.value, {
        stream: true,
      });
      this.parseAvailableFrames();
    }

    const frame = this.frames.shift();
    return {
      ...(frame ? { frame } : {}),
      closed: this.done,
      timedOut: false,
    };
  }

  async waitUntilClosed(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (!this.done) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) return false;
      const result = await this.next(remainingMs);
      if (result.closed) return true;
      if (result.timedOut) return false;
    }
    return true;
  }

  private parseAvailableFrames(): void {
    this.buffer = this.buffer.replace(/\r\n/g, '\n');
    let boundary = this.buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const fields = block.split('\n');
      const event = fields.find((field) => field.startsWith('event:'));
      const id = fields.find((field) => field.startsWith('id:'));
      const data = fields
        .filter((field) => field.startsWith('data:'))
        .map((field) => field.slice('data:'.length).trimStart())
        .join('\n');

      if (event) {
        this.frames.push({
          event: event.slice('event:'.length).trim(),
          data: data ? (JSON.parse(data) as unknown) : undefined,
          ...(id ? { id: id.slice('id:'.length).trim() } : {}),
        });
      }
      boundary = this.buffer.indexOf('\n\n');
    }
  }
}

async function expectNoCreatedEvent(
  reader: SseEventReader,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return;
    const result = await reader.next(remainingMs);
    expect(result.closed).toBe(false);
    if (result.timedOut) return;
    expect(result.frame?.event).not.toBe('notification.created');
  }
}

async function expectNoEvent(
  reader: SseEventReader,
  eventType: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return;
    const result = await reader.next(remainingMs);
    expect(result.closed).toBe(false);
    if (result.timedOut) return;
    expect(result.frame?.event).not.toBe(eventType);
  }
}

describe('Notification API and SSE (real auth + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let pool: import('pg').Pool | undefined;
  let testSectionId: string;
  let departmentSectionId: string;
  let departmentUserId = '';
  let firstCenterUserId: string;
  let secondCenterUserId: string;
  let bannedCenterUserId: string;
  let deletedCenterUserId: string;
  let parcelUserId: string;
  let assetTypeId: number;
  let companyId: string;
  let assetId: string;
  let centerServiceAssetId: string;
  let departmentCookie = '';
  let firstCenterCookie = '';
  let secondCenterCookie = '';
  let firstCenterSessionToken = '';
  let secondCenterSessionToken = '';
  const borrowIds: string[] = [];
  const userIds: string[] = [];
  const abortControllers: AbortController[] = [];

  const server = () => app.getHttpServer() as Server;
  const baseUrl = () => {
    const address = server().address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  };

  function setCookies(response: request.Response): string[] {
    const header = response.headers['set-cookie'];
    return Array.isArray(header) ? header : header ? [header] : [];
  }

  function cookiePair(response: request.Response, name: string): string {
    const cookie = setCookies(response).find((value) =>
      value.startsWith(`${name}=`),
    );
    return cookie ? cookie.split(';', 1)[0] : '';
  }

  function sessionCookieHeader(response: request.Response): string {
    return setCookies(response)
      .filter((cookie) =>
        /^(?:__Secure-|__Host-)?better-auth\.session_(?:token|data)(?:\.\d+)?=/i.test(
          cookie,
        ),
      )
      .map((cookie) => cookie.split(';', 1)[0])
      .join('; ');
  }

  function sessionTokenFromCookie(cookieHeader: string): string {
    const pair = cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) =>
        /^(?:__Secure-|__Host-)?better-auth\.session_token=/i.test(cookie),
      );
    if (!pair) throw new Error('Session cookie was not returned');
    const encodedValue = pair.slice(pair.indexOf('=') + 1);
    return decodeURIComponent(encodedValue).split('.', 1)[0];
  }

  async function createUser(
    email: string,
    role: UserRole,
    sectionId: string,
  ): Promise<string> {
    const created = await app.get(UsersService).create(
      {
        email,
        password: 'TestPassword@1234!',
        userName: `notify_${randomUUID().slice(0, 12)}`,
        firstname: 'Notification',
        lastname: role,
        role,
        sectionId,
      },
      `notification-fixture:${randomUUID()}`,
    );
    userIds.push(created.id);
    await prisma.user.update({
      where: { id: created.id },
      data: { emailVerified: true },
    });
    return created.id;
  }

  async function enrollTwoFactor(
    userId: string,
    email: string,
  ): Promise<string> {
    const twoFactor = app.get(TwoFactorService);
    const enrollment = await twoFactor.generateSecret(userId, email);
    await twoFactor.verifyPendingEnrollment(
      userId,
      generateSync({ secret: enrollment.secret }),
    );
    await twoFactor.confirmBackupCodesSaved(userId);
    return enrollment.secret;
  }

  async function signInDepartment(email: string): Promise<string> {
    const response = await request(server()).post('/auth/sign-in').send({
      email,
      password: 'TestPassword@1234!',
    });
    expect(response.status).toBe(200);
    return sessionCookieHeader(response);
  }

  async function signInCenter(
    email: string,
    totpSecret: string,
  ): Promise<string> {
    const passwordVerified = await request(server())
      .post('/auth/sign-in')
      .send({ email, password: 'TestPassword@1234!' });
    expect(passwordVerified.status).toBe(200);
    expect(parseSignInResponse(passwordVerified).requiresTwoFactor).toBe(true);

    const verified = await request(server())
      .post('/auth/2fa/verify-totp')
      .set('Cookie', cookiePair(passwordVerified, 'hams.pre_auth'))
      .send({ code: generateSync({ secret: totpSecret }) });
    expect(verified.status).toBe(200);
    return sessionCookieHeader(verified);
  }

  async function getCsrfProof(
    sessionCookie: string,
  ): Promise<{ cookie: string; token: string }> {
    const response = await request(server())
      .get('/auth/csrf')
      .set('Cookie', sessionCookie)
      .expect(200);
    const cookieName =
      process.env.NODE_ENV === 'production' ? '__Host-hams.csrf' : 'hams.csrf';
    const csrfCookie = cookiePair(response, cookieName);
    if (!csrfCookie) throw new Error('CSRF cookie was not returned');
    const body = requireRecord(response.body, 'CSRF proof');
    return {
      cookie: `${sessionCookie}; ${csrfCookie}`,
      token: requireString(body, 'csrfToken'),
    };
  }

  async function openStream(
    cookie: string,
    lastEventId?: string,
  ): Promise<{ reader: SseEventReader; controller: AbortController }> {
    const controller = new AbortController();
    abortControllers.push(controller);
    const headers: Record<string, string> = { Cookie: cookie };
    if (lastEventId) headers['Last-Event-ID'] = lastEventId;
    const response = await fetch(`${baseUrl()}/notifications/stream`, {
      headers,
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-store');
    if (!response.body) throw new Error('SSE response has no body');
    return { reader: new SseEventReader(response.body), controller };
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      throw new Error(
        'TEST_DATABASE_URL is required for this integration suite',
      );
    }
    if (!/test/i.test(new URL(testDatabaseUrl).pathname)) {
      throw new Error('TEST_DATABASE_URL must name a disposable test database');
    }
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);

    const pg = await import('pg');
    pool = new pg.Pool({ connectionString: testDatabaseUrl });
    prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    });
    await prisma.$connect();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0);

    const centerSection = await prisma.section.upsert({
      where: { code: 'CENTER' },
      update: {},
      create: { code: 'CENTER', name: 'Asset Center' },
    });
    testSectionId = centerSection.id;
    const departmentSection = await prisma.section.create({
      data: {
        code: `NT-${randomUUID().slice(0, 8)}`,
        name: 'Notification test department',
      },
    });
    departmentSectionId = departmentSection.id;

    const suffix = randomUUID();
    const departmentEmail = `notification-dept-${suffix}@hams-test.local`;
    const firstCenterEmail = `notification-center-a-${suffix}@hams-test.local`;
    const secondCenterEmail = `notification-center-b-${suffix}@hams-test.local`;
    departmentUserId = await createUser(
      departmentEmail,
      UserRole.DEPARTMENT_STAFF,
      departmentSectionId,
    );
    firstCenterUserId = await createUser(
      firstCenterEmail,
      UserRole.ASSET_CENTER_STAFF,
      testSectionId,
    );
    secondCenterUserId = await createUser(
      secondCenterEmail,
      UserRole.ASSET_CENTER_STAFF,
      testSectionId,
    );
    const firstSecret = await enrollTwoFactor(
      firstCenterUserId,
      firstCenterEmail,
    );
    const secondSecret = await enrollTwoFactor(
      secondCenterUserId,
      secondCenterEmail,
    );

    const inactiveAccounts = await Promise.all([
      prisma.user.create({
        data: {
          id: randomUUID(),
          email: `notification-banned-${suffix}@hams-test.local`,
          emailVerified: true,
          firstname: 'Banned',
          lastname: 'Center',
          role: UserRole.ASSET_CENTER_STAFF,
          section_id: testSectionId,
          banned: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          id: randomUUID(),
          email: `notification-deleted-${suffix}@hams-test.local`,
          emailVerified: true,
          firstname: 'Deleted',
          lastname: 'Center',
          role: UserRole.ASSET_CENTER_STAFF,
          section_id: testSectionId,
          deletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          id: randomUUID(),
          email: `notification-parcel-${suffix}@hams-test.local`,
          emailVerified: true,
          firstname: 'Parcel',
          lastname: 'Staff',
          role: UserRole.PARCEL_STAFF,
          section_id: testSectionId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        select: { id: true },
      }),
    ]);
    [bannedCenterUserId, deletedCenterUserId, parcelUserId] =
      inactiveAccounts.map(({ id }) => id);
    userIds.push(bannedCenterUserId, deletedCenterUserId, parcelUserId);

    departmentCookie = await signInDepartment(departmentEmail);
    firstCenterCookie = await signInCenter(firstCenterEmail, firstSecret);
    secondCenterCookie = await signInCenter(secondCenterEmail, secondSecret);
    firstCenterSessionToken = sessionTokenFromCookie(firstCenterCookie);
    secondCenterSessionToken = sessionTokenFromCookie(secondCenterCookie);

    const [assetType, company, assetStatus, availableStatus] =
      await Promise.all([
        prisma.assetType.create({
          data: { name: `Notification ${suffix}`, useful_life: 1 },
        }),
        prisma.company.create({
          data: { code: `NT-${suffix.slice(0, 8)}`, name: 'Notification test' },
        }),
        prisma.assetStatus.upsert({
          where: { code: 'NORMAL' },
          create: { code: 'NORMAL', name: 'Normal' },
          update: {},
        }),
        prisma.availabilityStatus.upsert({
          where: { code: 'AVAILABLE' },
          create: { code: 'AVAILABLE', name: 'Available' },
          update: {},
        }),
      ]);
    assetTypeId = assetType.id;
    companyId = company.id;
    await prisma.borrowStatus.upsert({
      where: { code: 'PENDING_APPROVE' },
      create: { code: 'PENDING_APPROVE', name: 'Pending approval' },
      update: {},
    });
    await prisma.borrowStatus.upsert({
      where: { code: 'BORROWED' },
      create: { code: 'BORROWED', name: 'Borrowed' },
      update: {},
    });
    await prisma.availabilityStatus.upsert({
      where: { code: 'RESERVED' },
      create: { code: 'RESERVED', name: 'Reserved' },
      update: {},
    });
    await prisma.availabilityStatus.upsert({
      where: { code: 'BORROWED' },
      create: { code: 'BORROWED', name: 'Borrowed' },
      update: {},
    });
    assetId = (
      await prisma.asset.create({
        data: {
          name: 'Notification test asset',
          model: 'Test model',
          price: 1,
          receivedDate: new Date('2026-01-01T00:00:00.000Z'),
          type_id: assetTypeId,
          section_id: testSectionId,
          company_id: companyId,
          asset_status_id: assetStatus.id,
          availability_status_id: availableStatus.id,
          owner_id: firstCenterUserId,
          createdBy: firstCenterUserId,
          updatedBy: firstCenterUserId,
        },
        select: { id: true },
      })
    ).id;
    centerServiceAssetId = (
      await prisma.asset.create({
        data: {
          name: 'Center service notification test asset',
          model: 'Test model',
          price: 1,
          receivedDate: new Date('2026-01-01T00:00:00.000Z'),
          type_id: assetTypeId,
          section_id: testSectionId,
          company_id: companyId,
          asset_status_id: assetStatus.id,
          availability_status_id: availableStatus.id,
          owner_id: firstCenterUserId,
          createdBy: firstCenterUserId,
          updatedBy: firstCenterUserId,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    for (const controller of abortControllers) controller.abort();
    if (app) await app.close();
    if (prisma) {
      if (borrowIds.length > 0) {
        await prisma.notification.deleteMany({
          where: { resourceId: { in: borrowIds } },
        });
        await prisma.borrowTransaction.deleteMany({
          where: { id: { in: borrowIds } },
        });
      }
      const fixtureAssetIds = [assetId, centerServiceAssetId].filter(Boolean);
      if (fixtureAssetIds.length > 0) {
        await prisma.asset.deleteMany({
          where: { id: { in: fixtureAssetIds } },
        });
      }
      if (userIds.length > 0) {
        await prisma.preAuthChallenge.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.twoFactorAuth.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.trustedDevice.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      if (companyId)
        await prisma.company.deleteMany({ where: { id: companyId } });
      if (assetTypeId) {
        await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
      }
      if (departmentSectionId) {
        await prisma.section.deleteMany({ where: { id: departmentSectionId } });
      }
      await prisma.$disconnect();
      if (pool) await pool.end();
    }
  });

  it('requires the existing authenticated cookie for notification APIs', async () => {
    await request(server()).get('/notifications').expect(401);
    await request(server()).get('/notifications/unread-count').expect(401);
    await request(server()).get('/notifications/stream').expect(401);
  });

  it('stores each pending borrow recipient and delivers it through SSE', async () => {
    const firstStream = await openStream(firstCenterCookie);
    const secondTabStream = await openStream(firstCenterCookie);
    const secondStaffStream = await openStream(secondCenterCookie);
    const borrowerStream = await openStream(departmentCookie);

    for (const stream of [firstStream, secondTabStream, secondStaffStream]) {
      const initial = await stream.reader.next(5_000);
      expect(initial.frame?.event).toBe('notifications.sync_required');
      expect(initial.frame?.data).toEqual({ reason: 'connected' });
    }
    const borrowerInitial = await borrowerStream.reader.next(5_000);
    expect(borrowerInitial.frame?.event).toBe('notifications.sync_required');

    const created = await request(server())
      .post('/borrowings')
      .set('Cookie', departmentCookie)
      .send({
        assetId,
        deliveryMethod: 'PICKUP',
        expectedReturnDate: new Date(
          Date.now() + 2 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .expect(201);
    const createdBody = parseBorrowingResponse(created);
    borrowIds.push(createdBody.id);
    expect(createdBody.borrowStatus.code).toBe('PENDING_APPROVE');

    await request(server())
      .post('/borrowings')
      .set('Cookie', departmentCookie)
      .send({ assetId, deliveryMethod: 'PICKUP' })
      .expect(409);

    for (const stream of [firstStream, secondTabStream, secondStaffStream]) {
      const delivered = await stream.reader.next(5_000);
      expect(delivered.frame?.event).toBe('notification.created');
      expect(delivered.frame?.data).toMatchObject({
        type: NotificationType.BORROW_APPROVAL_REQUIRED,
        resourceType: NotificationResourceType.BORROW_TRANSACTION,
        resourceId: createdBody.id,
        readAt: null,
      });
    }
    const borrowerEvent = await borrowerStream.reader.next(250);
    expect(borrowerEvent.timedOut).toBe(true);
    expect(borrowerEvent.closed).toBe(false);

    const firstList = await request(server())
      .get('/notifications')
      .set('Cookie', firstCenterCookie)
      .expect(200);
    expect(firstList.headers['cache-control']).toBe('no-store');
    const firstListBody = parseNotificationListResponse(firstList);
    expect(firstListBody.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
    expect(firstListBody.data[0]).toMatchObject({
      type: NotificationType.BORROW_APPROVAL_REQUIRED,
      resourceId: createdBody.id,
      readAt: null,
    });
    await request(server())
      .get('/notifications?limit=101')
      .set('Cookie', firstCenterCookie)
      .expect(400);
    await request(server())
      .get('/notifications?page=1.5')
      .set('Cookie', firstCenterCookie)
      .expect(400);
    await request(server())
      .get('/notifications?page=99999999999999999')
      .set('Cookie', firstCenterCookie)
      .expect(400);
    await request(server())
      .get('/notifications?pag=1')
      .set('Cookie', firstCenterCookie)
      .expect(400);

    const firstCount = await request(server())
      .get('/notifications/unread-count')
      .set('Cookie', firstCenterCookie)
      .expect(200);
    expect(firstCount.headers['cache-control']).toBe('no-store');
    expect(parseUnreadCountResponse(firstCount)).toEqual({ count: 1 });
    const secondCount = await request(server())
      .get('/notifications/unread-count')
      .set('Cookie', secondCenterCookie)
      .expect(200);
    expect(parseUnreadCountResponse(secondCount)).toEqual({ count: 1 });
    const borrowerList = await request(server())
      .get('/notifications')
      .set('Cookie', departmentCookie)
      .expect(200);
    const borrowerListBody = parseNotificationListResponse(borrowerList);
    expect(borrowerListBody.data).toEqual([]);
    expect(borrowerListBody.meta.total).toBe(0);

    const persisted = await prisma.notification.findMany({
      where: { resourceId: createdBody.id },
      select: { userId: true, type: true, eventKey: true, readAt: true },
    });
    const eligibleCenterUsers = await prisma.user.findMany({
      where: {
        role: UserRole.ASSET_CENTER_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    expect(new Set(persisted.map(({ userId }) => userId))).toEqual(
      new Set(eligibleCenterUsers.map(({ id }) => id)),
    );
    expect(
      persisted.every(
        ({ type, readAt }) =>
          type === NotificationType.BORROW_APPROVAL_REQUIRED && readAt === null,
      ),
    ).toBe(true);
    expect(
      persisted.every(
        ({ eventKey }) =>
          eventKey ===
          `${NotificationType.BORROW_APPROVAL_REQUIRED}:${createdBody.id}`,
      ),
    ).toBe(true);
    expect(
      await prisma.notification.count({
        where: {
          resourceId: createdBody.id,
          userId: {
            in: [bannedCenterUserId, deletedCenterUserId, parcelUserId],
          },
        },
      }),
    ).toBe(0);

    const notifications = app.get(NotificationsService);
    const duplicateObserver = await openStream(firstCenterCookie);
    expect((await duplicateObserver.reader.next(5_000)).frame?.event).toBe(
      'notifications.sync_required',
    );
    const duplicateRows = await prisma.$transaction((tx) =>
      notifications.createBorrowApprovalRequired(
        tx,
        {
          id: createdBody.id,
          borrowNo: createdBody.borrowNo,
        },
        'Notification test asset',
      ),
    );
    expect(duplicateRows).toEqual([]);
    notifications.publishCommitted(duplicateRows);
    await expectNoCreatedEvent(duplicateObserver.reader, 250);

    const eligibleCenterUserIds = eligibleCenterUsers.map(({ id }) => id);
    const notificationsBeforeRollback = await prisma.notification.count({
      where: { userId: { in: eligibleCenterUserIds } },
    });
    const assetBeforeRollback = await prisma.asset.findUniqueOrThrow({
      where: { id: centerServiceAssetId },
      select: { availability_status_id: true },
    });

    try {
      // Fail after the notification insert reaches PostgreSQL so the public borrow
      // request must roll back the asset, borrow, and notification together.
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION public.raise_borrow_notification_for_test()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $notification_test$
        BEGIN
          IF NEW.type = 'BORROW_APPROVAL_REQUIRED' THEN
            RAISE EXCEPTION 'notification rollback integration test';
          END IF;
          RETURN NEW;
        END;
        $notification_test$
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER raise_borrow_notification_for_test
        AFTER INSERT ON public.notifications
        FOR EACH ROW
        EXECUTE FUNCTION public.raise_borrow_notification_for_test()
      `;

      await request(server())
        .post('/borrowings')
        .set('Cookie', departmentCookie)
        .send({
          assetId: centerServiceAssetId,
          deliveryMethod: 'PICKUP',
          expectedReturnDate: new Date(
            Date.now() + 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .expect(500);
    } finally {
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS raise_borrow_notification_for_test
        ON public.notifications
      `;
      await prisma.$executeRaw`
        DROP FUNCTION IF EXISTS public.raise_borrow_notification_for_test()
      `;
    }

    expect(
      await prisma.borrowTransaction.count({
        where: { asset_id: centerServiceAssetId },
      }),
    ).toBe(0);
    expect(
      await prisma.asset.findUniqueOrThrow({
        where: { id: centerServiceAssetId },
        select: { availability_status_id: true },
      }),
    ).toEqual(assetBeforeRollback);
    expect(
      await prisma.notification.count({
        where: { userId: { in: eligibleCenterUserIds } },
      }),
    ).toBe(notificationsBeforeRollback);
    await expectNoCreatedEvent(duplicateObserver.reader, 250);

    const centerServiceObserver = await openStream(firstCenterCookie);
    expect((await centerServiceObserver.reader.next(5_000)).frame?.event).toBe(
      'notifications.sync_required',
    );
    const centerServiceBorrow = await request(server())
      .post('/borrowings')
      .set('Cookie', firstCenterCookie)
      .send({
        assetId: centerServiceAssetId,
        borrowerId: departmentUserId,
        deliveryMethod: 'PICKUP',
        expectedReturnDate: new Date(
          Date.now() + 2 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .expect(201);
    const centerServiceBody = parseBorrowingResponse(centerServiceBorrow);
    borrowIds.push(centerServiceBody.id);
    expect(centerServiceBody.borrowStatus.code).toBe('BORROWED');
    expect(
      await prisma.notification.count({
        where: { resourceId: centerServiceBody.id },
      }),
    ).toBe(0);
    await expectNoCreatedEvent(centerServiceObserver.reader, 250);

    const reconnect = await openStream(
      firstCenterCookie,
      'last-notification-id',
    );
    const reconnectFrame = await reconnect.reader.next(5_000);
    expect(reconnectFrame.frame?.event).toBe('notifications.sync_required');
    expect(reconnectFrame.frame?.data).toEqual({ reason: 'reconnected' });

    const sessionBeforeHeartbeat = await prisma.session.findUniqueOrThrow({
      where: { token: firstCenterSessionToken },
      select: { updatedAt: true },
    });
    const heartbeat = await firstStream.reader.next(20_000);
    expect(heartbeat.frame?.event).toBe('heartbeat');
    const sessionAfterHeartbeat = await prisma.session.findUniqueOrThrow({
      where: { token: firstCenterSessionToken },
      select: { updatedAt: true },
    });
    expect(sessionAfterHeartbeat.updatedAt).toEqual(
      sessionBeforeHeartbeat.updatedAt,
    );
    expect(
      await prisma.notification.count({
        where: { resourceId: createdBody.id },
      }),
    ).toBe(eligibleCenterUsers.length);

    await prisma.session.deleteMany({
      where: { token: secondCenterSessionToken },
    });
    expect(await secondStaffStream.reader.waitUntilClosed(20_000)).toBe(true);
  });

  it('marks only the recipient copy as read and invalidates that user’s streams', async () => {
    const borrowId = borrowIds[0];
    if (!borrowId) throw new Error('Borrow fixture was not created');
    const firstListResponse = await request(server())
      .get('/notifications')
      .set('Cookie', firstCenterCookie)
      .expect(200);
    const firstNotification =
      parseNotificationListResponse(firstListResponse).data[0];
    if (!firstNotification) throw new Error('No first user notification found');

    const otherUserNotification = await prisma.notification.create({
      data: {
        userId: departmentUserId,
        type: NotificationType.BORROW_APPROVAL_REQUIRED,
        title: 'Other recipient read-state fixture',
        message: 'Read-state integration fixture',
        resourceType: NotificationResourceType.BORROW_TRANSACTION,
        resourceId: borrowId,
        eventKey: `read-state-other-test:${randomUUID()}`,
      },
      select: { id: true },
    });
    const otherUserListResponse = await request(server())
      .get('/notifications')
      .set('Cookie', departmentCookie)
      .expect(200);
    expect(
      parseNotificationListResponse(otherUserListResponse).data.map(
        ({ id }) => id,
      ),
    ).toContain(otherUserNotification.id);

    const firstStream = await openStream(firstCenterCookie);
    const secondTabStream = await openStream(firstCenterCookie);
    const otherUserStream = await openStream(departmentCookie);
    for (const stream of [firstStream, secondTabStream, otherUserStream]) {
      expect((await stream.reader.next(5_000)).frame?.event).toBe(
        'notifications.sync_required',
      );
    }

    const firstCsrf = await getCsrfProof(firstCenterCookie);
    const otherUserCsrf = await getCsrfProof(departmentCookie);
    const readPath = `/notifications/${firstNotification.id}/read`;
    const origin = 'http://localhost:5173';

    await request(server())
      .patch(readPath)
      .set('Origin', origin)
      .set('Cookie', firstCenterCookie)
      .send({})
      .expect(403);
    await request(server())
      .patch(readPath)
      .set('Origin', origin)
      .set('Cookie', firstCsrf.cookie)
      .set('X-CSRF-Token', firstCsrf.token)
      .send({ userId: firstCenterUserId, readAt: new Date().toISOString() })
      .expect(400);
    await request(server())
      .patch(`/notifications/${otherUserNotification.id}/read`)
      .set('Origin', origin)
      .set('Cookie', firstCsrf.cookie)
      .set('X-CSRF-Token', firstCsrf.token)
      .send({})
      .expect(404);
    await request(server())
      .patch(`/notifications/${randomUUID()}/read`)
      .set('Origin', origin)
      .set('Cookie', firstCsrf.cookie)
      .set('X-CSRF-Token', firstCsrf.token)
      .send({})
      .expect(404);

    const markedResponse = await request(server())
      .patch(readPath)
      .set('Origin', origin)
      .set('Cookie', firstCsrf.cookie)
      .set('X-CSRF-Token', firstCsrf.token)
      .send({})
      .expect(200);
    const marked = parseNotificationResponse(markedResponse.body);
    expect(marked.id).toBe(firstNotification.id);
    expect(marked.readAt).toEqual(expect.any(String));

    for (const stream of [firstStream, secondTabStream]) {
      const changed = await stream.reader.next(5_000);
      expect(changed.frame).toMatchObject({
        event: 'notifications.changed',
        data: { reason: 'read_state' },
      });
    }
    await expectNoEvent(otherUserStream.reader, 'notifications.changed', 250);

    const firstCount = await request(server())
      .get('/notifications/unread-count')
      .set('Cookie', firstCenterCookie)
      .expect(200);
    const otherUserCount = await request(server())
      .get('/notifications/unread-count')
      .set('Cookie', departmentCookie)
      .expect(200);
    expect(parseUnreadCountResponse(firstCount)).toEqual({ count: 0 });
    expect(parseUnreadCountResponse(otherUserCount)).toEqual({ count: 1 });

    const repeatedResponse = await request(server())
      .patch(readPath)
      .set('Origin', origin)
      .set('Cookie', firstCsrf.cookie)
      .set('X-CSRF-Token', firstCsrf.token)
      .send({})
      .expect(200);
    const repeated = parseNotificationResponse(repeatedResponse.body);
    expect(repeated.readAt).toBe(marked.readAt);
    await expectNoEvent(firstStream.reader, 'notifications.changed', 250);
    await expectNoEvent(secondTabStream.reader, 'notifications.changed', 250);

    const createReadAllFixture = (label: string, createdAt?: Date) =>
      prisma.notification.create({
        data: {
          userId: firstCenterUserId,
          type: NotificationType.BORROW_APPROVAL_REQUIRED,
          title: `Read-all fixture ${label}`,
          message: 'Read-state integration fixture',
          resourceType: NotificationResourceType.BORROW_TRANSACTION,
          resourceId: borrowId,
          eventKey: `read-all-test:${randomUUID()}`,
          ...(createdAt ? { createdAt } : {}),
        },
        select: { id: true },
      });
    const existingFixtureA = await createReadAllFixture('A');
    const existingFixtureB = await createReadAllFixture('B');
    const afterCutoffFixture = await createReadAllFixture(
      'after-cutoff',
      new Date(Date.now() + 60_000),
    );
    const originalReadAt = marked.readAt;
    if (!pool) throw new Error('PostgreSQL test pool is not available');

    const lockKey = 82719403;
    const lockClient = await pool.connect();
    let arrivalClient: import('pg').PoolClient | undefined;
    let lockHeld = false;
    let arrivalTransactionOpen = false;
    let pendingReadAll:
      | Promise<{ response: request.Response } | { error: unknown }>
      | undefined;
    let concurrentArrivalId = '';
    let readAllAt = '';
    try {
      arrivalClient = await pool.connect();
      await lockClient.query('SELECT pg_advisory_lock($1::bigint)', [lockKey]);
      lockHeld = true;
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION public.block_notification_read_all_for_test()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $notification_read_all_test$
        BEGIN
          PERFORM pg_advisory_xact_lock(82719403::bigint);
          RETURN NULL;
        END;
        $notification_read_all_test$
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER block_notification_read_all_for_test
        BEFORE UPDATE ON public.notifications
        FOR EACH STATEMENT
        EXECUTE FUNCTION public.block_notification_read_all_for_test()
      `;

      await arrivalClient.query('BEGIN');
      arrivalTransactionOpen = true;
      concurrentArrivalId = randomUUID();
      await arrivalClient.query(
        `INSERT INTO public.notifications
          (id, user_id, type, title, message, resource_type, resource_id, event_key)
         VALUES
          ($1, $2, 'BORROW_APPROVAL_REQUIRED', 'Concurrent arrival fixture',
           'Read-state integration fixture', 'BORROW_TRANSACTION', $3, $4)`,
        [
          concurrentArrivalId,
          firstCenterUserId,
          borrowId,
          `read-all-concurrent-test:${randomUUID()}`,
        ],
      );

      pendingReadAll = (async () => {
        try {
          return {
            response: await request(server())
              .patch('/notifications/read-all')
              .set('Origin', origin)
              .set('Cookie', firstCsrf.cookie)
              .set('X-CSRF-Token', firstCsrf.token)
              .send({})
              .expect(200),
          };
        } catch (error) {
          return { error };
        }
      })();

      const lockDeadline = Date.now() + 10_000;
      let updateIsBlocked = false;
      while (Date.now() < lockDeadline) {
        const [activity] = await prisma.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (
            SELECT 1
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND state = 'active'
              AND wait_event_type = 'Lock'
              AND wait_event = 'advisory'
          ) AS waiting
        `;
        if (activity?.waiting) {
          updateIsBlocked = true;
          break;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 25));
      }
      expect(updateIsBlocked).toBe(true);

      await arrivalClient.query('COMMIT');
      arrivalTransactionOpen = false;
      await lockClient.query('SELECT pg_advisory_unlock($1::bigint)', [
        lockKey,
      ]);
      lockHeld = false;

      const outcome = await pendingReadAll;
      if ('error' in outcome) throw outcome.error;
      const readAllBody = requireRecord(outcome.response.body, 'read-all');
      expect(requireNumber(readAllBody, 'updatedCount')).toBe(2);
      readAllAt = requireString(readAllBody, 'readAt');
    } finally {
      if (arrivalTransactionOpen && arrivalClient) {
        await arrivalClient.query('ROLLBACK');
      }
      if (lockHeld) {
        await lockClient.query('SELECT pg_advisory_unlock($1::bigint)', [
          lockKey,
        ]);
      }
      if (pendingReadAll) await pendingReadAll;
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS block_notification_read_all_for_test
        ON public.notifications
      `;
      await prisma.$executeRaw`
        DROP FUNCTION IF EXISTS public.block_notification_read_all_for_test()
      `;
      arrivalClient?.release();
      lockClient.release();
    }

    for (const stream of [firstStream, secondTabStream]) {
      const changed = await stream.reader.next(5_000);
      expect(changed.frame).toMatchObject({
        event: 'notifications.changed',
        data: { reason: 'read_state' },
      });
    }
    await expectNoEvent(otherUserStream.reader, 'notifications.changed', 250);

    const finalListResponse = await request(server())
      .get('/notifications')
      .set('Cookie', firstCenterCookie)
      .expect(200);
    const finalNotifications =
      parseNotificationListResponse(finalListResponse).data;
    const byId = new Map(finalNotifications.map((item) => [item.id, item]));
    expect(byId.get(firstNotification.id)?.readAt).toBe(originalReadAt);
    expect(byId.get(existingFixtureA.id)?.readAt).toBe(readAllAt);
    expect(byId.get(existingFixtureB.id)?.readAt).toBe(readAllAt);
    expect(byId.get(afterCutoffFixture.id)?.readAt).toBeNull();
    expect(byId.get(concurrentArrivalId)?.readAt).toBeNull();

    const remainingCount = await request(server())
      .get('/notifications/unread-count')
      .set('Cookie', firstCenterCookie)
      .expect(200);
    expect(parseUnreadCountResponse(remainingCount)).toEqual({ count: 2 });

    const notificationsService =
      app.get<NotificationsService>(NotificationsService);
    let handlerCutoffFixtureId = '';
    jest
      .spyOn(notificationsService, 'markAllReadForUser')
      .mockImplementation(async (userId, cutoffAt) => {
        const arrival = await createReadAllFixture(
          'after-handler-cutoff',
          new Date(cutoffAt.getTime() + 10_000),
        );
        handlerCutoffFixtureId = arrival.id;
        jest.restoreAllMocks();
        return notificationsService.markAllReadForUser(userId, cutoffAt);
      });
    let handlerCutoffResponse: request.Response | undefined;
    try {
      handlerCutoffResponse = await request(server())
        .patch('/notifications/read-all')
        .set('Origin', origin)
        .set('Cookie', firstCsrf.cookie)
        .set('X-CSRF-Token', firstCsrf.token)
        .send({})
        .expect(200);
    } finally {
      jest.restoreAllMocks();
    }
    if (!handlerCutoffResponse || !handlerCutoffFixtureId) {
      throw new Error('Handler cutoff integration fixture was not created');
    }
    const handlerCutoffBody = requireRecord(
      handlerCutoffResponse.body,
      'handler-cutoff read-all',
    );
    expect(requireNumber(handlerCutoffBody, 'updatedCount')).toBe(1);
    const handlerCutoffReadAt = requireString(handlerCutoffBody, 'readAt');
    for (const stream of [firstStream, secondTabStream]) {
      expect((await stream.reader.next(5_000)).frame).toMatchObject({
        event: 'notifications.changed',
        data: { reason: 'read_state' },
      });
    }
    await expectNoEvent(otherUserStream.reader, 'notifications.changed', 250);

    const handlerCutoffList = await request(server())
      .get('/notifications')
      .set('Cookie', firstCenterCookie)
      .expect(200);
    const handlerCutoffNotifications =
      parseNotificationListResponse(handlerCutoffList).data;
    const handlerCutoffById = new Map(
      handlerCutoffNotifications.map((item) => [item.id, item]),
    );
    expect(handlerCutoffById.get(concurrentArrivalId)?.readAt).toBe(
      handlerCutoffReadAt,
    );
    expect(handlerCutoffById.get(handlerCutoffFixtureId)?.readAt).toBeNull();
    const afterHandlerCutoffCount = await request(server())
      .get('/notifications/unread-count')
      .set('Cookie', firstCenterCookie)
      .expect(200);
    expect(parseUnreadCountResponse(afterHandlerCutoffCount)).toEqual({
      count: 2,
    });

    const otherUserMarkedResponse = await request(server())
      .patch(`/notifications/${otherUserNotification.id}/read`)
      .set('Origin', origin)
      .set('Cookie', otherUserCsrf.cookie)
      .set('X-CSRF-Token', otherUserCsrf.token)
      .send({})
      .expect(200);
    expect(
      parseNotificationResponse(otherUserMarkedResponse.body).readAt,
    ).toEqual(expect.any(String));
    expect((await otherUserStream.reader.next(5_000)).frame).toMatchObject({
      event: 'notifications.changed',
      data: { reason: 'read_state' },
    });

    const noOpReadAll = await request(server())
      .patch('/notifications/read-all')
      .set('Origin', origin)
      .set('Cookie', otherUserCsrf.cookie)
      .set('X-CSRF-Token', otherUserCsrf.token)
      .send({})
      .expect(200);
    expect(noOpReadAll.body).toEqual({ updatedCount: 0, readAt: null });
    await expectNoEvent(otherUserStream.reader, 'notifications.changed', 250);

    await request(server())
      .patch('/notifications/read-all')
      .set('Origin', origin)
      .set('Cookie', otherUserCsrf.cookie)
      .set('X-CSRF-Token', otherUserCsrf.token)
      .send({ userId: firstCenterUserId })
      .expect(400);
  });
});
