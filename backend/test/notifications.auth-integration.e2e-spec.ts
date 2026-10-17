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
  RequestSource,
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
import {
  BORROW_DEADLINE_CLOCK,
  BorrowDeadlineNotificationsService,
} from '../src/asset-borrow/borrow-deadline-notifications.service';

jest.setTimeout(60_000);

const testDatabaseUrl = process.env.TEST_DATABASE_URL!;

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
let borrowDeadlineNow = new Date();
const borrowDeadlineClock = {
  now: (): Date => new Date(borrowDeadlineNow),
};

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

async function createNotificationIntegrationApplication(): Promise<INestApplication> {
  process.env.NODE_ENV = 'test';
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(BORROW_DEADLINE_CLOCK)
    .useValue(borrowDeadlineClock)
    .compile();
  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0);
  return app;
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

async function waitForCreatedNotification(
  reader: SseEventReader,
  resourceId: string,
  type: NotificationType,
  timeoutMs = 10_000,
): Promise<NotificationApiResponse> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error(`Timed out waiting for ${type} on ${resourceId}`);
    }
    const result = await reader.next(remainingMs);
    if (result.closed) throw new Error('Notification stream closed');
    if (result.timedOut) {
      throw new Error(`Timed out waiting for ${type} on ${resourceId}`);
    }
    if (result.frame?.event !== 'notification.created') continue;
    const notification = parseNotificationResponse(result.frame.data);
    if (notification.resourceId === resourceId && notification.type === type) {
      return notification;
    }
  }
}

async function expectNoNotificationForResource(
  reader: SseEventReader,
  resourceId: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return;
    const result = await reader.next(remainingMs);
    expect(result.closed).toBe(false);
    if (result.timedOut) return;
    if (result.frame?.event !== 'notification.created') continue;
    const notification = parseNotificationResponse(result.frame.data);
    expect(notification.resourceId).not.toBe(resourceId);
  }
}

describe('Notification API and SSE (real auth + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let pool: import('pg').Pool | undefined;
  let testSectionId: string;
  let departmentSectionId: string;
  let repairOtherSectionId = '';
  let departmentUserId = '';
  let extensionRequesterUserId = '';
  let departmentEmail = '';
  let extensionRequesterEmail = '';
  let repairOtherDepartmentEmail = '';
  let repairOtherDepartmentCookie = '';
  let repairMaintenanceEmail = '';
  let repairMaintenanceCookie = '';
  let repairParcelUserId = '';
  let repairParcelEmail = '';
  let repairParcelSecret = '';
  let repairParcelCookie = '';
  let firstCenterUserId: string;
  let firstCenterEmail = '';
  let firstCenterSecret = '';
  let secondCenterUserId: string;
  let secondCenterEmail = '';
  let secondCenterSecret = '';
  let bannedCenterUserId: string;
  let deletedCenterUserId: string;
  let bannedParcelUserId: string;
  let deletedParcelUserId: string;
  let parcelUserId: string;
  let assetTypeId: number;
  let companyId: string;
  let assetId: string;
  let centerServiceAssetId: string;
  let parcelApprovalAssetId: string;
  let departmentBorrowId = '';
  let centerServiceBorrowId = '';
  let departmentCookie = '';
  let extensionRequesterCookie = '';
  let firstCenterCookie = '';
  let secondCenterCookie = '';
  let firstCenterSessionToken = '';
  let secondCenterSessionToken = '';
  const borrowIds: string[] = [];
  const extensionIds: string[] = [];
  const repairJobIds: string[] = [];
  const repairAssetIds: string[] = [];
  const borrowAssetIds: string[] = [];
  const userIds: string[] = [];
  const abortControllers: AbortController[] = [];
  let repairSparepartGroupId: number | undefined;
  let repairSparepartId: number | undefined;

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
    if (response.status !== 200) {
      throw new Error(
        `Department sign-in failed (${response.status}): ${JSON.stringify(response.body)}`,
      );
    }
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

  async function refreshTicket03Sessions(): Promise<void> {
    departmentCookie = await signInDepartment(departmentEmail);
    extensionRequesterCookie = await signInDepartment(extensionRequesterEmail);
    firstCenterCookie = await signInCenter(firstCenterEmail, firstCenterSecret);
    secondCenterCookie = await signInCenter(
      secondCenterEmail,
      secondCenterSecret,
    );
    firstCenterSessionToken = sessionTokenFromCookie(firstCenterCookie);
    secondCenterSessionToken = sessionTokenFromCookie(secondCenterCookie);
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

  async function createRepairTestAsset(
    sectionId: string,
    ownerId: string,
    name: string,
  ): Promise<string> {
    const [normalStatus, availableStatus] = await Promise.all([
      prisma.assetStatus.findUniqueOrThrow({ where: { code: 'NORMAL' } }),
      prisma.availabilityStatus.findUniqueOrThrow({
        where: { code: 'AVAILABLE' },
      }),
    ]);
    const asset = await prisma.asset.create({
      data: {
        name,
        model: 'Repair notification test model',
        price: 1,
        receivedDate: new Date('2026-01-01T00:00:00.000Z'),
        type_id: assetTypeId,
        section_id: sectionId,
        company_id: companyId,
        asset_status_id: normalStatus.id,
        availability_status_id: availableStatus.id,
        owner_id: ownerId,
        createdBy: ownerId,
        updatedBy: ownerId,
      },
      select: { id: true },
    });
    repairAssetIds.push(asset.id);
    return asset.id;
  }

  async function createDeadlineTestAsset(name: string): Promise<string> {
    const [normalStatus, availableStatus] = await Promise.all([
      prisma.assetStatus.findUniqueOrThrow({ where: { code: 'NORMAL' } }),
      prisma.availabilityStatus.findUniqueOrThrow({
        where: { code: 'AVAILABLE' },
      }),
    ]);
    const asset = await prisma.asset.create({
      data: {
        name,
        model: 'Deadline notification test model',
        price: 1,
        receivedDate: new Date('2026-01-01T00:00:00.000Z'),
        type_id: assetTypeId,
        section_id: testSectionId,
        company_id: companyId,
        asset_status_id: normalStatus.id,
        availability_status_id: availableStatus.id,
        owner_id: firstCenterUserId,
        createdBy: firstCenterUserId,
        updatedBy: firstCenterUserId,
      },
      select: { id: true },
    });
    borrowAssetIds.push(asset.id);
    return asset.id;
  }

  async function createRepairRequest(
    assetId: string,
    cookie: string,
  ): Promise<Record<string, unknown>> {
    const csrf = await getCsrfProof(cookie);
    const response = await request(server())
      .post('/repairs')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', csrf.cookie)
      .set('X-CSRF-Token', csrf.token)
      .send({
        assetId,
        symptom: 'Repair notification integration test',
        urgencyStatus: 'NORMAL',
        reportType: 'Repair',
      })
      .expect(201);
    const body = requireRecord(response.body, 'repair request');
    repairJobIds.push(requireString(body, 'id'));
    return body;
  }

  async function patchRepair(
    path: string,
    cookie: string,
    body: Record<string, unknown>,
    expectedStatus?: number,
  ): Promise<request.Response> {
    const csrf = await getCsrfProof(cookie);
    let test = request(server())
      .patch(path)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', csrf.cookie)
      .set('X-CSRF-Token', csrf.token)
      .send(body);
    if (expectedStatus !== undefined) test = test.expect(expectedStatus);
    return test;
  }

  beforeAll(async () => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);

    const pg = await import('pg');
    pool = new pg.Pool({ connectionString: testDatabaseUrl });
    prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    });
    await prisma.$connect();

    app = await createNotificationIntegrationApplication();

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
    const repairOtherSection = await prisma.section.create({
      data: {
        code: `NT-X-${randomUUID().slice(0, 7)}`,
        name: 'Other repair notification department',
      },
      select: { id: true },
    });
    repairOtherSectionId = repairOtherSection.id;

    const suffix = randomUUID();
    departmentEmail = `notification-dept-${suffix}@hams-test.local`;
    extensionRequesterEmail = `notify-ext-${suffix}@hams-test.local`;
    repairOtherDepartmentEmail = `notify-other-dept-${suffix}@hams-test.local`;
    repairMaintenanceEmail = `notify-mechanic-${suffix}@hams-test.local`;
    repairParcelEmail = `notify-parcel-${suffix}@hams-test.local`;
    firstCenterEmail = `notification-center-a-${suffix}@hams-test.local`;
    secondCenterEmail = `notification-center-b-${suffix}@hams-test.local`;
    departmentUserId = await createUser(
      departmentEmail,
      UserRole.DEPARTMENT_STAFF,
      departmentSectionId,
    );
    extensionRequesterUserId = await createUser(
      extensionRequesterEmail,
      UserRole.DEPARTMENT_STAFF,
      departmentSectionId,
    );
    await createUser(
      repairOtherDepartmentEmail,
      UserRole.DEPARTMENT_STAFF,
      repairOtherSectionId,
    );
    await createUser(
      repairMaintenanceEmail,
      UserRole.MAINTENANCE_HEAD,
      testSectionId,
    );
    repairParcelUserId = await createUser(
      repairParcelEmail,
      UserRole.PARCEL_STAFF,
      testSectionId,
    );
    repairParcelSecret = await enrollTwoFactor(
      repairParcelUserId,
      repairParcelEmail,
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
    firstCenterSecret = await enrollTwoFactor(
      firstCenterUserId,
      firstCenterEmail,
    );
    secondCenterSecret = await enrollTwoFactor(
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
      prisma.user.create({
        data: {
          id: randomUUID(),
          email: `notification-banned-parcel-${suffix}@hams-test.local`,
          emailVerified: true,
          firstname: 'Banned',
          lastname: 'Parcel',
          role: UserRole.PARCEL_STAFF,
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
          email: `notification-deleted-parcel-${suffix}@hams-test.local`,
          emailVerified: true,
          firstname: 'Deleted',
          lastname: 'Parcel',
          role: UserRole.PARCEL_STAFF,
          section_id: testSectionId,
          deletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        select: { id: true },
      }),
    ]);
    [
      bannedCenterUserId,
      deletedCenterUserId,
      parcelUserId,
      bannedParcelUserId,
      deletedParcelUserId,
    ] = inactiveAccounts.map(({ id }) => id);
    userIds.push(
      bannedCenterUserId,
      deletedCenterUserId,
      parcelUserId,
      bannedParcelUserId,
      deletedParcelUserId,
    );

    departmentCookie = await signInDepartment(departmentEmail);
    extensionRequesterCookie = await signInDepartment(extensionRequesterEmail);
    repairOtherDepartmentCookie = await signInDepartment(
      repairOtherDepartmentEmail,
    );
    repairMaintenanceCookie = await signInDepartment(repairMaintenanceEmail);
    repairParcelCookie = await signInCenter(
      repairParcelEmail,
      repairParcelSecret,
    );
    firstCenterCookie = await signInCenter(firstCenterEmail, firstCenterSecret);
    secondCenterCookie = await signInCenter(
      secondCenterEmail,
      secondCenterSecret,
    );
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
    parcelApprovalAssetId = (
      await prisma.asset.create({
        data: {
          name: 'Parcel approval notification test asset',
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
      if (repairJobIds.length > 0) {
        await prisma.notification.deleteMany({
          where: { resourceId: { in: repairJobIds } },
        });
        await prisma.sparepartTxn.deleteMany({
          where: { jobId: { in: repairJobIds } },
        });
        await prisma.mechanicRepair.deleteMany({
          where: { jobId: { in: repairJobIds } },
        });
        await prisma.repairJob.deleteMany({
          where: { id: { in: repairJobIds } },
        });
      }
      if (repairAssetIds.length > 0) {
        await prisma.asset.deleteMany({
          where: { id: { in: repairAssetIds } },
        });
      }
      if (repairSparepartId) {
        await prisma.sparepartTxn.deleteMany({
          where: { sparepartId: repairSparepartId },
        });
        await prisma.sparepart.deleteMany({
          where: { id: repairSparepartId },
        });
      }
      if (repairSparepartGroupId) {
        await prisma.sparepartGroup.deleteMany({
          where: { id: repairSparepartGroupId },
        });
      }
      if (borrowIds.length > 0) {
        await prisma.notification.deleteMany({
          where: { resourceId: { in: [...borrowIds, ...extensionIds] } },
        });
        await prisma.borrowTransaction.deleteMany({
          where: { id: { in: borrowIds } },
        });
      }
      if (borrowAssetIds.length > 0) {
        await prisma.asset.deleteMany({
          where: { id: { in: borrowAssetIds } },
        });
      }
      const fixtureAssetIds = [
        assetId,
        centerServiceAssetId,
        parcelApprovalAssetId,
      ].filter(Boolean);
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
      if (repairOtherSectionId) {
        await prisma.section.deleteMany({
          where: { id: repairOtherSectionId },
        });
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
    departmentBorrowId = createdBody.id;
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
    centerServiceBorrowId = centerServiceBody.id;
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
          createdAt: createdAt ?? new Date(),
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
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        const arrival = await createReadAllFixture('after-handler-cutoff');
        handlerCutoffFixtureId = arrival.id;
        const arrivalRow = await prisma.notification.findUnique({
          where: { id: arrival.id },
          select: { createdAt: true },
        });
        expect(arrivalRow?.createdAt.getTime()).toBeGreaterThan(
          cutoffAt.getTime(),
        );
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

  it('keeps an arrival after the read-all cutoff unread even when its source transaction started earlier', async () => {
    const existing = await prisma.notification.create({
      data: {
        userId: firstCenterUserId,
        type: NotificationType.BORROW_APPROVAL_REQUIRED,
        title: 'Existing read-all fixture',
        message: 'Read-state integration fixture',
        resourceType: NotificationResourceType.BORROW_TRANSACTION,
        resourceId: randomUUID(),
        eventKey: `read-all-existing:${randomUUID()}`,
      },
      select: { id: true },
    });
    const stream = await openStream(firstCenterCookie);
    expect((await stream.reader.next(5_000)).frame?.event).toBe(
      'notifications.sync_required',
    );
    const csrf = await getCsrfProof(firstCenterCookie);
    const notifications = app.get<NotificationsService>(NotificationsService);
    const sourceId = randomUUID();
    borrowIds.push(sourceId);
    let sourceStarted!: () => void;
    const sourceTransactionStarted = new Promise<void>((resolve) => {
      sourceStarted = resolve;
    });
    let permitInsertion!: () => void;
    const insertionGate = new Promise<void>((resolve) => {
      permitInsertion = resolve;
    });
    const sourceArrival = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT CURRENT_TIMESTAMP`;
        sourceStarted();
        await insertionGate;
        return notifications.createBorrowApprovalRequired(
          tx,
          { id: sourceId, borrowNo: 'Read-all concurrent source' },
          'Read-all test asset',
        );
      },
      { timeout: 10_000 },
    );
    try {
      await sourceTransactionStarted;
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      jest
        .spyOn(notifications, 'markAllReadForUser')
        .mockImplementationOnce(async (userId, cutoffAt) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
          permitInsertion();
          notifications.publishCommitted(await sourceArrival);
          jest.restoreAllMocks();
          return notifications.markAllReadForUser(userId, cutoffAt);
        });
      const response = await request(server())
        .patch('/notifications/read-all')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', csrf.cookie)
        .set('X-CSRF-Token', csrf.token)
        .send({})
        .expect(200);
      const readAll = requireRecord(response.body, 'read-all');
      expect(requireNumber(readAll, 'updatedCount')).toBeGreaterThanOrEqual(1);
      const arrival = (await sourceArrival).find(
        ({ userId }) => userId === firstCenterUserId,
      );
      if (!arrival) throw new Error('Concurrent notification was not created');
      const received = await waitForCreatedNotification(
        stream.reader,
        sourceId,
        NotificationType.BORROW_APPROVAL_REQUIRED,
      );
      expect(received.readAt).toBeNull();
      expect((await stream.reader.next(5_000)).frame?.event).toBe(
        'notifications.changed',
      );
      const history = parseNotificationListResponse(
        await request(server())
          .get('/notifications?limit=100')
          .set('Cookie', firstCenterCookie)
          .expect(200),
      );
      const byId = new Map(history.data.map((item) => [item.id, item]));
      expect(byId.get(existing.id)?.readAt).toBe(
        requireString(readAll, 'readAt'),
      );
      expect(byId.get(arrival.id)?.readAt).toBeNull();
    } finally {
      jest.restoreAllMocks();
      permitInsertion();
      await sourceArrival;
      stream.controller.abort();
    }
  });

  it('notifies only the department borrower after a committed approval', async () => {
    if (!departmentBorrowId)
      throw new Error('Department borrow fixture missing');
    await refreshTicket03Sessions();
    const borrow = await prisma.borrowTransaction.findUniqueOrThrow({
      where: { id: departmentBorrowId },
      select: {
        borrowNo: true,
        expectedReturnDate: true,
        request_source: true,
        borrower: { select: { role: true } },
        asset: { select: { name: true } },
        borrowStatus: { select: { code: true } },
      },
    });
    expect(borrow.request_source).toBe(RequestSource.SELF_SERVICE);
    expect(borrow.borrower.role).toBe(UserRole.DEPARTMENT_STAFF);
    expect(borrow.borrowStatus.code).toBe('PENDING_APPROVE');
    if (!borrow.expectedReturnDate)
      throw new Error('Department borrow return date fixture missing');

    const origin = 'http://localhost:5173';
    const centerCsrf = await getCsrfProof(firstCenterCookie);
    const borrowerStream = await openStream(departmentCookie);
    const firstCenterStream = await openStream(firstCenterCookie);
    const secondCenterStream = await openStream(secondCenterCookie);
    for (const stream of [
      borrowerStream,
      firstCenterStream,
      secondCenterStream,
    ]) {
      expect((await stream.reader.next(5_000)).frame?.event).toBe(
        'notifications.sync_required',
      );
    }

    try {
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION public.raise_borrow_approved_for_test()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $notification_test$
        BEGIN
          IF NEW.type = 'BORROW_APPROVED' THEN
            RAISE EXCEPTION 'borrow approval notification rollback test';
          END IF;
          RETURN NEW;
        END;
        $notification_test$
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER raise_borrow_approved_for_test
        AFTER INSERT ON public.notifications
        FOR EACH ROW
        EXECUTE FUNCTION public.raise_borrow_approved_for_test()
      `;

      await request(server())
        .patch(`/borrowings/${departmentBorrowId}/approve`)
        .set('Origin', origin)
        .set('Cookie', centerCsrf.cookie)
        .set('X-CSRF-Token', centerCsrf.token)
        .send({})
        .expect(500);
    } finally {
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS raise_borrow_approved_for_test
        ON public.notifications
      `;
      await prisma.$executeRaw`
        DROP FUNCTION IF EXISTS public.raise_borrow_approved_for_test()
      `;
    }

    const afterRollback = await prisma.borrowTransaction.findUniqueOrThrow({
      where: { id: departmentBorrowId },
      select: { borrowStatus: { select: { code: true } } },
    });
    expect(afterRollback.borrowStatus.code).toBe('PENDING_APPROVE');
    expect(
      await prisma.notification.count({
        where: {
          resourceId: departmentBorrowId,
          type: NotificationType.BORROW_APPROVED,
        },
      }),
    ).toBe(0);
    await expectNoEvent(borrowerStream.reader, 'notification.created', 250);

    const approved = await request(server())
      .patch(`/borrowings/${departmentBorrowId}/approve`)
      .set('Origin', origin)
      .set('Cookie', centerCsrf.cookie)
      .set('X-CSRF-Token', centerCsrf.token)
      .send({})
      .expect(200);
    expect(parseBorrowingResponse(approved).borrowStatus.code).toBe('APPROVED');
    const approvalEvent = await borrowerStream.reader.next(5_000);
    const approvalPayload = requireRecord(
      approvalEvent.frame?.data,
      'borrow approval SSE notification',
    );
    expect(approvalEvent.frame?.event).toBe('notification.created');
    expect(approvalPayload).toMatchObject({
      type: NotificationType.BORROW_APPROVED,
      resourceType: NotificationResourceType.BORROW_TRANSACTION,
      resourceId: departmentBorrowId,
    });
    expect(requireString(approvalPayload, 'message')).toContain(
      borrow.borrowNo,
    );
    expect(requireString(approvalPayload, 'message')).toContain(
      new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Bangkok',
      }).format(borrow.expectedReturnDate),
    );

    const approvedRows = await prisma.notification.findMany({
      where: {
        resourceId: departmentBorrowId,
        type: NotificationType.BORROW_APPROVED,
      },
      select: { userId: true, eventKey: true },
    });
    expect(approvedRows).toEqual([
      {
        userId: departmentUserId,
        eventKey: `${NotificationType.BORROW_APPROVED}:${departmentBorrowId}`,
      },
    ]);
    const borrowerList = await request(server())
      .get('/notifications')
      .set('Cookie', departmentCookie)
      .expect(200);
    expect(parseNotificationListResponse(borrowerList).data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: NotificationType.BORROW_APPROVED,
          resourceType: NotificationResourceType.BORROW_TRANSACTION,
          resourceId: departmentBorrowId,
        }),
      ]),
    );
    const borrowerUnreadCount = await request(server())
      .get('/notifications/unread-count')
      .set('Cookie', departmentCookie)
      .expect(200);
    expect(parseUnreadCountResponse(borrowerUnreadCount)).toEqual({ count: 1 });
    await expectNoEvent(firstCenterStream.reader, 'notification.created', 250);
    await expectNoEvent(secondCenterStream.reader, 'notification.created', 250);

    await request(server())
      .patch(`/borrowings/${departmentBorrowId}/approve`)
      .set('Origin', origin)
      .set('Cookie', centerCsrf.cookie)
      .set('X-CSRF-Token', centerCsrf.token)
      .send({})
      .expect(400);
    expect(
      await prisma.notification.count({
        where: {
          resourceId: departmentBorrowId,
          type: NotificationType.BORROW_APPROVED,
        },
      }),
    ).toBe(1);
    await expectNoEvent(borrowerStream.reader, 'notification.created', 250);

    const pendingStatus = await prisma.borrowStatus.findUniqueOrThrow({
      where: { code: 'PENDING_APPROVE' },
      select: { id: true },
    });
    const parcelBorrow = await prisma.borrowTransaction.create({
      data: {
        borrowNo: `NT-${randomUUID()}`,
        asset_id: parcelApprovalAssetId,
        borrower_id: parcelUserId,
        created_by_user_id: parcelUserId,
        borrow_status_id: pendingStatus.id,
        request_source: RequestSource.SELF_SERVICE,
      },
      select: { id: true },
    });
    borrowIds.push(parcelBorrow.id);
    const parcelApproval = await request(server())
      .patch(`/borrowings/${parcelBorrow.id}/approve`)
      .set('Origin', origin)
      .set('Cookie', centerCsrf.cookie)
      .set('X-CSRF-Token', centerCsrf.token)
      .send({})
      .expect(200);
    expect(parseBorrowingResponse(parcelApproval).borrowStatus.code).toBe(
      'APPROVED',
    );
    expect(
      await prisma.notification.count({
        where: {
          resourceId: parcelBorrow.id,
          type: NotificationType.BORROW_APPROVED,
        },
      }),
    ).toBe(0);
    expect(centerServiceBorrowId).toBeTruthy();
    expect(
      await prisma.notification.count({
        where: {
          resourceId: centerServiceBorrowId,
          type: NotificationType.BORROW_APPROVED,
        },
      }),
    ).toBe(0);
    await expectNoEvent(firstCenterStream.reader, 'notification.created', 250);
    await expectNoEvent(secondCenterStream.reader, 'notification.created', 250);
  });

  it('notifies asset center for online extensions and only the requester about decisions', async () => {
    if (!centerServiceBorrowId) {
      throw new Error('Center-service borrow fixture missing');
    }
    const origin = 'http://localhost:5173';
    const centerCsrf = await getCsrfProof(firstCenterCookie);
    const requesterCsrf = await getCsrfProof(extensionRequesterCookie);
    const centerStreams = [
      await openStream(firstCenterCookie),
      await openStream(secondCenterCookie),
    ];
    const borrowerStream = await openStream(departmentCookie);
    const requesterStream = await openStream(extensionRequesterCookie);
    for (const stream of [...centerStreams, borrowerStream, requesterStream]) {
      expect((await stream.reader.next(5_000)).frame?.event).toBe(
        'notifications.sync_required',
      );
    }

    const centerBorrow = await prisma.borrowTransaction.findUniqueOrThrow({
      where: { id: centerServiceBorrowId },
      select: {
        borrowNo: true,
        borrower_id: true,
        expectedReturnDate: true,
        borrowStatus: { select: { code: true } },
      },
    });
    expect(centerBorrow.borrowStatus.code).toBe('BORROWED');
    expect(centerBorrow.borrower_id).toBe(departmentUserId);
    expect(centerBorrow.expectedReturnDate).toBeInstanceOf(Date);
    expect(extensionRequesterUserId).not.toBe(centerBorrow.borrower_id);

    const deskReturnDate = new Date(
      centerBorrow.expectedReturnDate!.getTime() + 24 * 60 * 60 * 1000,
    );
    const deskResponse = await request(server())
      .post(`/borrowings/${centerServiceBorrowId}/extensions`)
      .set('Origin', origin)
      .set('Cookie', centerCsrf.cookie)
      .set('X-CSRF-Token', centerCsrf.token)
      .send({
        requestedReturnDate: deskReturnDate.toISOString(),
        reason: 'Desk extension should not notify',
      })
      .expect(201);
    const deskBody = requireRecord(deskResponse.body, 'desk extension');
    const deskExtensionId = requireString(deskBody, 'id');
    extensionIds.push(deskExtensionId);
    expect(deskBody).toMatchObject({
      extensionType: 'DESK',
      status: 'APPROVED',
    });
    expect(
      await prisma.notification.count({
        where: { resourceId: deskExtensionId },
      }),
    ).toBe(0);
    for (const stream of [...centerStreams, borrowerStream, requesterStream]) {
      await expectNoEvent(stream.reader, 'notification.created', 150);
    }

    const firstRequestedReturnDate = new Date(
      deskReturnDate.getTime() + 24 * 60 * 60 * 1000,
    );
    const eligibleCenterUsers = await prisma.user.findMany({
      where: {
        role: UserRole.ASSET_CENTER_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    const eligibleCenterIds = eligibleCenterUsers.map(({ id }) => id);
    const approvalRequiredCountBefore = await prisma.notification.count({
      where: {
        userId: { in: eligibleCenterIds },
        type: NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
      },
    });
    try {
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION public.raise_borrow_extension_pending_for_test()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $notification_test$
        BEGIN
          IF NEW.type = 'BORROW_EXTENSION_APPROVAL_REQUIRED' THEN
            RAISE EXCEPTION 'borrow extension notification rollback test';
          END IF;
          RETURN NEW;
        END;
        $notification_test$
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER raise_borrow_extension_pending_for_test
        AFTER INSERT ON public.notifications
        FOR EACH ROW
        EXECUTE FUNCTION public.raise_borrow_extension_pending_for_test()
      `;

      await request(server())
        .post(`/borrowings/${centerServiceBorrowId}/extensions`)
        .set('Origin', origin)
        .set('Cookie', requesterCsrf.cookie)
        .set('X-CSRF-Token', requesterCsrf.token)
        .send({
          requestedReturnDate: firstRequestedReturnDate.toISOString(),
          reason: 'ขอต่ออายุออนไลน์รอบแรก',
        })
        .expect(500);
    } finally {
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS raise_borrow_extension_pending_for_test
        ON public.notifications
      `;
      await prisma.$executeRaw`
        DROP FUNCTION IF EXISTS public.raise_borrow_extension_pending_for_test()
      `;
    }
    expect(
      await prisma.borrowExtension.count({
        where: {
          borrowTransactionId: centerServiceBorrowId,
          status: 'PENDING',
          extensionType: 'ONLINE',
        },
      }),
    ).toBe(0);
    expect(
      await prisma.notification.count({
        where: {
          userId: { in: eligibleCenterIds },
          type: NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
        },
      }),
    ).toBe(approvalRequiredCountBefore);
    for (const stream of [...centerStreams, borrowerStream, requesterStream]) {
      await expectNoEvent(stream.reader, 'notification.created', 250);
    }

    const onlineResponse = await request(server())
      .post(`/borrowings/${centerServiceBorrowId}/extensions`)
      .set('Origin', origin)
      .set('Cookie', requesterCsrf.cookie)
      .set('X-CSRF-Token', requesterCsrf.token)
      .send({
        requestedReturnDate: firstRequestedReturnDate.toISOString(),
        reason: 'ขอต่ออายุออนไลน์รอบแรก',
      })
      .expect(201);
    const onlineBody = requireRecord(onlineResponse.body, 'online extension');
    const onlineExtensionId = requireString(onlineBody, 'id');
    extensionIds.push(onlineExtensionId);
    expect(onlineBody).toMatchObject({
      extensionType: 'ONLINE',
      status: 'PENDING',
      requestedByUserId: extensionRequesterUserId,
    });
    const expectedDateText = new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Bangkok',
    }).format(firstRequestedReturnDate);
    for (const stream of centerStreams) {
      const event = await stream.reader.next(5_000);
      const payload = requireRecord(event.frame?.data, 'extension request SSE');
      expect(event.frame?.event).toBe('notification.created');
      expect(payload).toMatchObject({
        type: NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
        resourceType: NotificationResourceType.BORROW_EXTENSION,
        resourceId: onlineExtensionId,
      });
      expect(requireString(payload, 'message')).toContain(
        centerBorrow.borrowNo,
      );
      expect(requireString(payload, 'message')).toContain(expectedDateText);
    }
    await expectNoEvent(borrowerStream.reader, 'notification.created', 250);
    await expectNoEvent(requesterStream.reader, 'notification.created', 250);

    const pendingRows = await prisma.notification.findMany({
      where: {
        resourceId: onlineExtensionId,
        type: NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
      },
      select: { userId: true, eventKey: true },
    });
    expect(pendingRows.map(({ userId }) => userId).sort()).toEqual(
      eligibleCenterUsers.map(({ id }) => id).sort(),
    );
    expect(
      pendingRows.every(
        ({ eventKey }) =>
          eventKey ===
          `${NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED}:${onlineExtensionId}`,
      ),
    ).toBe(true);
    expect(pendingRows.map(({ userId }) => userId)).not.toContain(parcelUserId);
    const centerList = await request(server())
      .get('/notifications')
      .set('Cookie', firstCenterCookie)
      .expect(200);
    expect(parseNotificationListResponse(centerList).data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
          resourceType: NotificationResourceType.BORROW_EXTENSION,
          resourceId: onlineExtensionId,
        }),
      ]),
    );
    const afterPending = await prisma.borrowTransaction.findUniqueOrThrow({
      where: { id: centerServiceBorrowId },
      select: { expectedReturnDate: true },
    });
    expect(afterPending.expectedReturnDate).toEqual(deskReturnDate);

    try {
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION public.raise_borrow_extension_approved_for_test()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $notification_test$
        BEGIN
          IF NEW.type = 'BORROW_EXTENSION_APPROVED' THEN
            RAISE EXCEPTION 'borrow extension decision rollback test';
          END IF;
          RETURN NEW;
        END;
        $notification_test$
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER raise_borrow_extension_approved_for_test
        AFTER INSERT ON public.notifications
        FOR EACH ROW
        EXECUTE FUNCTION public.raise_borrow_extension_approved_for_test()
      `;

      await request(server())
        .patch(`/borrowings/extensions/${onlineExtensionId}/review`)
        .set('Origin', origin)
        .set('Cookie', centerCsrf.cookie)
        .set('X-CSRF-Token', centerCsrf.token)
        .send({ status: 'APPROVED' })
        .expect(500);
    } finally {
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS raise_borrow_extension_approved_for_test
        ON public.notifications
      `;
      await prisma.$executeRaw`
        DROP FUNCTION IF EXISTS public.raise_borrow_extension_approved_for_test()
      `;
    }
    const extensionAfterRollback =
      await prisma.borrowExtension.findUniqueOrThrow({
        where: { id: onlineExtensionId },
        select: { status: true },
      });
    expect(extensionAfterRollback.status).toBe('PENDING');
    expect(
      await prisma.notification.count({
        where: {
          resourceId: onlineExtensionId,
          type: NotificationType.BORROW_EXTENSION_APPROVED,
        },
      }),
    ).toBe(0);
    const borrowAfterDecisionRollback =
      await prisma.borrowTransaction.findUniqueOrThrow({
        where: { id: centerServiceBorrowId },
        select: { expectedReturnDate: true },
      });
    expect(borrowAfterDecisionRollback.expectedReturnDate).toEqual(
      deskReturnDate,
    );
    await expectNoEvent(requesterStream.reader, 'notification.created', 250);

    await request(server())
      .patch(`/borrowings/extensions/${onlineExtensionId}/review`)
      .set('Origin', origin)
      .set('Cookie', centerCsrf.cookie)
      .set('X-CSRF-Token', centerCsrf.token)
      .send({ status: 'APPROVED' })
      .expect(200);
    const approvalEvent = await requesterStream.reader.next(5_000);
    const approvalPayload = requireRecord(
      approvalEvent.frame?.data,
      'extension approval SSE notification',
    );
    expect(approvalEvent.frame?.event).toBe('notification.created');
    expect(approvalPayload).toMatchObject({
      type: NotificationType.BORROW_EXTENSION_APPROVED,
      resourceType: NotificationResourceType.BORROW_EXTENSION,
      resourceId: onlineExtensionId,
    });
    expect(requireString(approvalPayload, 'message')).toContain(
      expectedDateText,
    );
    const approvedRows = await prisma.notification.findMany({
      where: {
        resourceId: onlineExtensionId,
        type: NotificationType.BORROW_EXTENSION_APPROVED,
      },
      select: { userId: true },
    });
    expect(approvedRows).toEqual([{ userId: extensionRequesterUserId }]);
    expect(
      await prisma.notification.count({
        where: {
          resourceId: onlineExtensionId,
          userId: departmentUserId,
          type: {
            in: [
              NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
              NotificationType.BORROW_EXTENSION_APPROVED,
            ],
          },
        },
      }),
    ).toBe(0);
    const afterApproval = await prisma.borrowTransaction.findUniqueOrThrow({
      where: { id: centerServiceBorrowId },
      select: { expectedReturnDate: true },
    });
    expect(afterApproval.expectedReturnDate).toEqual(firstRequestedReturnDate);
    await expectNoEvent(borrowerStream.reader, 'notification.created', 250);
    for (const stream of centerStreams) {
      await expectNoEvent(stream.reader, 'notification.created', 250);
    }

    await request(server())
      .patch(`/borrowings/extensions/${onlineExtensionId}/review`)
      .set('Origin', origin)
      .set('Cookie', centerCsrf.cookie)
      .set('X-CSRF-Token', centerCsrf.token)
      .send({ status: 'APPROVED' })
      .expect(400);
    expect(
      await prisma.notification.count({
        where: {
          resourceId: onlineExtensionId,
          type: NotificationType.BORROW_EXTENSION_APPROVED,
        },
      }),
    ).toBe(1);
    await expectNoEvent(requesterStream.reader, 'notification.created', 250);

    const secondRequestedReturnDate = new Date(
      firstRequestedReturnDate.getTime() + 24 * 60 * 60 * 1000,
    );
    const secondOnlineResponse = await request(server())
      .post(`/borrowings/${centerServiceBorrowId}/extensions`)
      .set('Origin', origin)
      .set('Cookie', requesterCsrf.cookie)
      .set('X-CSRF-Token', requesterCsrf.token)
      .send({
        requestedReturnDate: secondRequestedReturnDate.toISOString(),
        reason: 'ขอต่ออายุออนไลน์รอบสอง',
      })
      .expect(201);
    const secondOnlineBody = requireRecord(
      secondOnlineResponse.body,
      'second online extension',
    );
    const rejectedExtensionId = requireString(secondOnlineBody, 'id');
    extensionIds.push(rejectedExtensionId);
    expect(secondOnlineBody).toMatchObject({
      extensionType: 'ONLINE',
      status: 'PENDING',
    });
    for (const stream of centerStreams) {
      const event = await stream.reader.next(5_000);
      expect(event.frame).toMatchObject({
        event: 'notification.created',
        data: {
          type: NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
          resourceType: NotificationResourceType.BORROW_EXTENSION,
          resourceId: rejectedExtensionId,
        },
      });
    }

    try {
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION public.raise_borrow_extension_rejected_for_test()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $notification_test$
        BEGIN
          IF NEW.type = 'BORROW_EXTENSION_REJECTED' THEN
            RAISE EXCEPTION 'borrow extension rejection rollback test';
          END IF;
          RETURN NEW;
        END;
        $notification_test$
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER raise_borrow_extension_rejected_for_test
        AFTER INSERT ON public.notifications
        FOR EACH ROW
        EXECUTE FUNCTION public.raise_borrow_extension_rejected_for_test()
      `;

      await request(server())
        .patch(`/borrowings/extensions/${rejectedExtensionId}/review`)
        .set('Origin', origin)
        .set('Cookie', centerCsrf.cookie)
        .set('X-CSRF-Token', centerCsrf.token)
        .send({ status: 'REJECTED', rejectReason: 'ไม่สามารถต่อกำหนดคืนได้' })
        .expect(500);
    } finally {
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS raise_borrow_extension_rejected_for_test
        ON public.notifications
      `;
      await prisma.$executeRaw`
        DROP FUNCTION IF EXISTS public.raise_borrow_extension_rejected_for_test()
      `;
    }
    const extensionAfterRejectionRollback =
      await prisma.borrowExtension.findUniqueOrThrow({
        where: { id: rejectedExtensionId },
        select: { status: true, rejectReason: true },
      });
    expect(extensionAfterRejectionRollback).toEqual({
      status: 'PENDING',
      rejectReason: null,
    });
    expect(
      await prisma.notification.count({
        where: {
          resourceId: rejectedExtensionId,
          type: NotificationType.BORROW_EXTENSION_REJECTED,
        },
      }),
    ).toBe(0);
    await expectNoEvent(requesterStream.reader, 'notification.created', 250);

    requesterStream.controller.abort();
    await request(server())
      .patch(`/borrowings/extensions/${rejectedExtensionId}/review`)
      .set('Origin', origin)
      .set('Cookie', centerCsrf.cookie)
      .set('X-CSRF-Token', centerCsrf.token)
      .send({ status: 'REJECTED', rejectReason: 'ไม่สามารถต่อกำหนดคืนได้' })
      .expect(200);
    const rejectedRows = await prisma.notification.findMany({
      where: {
        resourceId: rejectedExtensionId,
        type: NotificationType.BORROW_EXTENSION_REJECTED,
      },
      select: { userId: true },
    });
    expect(rejectedRows).toEqual([{ userId: extensionRequesterUserId }]);
    const requesterList = await request(server())
      .get('/notifications')
      .set('Cookie', extensionRequesterCookie)
      .expect(200);
    expect(parseNotificationListResponse(requesterList).data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: NotificationType.BORROW_EXTENSION_APPROVED,
          resourceType: NotificationResourceType.BORROW_EXTENSION,
          resourceId: onlineExtensionId,
        }),
        expect.objectContaining({
          type: NotificationType.BORROW_EXTENSION_REJECTED,
          resourceType: NotificationResourceType.BORROW_EXTENSION,
          resourceId: rejectedExtensionId,
        }),
      ]),
    );
    const requesterUnreadCount = await request(server())
      .get('/notifications/unread-count')
      .set('Cookie', extensionRequesterCookie)
      .expect(200);
    expect(parseUnreadCountResponse(requesterUnreadCount)).toEqual({
      count: 2,
    });
    const rejectedRow = await prisma.notification.findFirstOrThrow({
      where: {
        resourceId: rejectedExtensionId,
        userId: extensionRequesterUserId,
        type: NotificationType.BORROW_EXTENSION_REJECTED,
      },
      select: { message: true },
    });
    expect(rejectedRow.message).toContain('ไม่สามารถต่อกำหนดคืนได้');
    expect(
      await prisma.notification.count({
        where: {
          resourceId: rejectedExtensionId,
          userId: departmentUserId,
          type: {
            in: [
              NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
              NotificationType.BORROW_EXTENSION_REJECTED,
            ],
          },
        },
      }),
    ).toBe(0);
    const afterRejection = await prisma.borrowTransaction.findUniqueOrThrow({
      where: { id: centerServiceBorrowId },
      select: { expectedReturnDate: true },
    });
    expect(afterRejection.expectedReturnDate).toEqual(firstRequestedReturnDate);
    await expectNoEvent(borrowerStream.reader, 'notification.created', 250);
    for (const stream of centerStreams) {
      await expectNoEvent(stream.reader, 'notification.created', 250);
    }
  });

  it('notifies parcel staff only when a repair reaches a parcel approval step', async () => {
    const parcelStream = await openStream(repairParcelCookie);
    const departmentStream = await openStream(departmentCookie);
    const centerStream = await openStream(firstCenterCookie);
    for (const stream of [parcelStream, departmentStream, centerStream]) {
      expect((await stream.reader.next(5_000)).frame?.event).toBe(
        'notifications.sync_required',
      );
    }

    const cause = await prisma.cause.findFirst({
      where: { deleteAt: null },
      select: { id: true },
    });
    const techCategory = await prisma.techCategory.findFirst({
      where: { isActive: true, deleteAt: null },
      select: { id: true },
    });
    const jobType = await prisma.jobType.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (!cause || !techCategory || !jobType) {
      throw new Error('Repair reference data is required for this test');
    }

    const group = await prisma.sparepartGroup.create({
      data: { name: `Repair notification ${randomUUID()}` },
      select: { id: true },
    });
    repairSparepartGroupId = group.id;
    const sparepart = await prisma.sparepart.create({
      data: {
        code: `NT-RP-${randomUUID().slice(0, 8)}`,
        name: 'Repair notification test part',
        price: 1,
        qtyInStock: 5,
        groupId: group.id,
      },
      select: { id: true },
    });
    repairSparepartId = sparepart.id;

    const diagnose = async (
      repairJobId: string,
      stepActionType:
        | 'WITH_PARTS'
        | 'OUTSOURCE'
        | 'SELF_REPAIR'
        | 'UNREPAIRABLE',
      extra: Record<string, unknown> = {},
    ) => {
      const response = await patchRepair(
        `/repairs/${repairJobId}/diagnose`,
        repairMaintenanceCookie,
        {
          diagnosis: 'Integration test diagnosis',
          solution: 'Integration test plan',
          causeId: cause.id,
          techCategoryId: techCategory.id,
          jobTypeId: jobType.id,
          actionType: 'REPAIR',
          stepActionType,
          ...extra,
        },
        200,
      );
      return response;
    };

    const assertParcelNotification = async (repairJobId: string) => {
      let event = await parcelStream.reader.next(5_000);
      while (event.frame?.event === 'heartbeat') {
        event = await parcelStream.reader.next(5_000);
      }
      expect(event.frame?.event).toBe('notification.created');
      expect(event.frame?.data).toMatchObject({
        type: NotificationType.REPAIR_APPROVAL_REQUIRED,
        resourceType: NotificationResourceType.REPAIR_JOB,
        resourceId: repairJobId,
        readAt: null,
      });
    };

    const internalAssetId = await createRepairTestAsset(
      departmentSectionId,
      departmentUserId,
      'Repair parts internal notification asset',
    );
    const internalRequest = await createRepairRequest(
      internalAssetId,
      departmentCookie,
    );
    const internalJobId = requireString(internalRequest, 'id');
    await diagnose(internalJobId, 'WITH_PARTS', {
      spareParts: [
        { sparepartId: sparepart.id, qty: 1, stockType: 'INTERNAL' },
      ],
    });
    expect(
      (
        await prisma.repairJob.findUniqueOrThrow({
          where: { id: internalJobId },
          select: { jobStatus: { select: { code: true } } },
        })
      ).jobStatus.code,
    ).toBe('PARCEL_PROCESSING');
    await assertParcelNotification(internalJobId);

    await prisma.sparepart.update({
      where: { id: sparepart.id },
      data: { qtyInStock: 0 },
    });
    const externalAssetId = await createRepairTestAsset(
      departmentSectionId,
      departmentUserId,
      'Repair parts external notification asset',
    );
    const externalRequest = await createRepairRequest(
      externalAssetId,
      departmentCookie,
    );
    const externalJobId = requireString(externalRequest, 'id');
    await diagnose(externalJobId, 'WITH_PARTS', {
      spareParts: [
        { sparepartId: sparepart.id, qty: 1, stockType: 'EXTERNAL' },
      ],
    });
    expect(
      (
        await prisma.repairJob.findUniqueOrThrow({
          where: { id: externalJobId },
          select: { jobStatus: { select: { code: true } } },
        })
      ).jobStatus.code,
    ).toBe('WAITING_PARTS');
    await assertParcelNotification(externalJobId);

    const outsourceAssetId = await createRepairTestAsset(
      departmentSectionId,
      departmentUserId,
      'Repair outsource notification asset',
    );
    const outsourceRequest = await createRepairRequest(
      outsourceAssetId,
      departmentCookie,
    );
    const outsourceJobId = requireString(outsourceRequest, 'id');
    await diagnose(outsourceJobId, 'OUTSOURCE');
    await assertParcelNotification(outsourceJobId);
    await expectNoEvent(parcelStream.reader, 'notification.created', 250);
    const originalApprovalStep = await prisma.repairJobStep.findFirstOrThrow({
      where: {
        jobId: outsourceJobId,
        stepMaster: { actionType: 'OUTSOURCE', stepNumber: 5 },
      },
      select: { id: true },
    });
    const firstOutsourceNotificationList = await request(server())
      .get('/notifications?limit=100')
      .set('Cookie', repairParcelCookie)
      .expect(200);
    expect(
      parseNotificationListResponse(firstOutsourceNotificationList).data.filter(
        ({ type, resourceId }) =>
          type === NotificationType.REPAIR_APPROVAL_REQUIRED &&
          resourceId === outsourceJobId,
      ),
    ).toHaveLength(1);

    await patchRepair(
      `/repairs/${outsourceJobId}/steps/reject`,
      repairParcelCookie,
      { reason: 'Reassess vendor plan' },
      200,
    );
    await diagnose(outsourceJobId, 'OUTSOURCE');
    await assertParcelNotification(outsourceJobId);

    const approvalRows = await prisma.notification.findMany({
      where: {
        resourceId: { in: [internalJobId, externalJobId, outsourceJobId] },
        type: NotificationType.REPAIR_APPROVAL_REQUIRED,
      },
      orderBy: [{ resourceId: 'asc' }, { eventKey: 'asc' }, { userId: 'asc' }],
      select: { resourceId: true, userId: true, eventKey: true },
    });
    const expectedParcelRecipients = await prisma.user.findMany({
      where: {
        role: UserRole.PARCEL_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    const recipientIds = expectedParcelRecipients.map(({ id }) => id);
    for (const repairJobId of [internalJobId, externalJobId, outsourceJobId]) {
      const rows = approvalRows.filter((row) => row.resourceId === repairJobId);
      const usersByEvent = new Map<string, string[]>();
      for (const row of rows) {
        const eventRecipients = usersByEvent.get(row.eventKey) ?? [];
        eventRecipients.push(row.userId);
        usersByEvent.set(row.eventKey, eventRecipients);
      }
      expect(usersByEvent.size).toBe(repairJobId === outsourceJobId ? 2 : 1);
      for (const eventRecipients of usersByEvent.values()) {
        expect(eventRecipients).toHaveLength(recipientIds.length);
        expect(new Set(eventRecipients)).toEqual(new Set(recipientIds));
      }
    }
    const outsourceKeys = approvalRows
      .filter((row) => row.resourceId === outsourceJobId)
      .map(({ eventKey }) => eventKey);
    expect(outsourceKeys).toEqual(
      expect.arrayContaining([
        `${NotificationType.REPAIR_APPROVAL_REQUIRED}:${originalApprovalStep.id}`,
      ]),
    );
    expect(new Set(outsourceKeys).size).toBe(2);
    expect(approvalRows.map(({ userId }) => userId)).not.toContain(
      bannedParcelUserId,
    );
    expect(approvalRows.map(({ userId }) => userId)).not.toContain(
      deletedParcelUserId,
    );
    await expectNoEvent(departmentStream.reader, 'notification.created', 250);
    await expectNoEvent(centerStream.reader, 'notification.created', 250);

    const invalidAssetId = await createRepairTestAsset(
      departmentSectionId,
      departmentUserId,
      'Invalid repair diagnosis notification asset',
    );
    const invalidRequest = await createRepairRequest(
      invalidAssetId,
      departmentCookie,
    );
    const invalidJobId = requireString(invalidRequest, 'id');
    await patchRepair(
      `/repairs/${invalidJobId}/diagnose`,
      repairMaintenanceCookie,
      {
        diagnosis: 'Invalid parts request',
        solution: 'No parts supplied',
        causeId: cause.id,
        techCategoryId: techCategory.id,
        jobTypeId: jobType.id,
        actionType: 'REPAIR',
        stepActionType: 'WITH_PARTS',
        spareParts: [],
      },
      400,
    );
    expect(
      await prisma.notification.count({ where: { resourceId: invalidJobId } }),
    ).toBe(0);
    expect(
      await prisma.repairJobStep.count({ where: { jobId: invalidJobId } }),
    ).toBe(0);
    await expectNoEvent(parcelStream.reader, 'notification.created', 250);
  });

  it('notifies owning sections about repair collection and confirmed unrepairable custody', async () => {
    const departmentStream = await openStream(departmentCookie);
    const departmentMemberStream = await openStream(extensionRequesterCookie);
    const otherDepartmentStream = await openStream(repairOtherDepartmentCookie);
    const firstCenterStream = await openStream(firstCenterCookie);
    const secondCenterStream = await openStream(secondCenterCookie);
    const parcelStream = await openStream(repairParcelCookie);
    const streams = [
      departmentStream,
      departmentMemberStream,
      otherDepartmentStream,
      firstCenterStream,
      secondCenterStream,
      parcelStream,
    ];
    for (const stream of streams) {
      expect((await stream.reader.next(5_000)).frame?.event).toBe(
        'notifications.sync_required',
      );
    }
    const expectReadyEvent = async (
      stream: { reader: SseEventReader },
      repairJobId: string,
    ) => {
      let event = await stream.reader.next(5_000);
      while (event.frame?.event === 'heartbeat') {
        event = await stream.reader.next(5_000);
      }
      expect(event.frame).toMatchObject({
        event: 'notification.created',
        data: {
          type: NotificationType.REPAIR_READY_FOR_COLLECTION,
          resourceType: NotificationResourceType.REPAIR_JOB,
          resourceId: repairJobId,
        },
      });
    };

    const cause = await prisma.cause.findFirst({
      where: { deleteAt: null },
      select: { id: true },
    });
    const techCategory = await prisma.techCategory.findFirst({
      where: { isActive: true, deleteAt: null },
      select: { id: true },
    });
    const jobType = await prisma.jobType.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (!cause || !techCategory || !jobType) {
      throw new Error('Repair reference data is required for this test');
    }
    const diagnose = async (
      repairJobId: string,
      stepActionType: 'SELF_REPAIR' | 'UNREPAIRABLE',
      extra: Record<string, unknown> = {},
    ) => {
      await patchRepair(
        `/repairs/${repairJobId}/diagnose`,
        repairMaintenanceCookie,
        {
          diagnosis: 'Integration test diagnosis',
          solution: 'Integration test plan',
          causeId: cause.id,
          techCategoryId: techCategory.id,
          jobTypeId: jobType.id,
          actionType: 'REPAIR',
          stepActionType,
          ...extra,
        },
        200,
      );
    };
    const stepForward = async (
      repairJobId: string,
      body: Record<string, unknown> = {},
      expectedStatus = 200,
    ) =>
      patchRepair(
        `/repairs/${repairJobId}/steps/next`,
        repairMaintenanceCookie,
        body,
        expectedStatus,
      );

    const departmentAssetId = await createRepairTestAsset(
      departmentSectionId,
      departmentUserId,
      'Department ready for collection test asset',
    );
    const departmentRequest = await createRepairRequest(
      departmentAssetId,
      departmentCookie,
    );
    const departmentJobId = requireString(departmentRequest, 'id');
    await diagnose(departmentJobId, 'SELF_REPAIR');
    const readyRecipients = await prisma.user.findMany({
      where: {
        section_id: departmentSectionId,
        role: { in: [UserRole.DEPARTMENT_STAFF, UserRole.ASSET_CENTER_STAFF] },
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    expect(readyRecipients.map(({ id }) => id)).toEqual(
      expect.arrayContaining([departmentUserId, extensionRequesterUserId]),
    );
    const selfRepairSteps = await prisma.repairJobStep.findMany({
      where: { jobId: departmentJobId },
      orderBy: { stepMaster: { stepNumber: 'asc' } },
      select: {
        completeAt: true,
        stepMaster: { select: { stepNumber: true } },
      },
    });
    expect(
      selfRepairSteps.map(({ stepMaster }) => stepMaster.stepNumber),
    ).toEqual(expect.arrayContaining([4]));
    await stepForward(departmentJobId, { warrantyDate: '2026-12-31' }, 400);
    expect(
      await prisma.notification.count({
        where: { resourceId: departmentJobId },
      }),
    ).toBe(0);
    await stepForward(departmentJobId);

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.raise_repair_ready_notification_for_test()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.type::text = 'REPAIR_READY_FOR_COLLECTION' THEN
          RAISE EXCEPTION 'repair ready notification rollback test';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER raise_repair_ready_notification_for_test
      BEFORE INSERT ON public.notifications
      FOR EACH ROW EXECUTE FUNCTION public.raise_repair_ready_notification_for_test()
    `);
    try {
      await stepForward(departmentJobId, {}, 500);
    } finally {
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS raise_repair_ready_notification_for_test
        ON public.notifications
      `);
      await prisma.$executeRawUnsafe(`
        DROP FUNCTION IF EXISTS public.raise_repair_ready_notification_for_test()
      `);
    }
    const rolledBackDepartmentJob = await prisma.repairJob.findUniqueOrThrow({
      where: { id: departmentJobId },
      select: {
        jobStatus: { select: { code: true } },
        repairJobSteps: {
          where: { stepMaster: { stepNumber: 5 } },
          select: { completeAt: true },
        },
      },
    });
    expect(rolledBackDepartmentJob.jobStatus.code).toBe('IN_PROGRESS');
    expect(rolledBackDepartmentJob.repairJobSteps[0]?.completeAt).toBeNull();
    expect(
      await prisma.notification.count({
        where: { resourceId: departmentJobId },
      }),
    ).toBe(0);
    await expectNoEvent(departmentStream.reader, 'notification.created', 250);

    const pendingCollectionStep = await prisma.repairJobStep.findFirstOrThrow({
      where: {
        jobId: departmentJobId,
        completeAt: null,
        stepMaster: { stepNumber: 5 },
      },
      select: { id: true },
    });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.pause_repair_update_for_duplicate_test()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_sleep(0.75);
        RETURN NEW;
      END;
      $$
    `);
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER pause_repair_update_for_duplicate_test
        BEFORE UPDATE ON public.repair_job
        FOR EACH ROW EXECUTE FUNCTION public.pause_repair_update_for_duplicate_test()
      `);
      const concurrentStepCsrf = await getCsrfProof(repairMaintenanceCookie);
      const concurrentStepCompletions = await Promise.all(
        [0, 1].map(() =>
          request(server())
            .patch(`/repairs/${departmentJobId}/steps/next`)
            .set('Origin', 'http://localhost:5173')
            .set('Cookie', concurrentStepCsrf.cookie)
            .set('X-CSRF-Token', concurrentStepCsrf.token)
            .send({}),
        ),
      );
      expect(concurrentStepCompletions.map(({ status }) => status)).toEqual([
        200, 200,
      ]);
    } finally {
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS pause_repair_update_for_duplicate_test
        ON public.repair_job
      `);
      await prisma.$executeRawUnsafe(`
        DROP FUNCTION IF EXISTS public.pause_repair_update_for_duplicate_test()
      `);
    }
    const departmentStatus = await prisma.repairJob.findUniqueOrThrow({
      where: { id: departmentJobId },
      select: { jobStatus: { select: { code: true } } },
    });
    expect(departmentStatus.jobStatus.code).toBe('WAITING_DELIVERY');
    const departmentRows = await prisma.notification.findMany({
      where: {
        resourceId: departmentJobId,
        type: NotificationType.REPAIR_READY_FOR_COLLECTION,
      },
      orderBy: { userId: 'asc' },
      select: { userId: true, eventKey: true },
    });
    const expectedDepartmentRecipients = await prisma.user.findMany({
      where: {
        section_id: departmentSectionId,
        role: UserRole.DEPARTMENT_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    expect(departmentRows.map(({ userId }) => userId)).toEqual(
      expectedDepartmentRecipients.map(({ id }) => id),
    );
    expect(departmentRows).toHaveLength(expectedDepartmentRecipients.length);
    expect(new Set(departmentRows.map(({ eventKey }) => eventKey))).toEqual(
      new Set([
        `${NotificationType.REPAIR_READY_FOR_COLLECTION}:${pendingCollectionStep.id}`,
      ]),
    );
    const departmentNotificationList = await request(server())
      .get('/notifications?limit=100')
      .set('Cookie', departmentCookie)
      .expect(200);
    expect(
      parseNotificationListResponse(departmentNotificationList).data.filter(
        ({ type, resourceId }) =>
          type === NotificationType.REPAIR_READY_FOR_COLLECTION &&
          resourceId === departmentJobId,
      ),
    ).toHaveLength(1);
    for (const stream of [departmentStream, departmentMemberStream]) {
      await expectReadyEvent(stream, departmentJobId);
      await expectNoEvent(stream.reader, 'notification.created', 250);
    }
    for (const stream of [
      otherDepartmentStream,
      firstCenterStream,
      secondCenterStream,
      parcelStream,
    ]) {
      await expectNoEvent(stream.reader, 'notification.created', 250);
    }

    const centerAssetId = await createRepairTestAsset(
      testSectionId,
      firstCenterUserId,
      'Center ready for collection test asset',
    );
    const centerRequest = await createRepairRequest(
      centerAssetId,
      firstCenterCookie,
    );
    const centerJobId = requireString(centerRequest, 'id');
    await diagnose(centerJobId, 'SELF_REPAIR');
    await stepForward(centerJobId);
    await stepForward(centerJobId);
    const centerRows = await prisma.notification.findMany({
      where: {
        resourceId: centerJobId,
        type: NotificationType.REPAIR_READY_FOR_COLLECTION,
      },
      orderBy: { userId: 'asc' },
      select: { userId: true },
    });
    const expectedCenterRecipients = await prisma.user.findMany({
      where: {
        section_id: testSectionId,
        role: UserRole.ASSET_CENTER_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    expect(centerRows.map(({ userId }) => userId)).toEqual(
      expectedCenterRecipients.map(({ id }) => id),
    );
    for (const stream of [firstCenterStream, secondCenterStream]) {
      await expectReadyEvent(stream, centerJobId);
    }
    for (const stream of [
      departmentStream,
      departmentMemberStream,
      otherDepartmentStream,
      parcelStream,
    ]) {
      await expectNoEvent(stream.reader, 'notification.created', 250);
    }

    const unrepairableAssetId = await createRepairTestAsset(
      departmentSectionId,
      departmentUserId,
      'Unrepairable exclusion test asset',
    );
    const unrepairableRequest = await createRepairRequest(
      unrepairableAssetId,
      departmentCookie,
    );
    const unrepairableJobId = requireString(unrepairableRequest, 'id');
    const unrepairableJobNo = requireString(unrepairableRequest, 'jobNo');
    const unrepairableAssetCode = `NT-UN-${randomUUID().slice(0, 8)}`;
    await prisma.asset.update({
      where: { id: unrepairableAssetId },
      data: { noid: unrepairableAssetCode },
    });
    await diagnose(unrepairableJobId, 'UNREPAIRABLE', {
      unrepairableReason: 'Integration test: cannot repair',
    });
    expect(
      await prisma.notification.count({
        where: { resourceId: unrepairableJobId },
      }),
    ).toBe(0);
    await stepForward(unrepairableJobId);
    expect(
      await prisma.notification.count({
        where: { resourceId: unrepairableJobId },
      }),
    ).toBe(0);
    await patchRepair(
      `/repairs/${unrepairableJobId}/complete-unrepairable`,
      departmentCookie,
      { storageLocation: 'Repair notification test area' },
      403,
    );

    // A failed notification insert must roll back custody and emit no SSE.
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION public.raise_unrepairable_notification_for_test()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.type::text = 'REPAIR_UNREPAIRABLE_RECEIVED' THEN
          RAISE EXCEPTION 'unrepairable receipt notification rollback test';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    await prisma.$executeRaw`
      CREATE TRIGGER raise_unrepairable_notification_for_test
      BEFORE INSERT ON public.notifications
      FOR EACH ROW EXECUTE FUNCTION public.raise_unrepairable_notification_for_test()
    `;
    try {
      await patchRepair(
        `/repairs/${unrepairableJobId}/complete-unrepairable`,
        repairParcelCookie,
        { storageLocation: 'Repair notification test area' },
        500,
      );
    } finally {
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS raise_unrepairable_notification_for_test
        ON public.notifications
      `;
      await prisma.$executeRaw`
        DROP FUNCTION IF EXISTS public.raise_unrepairable_notification_for_test()
      `;
    }
    const rolledBackReceipt = await prisma.repairJob.findUniqueOrThrow({
      where: { id: unrepairableJobId },
      include: {
        jobStatus: true,
        asset: { include: { status: true } },
        repairJobSteps: {
          where: { stepMaster: { stepNumber: 6 } },
        },
      },
    });
    expect(rolledBackReceipt.jobStatus.code).toBe('UNREPAIRABLE');
    expect(rolledBackReceipt.receiverId).toBeNull();
    expect(rolledBackReceipt.returnDate).toBeNull();
    expect(rolledBackReceipt.asset.status.code).toBe('UNDER_REPAIR');
    expect(rolledBackReceipt.repairJobSteps[0]?.completeAt).toBeNull();
    expect(
      await prisma.notification.count({
        where: { resourceId: unrepairableJobId },
      }),
    ).toBe(0);
    for (const stream of streams) {
      await expectNoEvent(stream.reader, 'notification.created', 250);
    }

    const receiptCsrf = await getCsrfProof(repairParcelCookie);
    const receiptResponses = await Promise.all(
      [1, 2].map(() =>
        request(server())
          .patch(`/repairs/${unrepairableJobId}/complete-unrepairable`)
          .set('Origin', 'http://localhost:5173')
          .set('Cookie', receiptCsrf.cookie)
          .set('X-CSRF-Token', receiptCsrf.token)
          .send({ storageLocation: 'Repair notification test area' }),
      ),
    );
    expect(receiptResponses.some(({ status }) => status === 200)).toBe(true);
    expect(
      receiptResponses.every(({ status }) => [200, 400].includes(status)),
    ).toBe(true);
    const receiptRows = await prisma.notification.findMany({
      where: { resourceId: unrepairableJobId },
      orderBy: { userId: 'asc' },
    });
    expect(receiptRows.map(({ userId }) => userId)).toEqual(
      readyRecipients.map(({ id }) => id).sort(),
    );
    for (const row of receiptRows) {
      expect(row).toMatchObject({
        type: NotificationType.REPAIR_UNREPAIRABLE_RECEIVED,
        title: 'เครื่องซ่อมไม่ได้ พัสดุรับมอบแล้ว',
        resourceType: NotificationResourceType.REPAIR_JOB,
        readAt: null,
        eventKey: `${NotificationType.REPAIR_UNREPAIRABLE_RECEIVED}:${unrepairableJobId}`,
      });
      expect(row.message).toContain(unrepairableJobNo);
      expect(row.message).toContain(unrepairableAssetCode);
      expect(row.message).toContain('พัสดุรับมอบเพื่อเก็บรอจำหน่ายแล้ว');
    }
    const expectReceiptEvent = async (
      stream: { reader: SseEventReader },
      jobId: string,
    ) => {
      let event = await stream.reader.next(5_000);
      while (event.frame?.event === 'heartbeat') {
        event = await stream.reader.next(5_000);
      }
      expect(event.frame).toMatchObject({
        event: 'notification.created',
        data: {
          type: NotificationType.REPAIR_UNREPAIRABLE_RECEIVED,
          resourceType: NotificationResourceType.REPAIR_JOB,
          resourceId: jobId,
          readAt: null,
        },
      });
    };
    await expectReceiptEvent(departmentStream, unrepairableJobId);
    await expectReceiptEvent(departmentMemberStream, unrepairableJobId);
    const departmentNotifications = parseNotificationListResponse(
      await request(server())
        .get('/notifications?limit=100')
        .set('Cookie', departmentCookie)
        .expect(200),
    );
    expect(departmentNotifications.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: NotificationType.REPAIR_UNREPAIRABLE_RECEIVED,
          resourceId: unrepairableJobId,
        }),
      ]),
    );
    await patchRepair(
      `/repairs/${unrepairableJobId}/complete-unrepairable`,
      repairParcelCookie,
      { storageLocation: 'Repair notification test area' },
      400,
    );
    expect(
      await prisma.notification.count({
        where: {
          resourceId: unrepairableJobId,
          type: {
            in: [
              NotificationType.REPAIR_APPROVAL_REQUIRED,
              NotificationType.REPAIR_READY_FOR_COLLECTION,
            ],
          },
        },
      }),
    ).toBe(0);
    for (const stream of streams) {
      await expectNoEvent(stream.reader, 'notification.created', 250);
    }

    const centerUnrepairableAssetId = await createRepairTestAsset(
      testSectionId,
      firstCenterUserId,
      'Center unrepairable receipt notification test asset',
    );
    const centerUnrepairableRequest = await createRepairRequest(
      centerUnrepairableAssetId,
      firstCenterCookie,
    );
    const centerUnrepairableJobId = requireString(
      centerUnrepairableRequest,
      'id',
    );
    await diagnose(centerUnrepairableJobId, 'UNREPAIRABLE', {
      unrepairableReason:
        'Integration test: central equipment cannot be repaired',
    });
    await stepForward(centerUnrepairableJobId);
    await patchRepair(
      `/repairs/${centerUnrepairableJobId}/complete-unrepairable`,
      repairParcelCookie,
      { storageLocation: 'Central equipment disposal holding area' },
      200,
    );
    const centerReceiptRows = await prisma.notification.findMany({
      where: { resourceId: centerUnrepairableJobId },
      orderBy: { userId: 'asc' },
      select: { userId: true, type: true },
    });
    expect(centerReceiptRows.map(({ userId }) => userId)).toEqual(
      expectedCenterRecipients.map(({ id }) => id),
    );
    expect(
      centerReceiptRows.every(
        ({ type }) => type === NotificationType.REPAIR_UNREPAIRABLE_RECEIVED,
      ),
    ).toBe(true);
    for (const stream of [firstCenterStream, secondCenterStream]) {
      await expectReceiptEvent(stream, centerUnrepairableJobId);
    }
    for (const stream of [
      departmentStream,
      departmentMemberStream,
      otherDepartmentStream,
      parcelStream,
    ]) {
      await expectNoEvent(stream.reader, 'notification.created', 250);
    }
  });

  it('reminds only the borrower before the deadline, escalates overdue once, and starts a new cycle after an approved extension', async () => {
    await refreshTicket03Sessions();

    const startAt = new Date(Date.now() + 2_000);
    borrowDeadlineNow = startAt;
    const originalDeadline = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
    const borrowAssetId = await createDeadlineTestAsset(
      `Deadline notification test asset ${randomUUID().slice(0, 8)}`,
    );
    const createdBorrowResponse = await request(server())
      .post('/borrowings')
      .set('Cookie', firstCenterCookie)
      .send({
        assetId: borrowAssetId,
        borrowerId: departmentUserId,
        deliveryMethod: 'PICKUP',
        expectedReturnDate: originalDeadline.toISOString(),
      })
      .expect(201);
    centerServiceBorrowId = parseBorrowingResponse(createdBorrowResponse).id;
    borrowIds.push(centerServiceBorrowId);

    const quickDeadlineBorrowerStream = await openStream(
      extensionRequesterCookie,
    );
    const quickDeadlineAssetId = await createDeadlineTestAsset(
      `Short remaining deadline test asset ${randomUUID().slice(0, 8)}`,
    );
    const quickDeadlineBorrowResponse = await request(server())
      .post('/borrowings')
      .set('Cookie', firstCenterCookie)
      .send({
        assetId: quickDeadlineAssetId,
        borrowerId: extensionRequesterUserId,
        deliveryMethod: 'PICKUP',
        expectedReturnDate: new Date(
          startAt.getTime() + 23 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .expect(201);
    const quickDeadlineBorrowId = parseBorrowingResponse(
      quickDeadlineBorrowResponse,
    ).id;
    borrowIds.push(quickDeadlineBorrowId);
    async function createDeadlineBorrow(
      borrowerId: string,
      expectedReturnDate: Date,
    ): Promise<string> {
      const assetId = await createDeadlineTestAsset(
        `Boundary deadline test asset ${randomUUID().slice(0, 8)}`,
      );
      const response = await request(server())
        .post('/borrowings')
        .set('Cookie', firstCenterCookie)
        .send({
          assetId,
          borrowerId,
          deliveryMethod: 'PICKUP',
          expectedReturnDate: new Date(
            startAt.getTime() + 25 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .expect(201);
      const id = parseBorrowingResponse(response).id;
      borrowIds.push(id);
      await prisma.borrowTransaction.update({
        where: { id },
        data: { expectedReturnDate },
      });
      return id;
    }
    const exactDeadlineBorrowId = await createDeadlineBorrow(
      departmentUserId,
      startAt,
    );
    const firstSeenOverdueBorrowId = await createDeadlineBorrow(
      extensionRequesterUserId,
      new Date(startAt.getTime() - 1),
    );
    const quickDeadlineInitial =
      await quickDeadlineBorrowerStream.reader.next(5_000);
    expect(quickDeadlineInitial.frame?.event).toBe(
      'notifications.sync_required',
    );

    const originalBorrow = await prisma.borrowTransaction.findUniqueOrThrow({
      where: { id: centerServiceBorrowId },
      select: { borrowNo: true, asset: { select: { name: true } } },
    });

    const borrowerStream = await openStream(departmentCookie);
    const firstSeenOverdueBorrowerStream = await openStream(
      extensionRequesterCookie,
    );
    const firstCenterStream = await openStream(firstCenterCookie);
    const secondCenterStream = await openStream(secondCenterCookie);
    for (const stream of [
      borrowerStream,
      firstSeenOverdueBorrowerStream,
      firstCenterStream,
      secondCenterStream,
    ]) {
      const initial = await stream.reader.next(5_000);
      expect(initial.frame?.event).toBe('notifications.sync_required');
    }

    const deadlineScheduler = app.get(BorrowDeadlineNotificationsService);
    await Promise.all([
      deadlineScheduler.runSweepOnce(),
      deadlineScheduler.runSweepOnce(),
    ]);
    const exactDeadlineDueSoon = await waitForCreatedNotification(
      borrowerStream.reader,
      exactDeadlineBorrowId,
      NotificationType.BORROW_DUE_SOON,
    );
    const dueSoon = await waitForCreatedNotification(
      borrowerStream.reader,
      centerServiceBorrowId,
      NotificationType.BORROW_DUE_SOON,
    );
    const quickDeadlineDueSoon = await waitForCreatedNotification(
      quickDeadlineBorrowerStream.reader,
      quickDeadlineBorrowId,
      NotificationType.BORROW_DUE_SOON,
    );
    const firstSeenOverdue = await waitForCreatedNotification(
      firstSeenOverdueBorrowerStream.reader,
      firstSeenOverdueBorrowId,
      NotificationType.BORROW_OVERDUE,
    );
    await waitForCreatedNotification(
      firstCenterStream.reader,
      firstSeenOverdueBorrowId,
      NotificationType.BORROW_OVERDUE,
    );
    await waitForCreatedNotification(
      secondCenterStream.reader,
      firstSeenOverdueBorrowId,
      NotificationType.BORROW_OVERDUE,
    );
    expect(quickDeadlineDueSoon.resourceId).toBe(quickDeadlineBorrowId);
    expect(exactDeadlineDueSoon.resourceId).toBe(exactDeadlineBorrowId);
    expect(firstSeenOverdue.resourceId).toBe(firstSeenOverdueBorrowId);
    expect(dueSoon.message).toContain(originalBorrow.borrowNo);
    expect(dueSoon.message).toContain(originalBorrow.asset.name);
    await expectNoNotificationForResource(
      firstCenterStream.reader,
      centerServiceBorrowId,
      250,
    );
    await expectNoNotificationForResource(
      secondCenterStream.reader,
      centerServiceBorrowId,
      250,
    );
    for (const stream of [firstCenterStream, secondCenterStream]) {
      await expectNoNotificationForResource(
        stream.reader,
        quickDeadlineBorrowId,
        50,
      );
    }
    const exactDeadlineRows = await prisma.notification.findMany({
      where: { resourceId: exactDeadlineBorrowId },
      select: { userId: true, type: true },
    });
    expect(exactDeadlineRows).toEqual([
      { userId: departmentUserId, type: NotificationType.BORROW_DUE_SOON },
    ]);
    expect(
      await prisma.notification.count({
        where: {
          resourceId: firstSeenOverdueBorrowId,
          type: NotificationType.BORROW_DUE_SOON,
        },
      }),
    ).toBe(0);
    const overdueRecipients = await prisma.notification.findMany({
      where: {
        resourceId: firstSeenOverdueBorrowId,
        type: NotificationType.BORROW_OVERDUE,
      },
      select: { userId: true },
    });
    const activeCenterCount = await prisma.user.count({
      where: {
        role: UserRole.ASSET_CENTER_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
    });
    expect(overdueRecipients).toHaveLength(activeCenterCount + 1);

    const dueSoonRows = await prisma.notification.findMany({
      where: {
        resourceId: centerServiceBorrowId,
        type: NotificationType.BORROW_DUE_SOON,
      },
      select: { userId: true, eventKey: true },
    });
    expect(dueSoonRows).toEqual([
      {
        userId: departmentUserId,
        eventKey: `${NotificationType.BORROW_DUE_SOON}:${centerServiceBorrowId}:${originalDeadline.getTime()}`,
      },
    ]);

    await deadlineScheduler.runSweepOnce();
    await expectNoNotificationForResource(
      borrowerStream.reader,
      centerServiceBorrowId,
      250,
    );

    borrowDeadlineNow = originalDeadline;
    await deadlineScheduler.runSweepOnce();
    await expectNoNotificationForResource(
      borrowerStream.reader,
      centerServiceBorrowId,
      250,
    );
    expect(
      await prisma.notification.count({
        where: {
          resourceId: centerServiceBorrowId,
          type: NotificationType.BORROW_OVERDUE,
        },
      }),
    ).toBe(0);
    await waitForCreatedNotification(
      quickDeadlineBorrowerStream.reader,
      quickDeadlineBorrowId,
      NotificationType.BORROW_OVERDUE,
    );

    const originalDeadlineRecipients = await prisma.user.findMany({
      where: {
        role: UserRole.ASSET_CENTER_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    const originalCenterRecipientIds = originalDeadlineRecipients
      .map(({ id }) => id)
      .sort();

    borrowDeadlineNow = new Date(originalDeadline.getTime() + 1);
    await deadlineScheduler.runSweepOnce();
    await waitForCreatedNotification(
      borrowerStream.reader,
      centerServiceBorrowId,
      NotificationType.BORROW_OVERDUE,
    );
    for (const stream of [firstCenterStream, secondCenterStream]) {
      await waitForCreatedNotification(
        stream.reader,
        centerServiceBorrowId,
        NotificationType.BORROW_OVERDUE,
      );
    }
    const originalOverdueRows = await prisma.notification.findMany({
      where: {
        resourceId: centerServiceBorrowId,
        type: NotificationType.BORROW_OVERDUE,
      },
      orderBy: { userId: 'asc' },
      select: { userId: true, eventKey: true },
    });
    expect(originalOverdueRows.map(({ userId }) => userId).sort()).toEqual(
      [...new Set([departmentUserId, ...originalCenterRecipientIds])].sort(),
    );
    expect(
      new Set(originalOverdueRows.map(({ eventKey }) => eventKey)).size,
    ).toBe(1);

    const lateCenterUserId = await createUser(
      `notification-late-center-${randomUUID()}@hams-test.local`,
      UserRole.ASSET_CENTER_STAFF,
      testSectionId,
    );
    expect(
      await prisma.notification.count({
        where: {
          resourceId: centerServiceBorrowId,
          userId: lateCenterUserId,
          type: NotificationType.BORROW_OVERDUE,
        },
      }),
    ).toBe(0);

    await deadlineScheduler.runSweepOnce();
    await expectNoNotificationForResource(
      borrowerStream.reader,
      centerServiceBorrowId,
      250,
    );
    for (const stream of [firstCenterStream, secondCenterStream]) {
      await expectNoNotificationForResource(
        stream.reader,
        centerServiceBorrowId,
        250,
      );
    }

    const extensionDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const extensionCsrf = await getCsrfProof(extensionRequesterCookie);
    const extensionResponse = await request(server())
      .post(`/borrowings/${centerServiceBorrowId}/extensions`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', extensionCsrf.cookie)
      .set('X-CSRF-Token', extensionCsrf.token)
      .send({
        requestedReturnDate: extensionDate.toISOString(),
        reason: 'Notification deadline integration test',
      })
      .expect(201);
    const extensionBody = requireRecord(
      extensionResponse.body,
      'borrow extension',
    );
    const extensionId = requireString(extensionBody, 'id');
    extensionIds.push(extensionId);
    const deadlineWhilePending =
      await prisma.borrowTransaction.findUniqueOrThrow({
        where: { id: centerServiceBorrowId },
        select: { expectedReturnDate: true },
      });
    expect(deadlineWhilePending.expectedReturnDate).toEqual(originalDeadline);

    const pendingCenterEvent = await waitForCreatedNotification(
      firstCenterStream.reader,
      extensionId,
      NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
    );
    expect(pendingCenterEvent.resourceId).toBe(extensionId);
    await deadlineScheduler.runSweepOnce();
    await expectNoNotificationForResource(
      borrowerStream.reader,
      centerServiceBorrowId,
      250,
    );
    for (const stream of [firstCenterStream, secondCenterStream]) {
      await expectNoNotificationForResource(
        stream.reader,
        centerServiceBorrowId,
        250,
      );
    }

    const centerCsrf = await getCsrfProof(firstCenterCookie);
    await request(server())
      .patch(`/borrowings/extensions/${extensionId}/review`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', centerCsrf.cookie)
      .set('X-CSRF-Token', centerCsrf.token)
      .send({ status: 'APPROVED' })
      .expect(200);
    const deadlineAfterApproval =
      await prisma.borrowTransaction.findUniqueOrThrow({
        where: { id: centerServiceBorrowId },
        select: { expectedReturnDate: true },
      });
    expect(deadlineAfterApproval.expectedReturnDate).toEqual(extensionDate);

    const nextCycleDeadline = deadlineAfterApproval.expectedReturnDate;
    if (!nextCycleDeadline) {
      throw new Error('Approved extension did not persist its new deadline');
    }
    borrowDeadlineNow = new Date(
      nextCycleDeadline.getTime() - 24 * 60 * 60 * 1000,
    );
    await deadlineScheduler.runSweepOnce();
    await waitForCreatedNotification(
      borrowerStream.reader,
      centerServiceBorrowId,
      NotificationType.BORROW_DUE_SOON,
    );
    await expectNoNotificationForResource(
      firstCenterStream.reader,
      centerServiceBorrowId,
      250,
    );

    borrowDeadlineNow = new Date(nextCycleDeadline.getTime() + 1);
    await deadlineScheduler.runSweepOnce();
    await waitForCreatedNotification(
      borrowerStream.reader,
      centerServiceBorrowId,
      NotificationType.BORROW_OVERDUE,
    );
    await waitForCreatedNotification(
      firstCenterStream.reader,
      centerServiceBorrowId,
      NotificationType.BORROW_OVERDUE,
    );

    const nextCycleRows = await prisma.notification.findMany({
      where: {
        resourceId: centerServiceBorrowId,
        type: {
          in: [
            NotificationType.BORROW_DUE_SOON,
            NotificationType.BORROW_OVERDUE,
          ],
        },
      },
      orderBy: [{ type: 'asc' }, { userId: 'asc' }],
      select: { userId: true, type: true, eventKey: true },
    });
    const expectedNextCycleCenters = await prisma.user.findMany({
      where: {
        role: UserRole.ASSET_CENTER_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    const newCycleOverdueEventKey = `${NotificationType.BORROW_OVERDUE}:${centerServiceBorrowId}:${nextCycleDeadline.getTime()}`;
    const newCycleOverdueRecipients = nextCycleRows
      .filter(
        ({ type, eventKey }) =>
          type === NotificationType.BORROW_OVERDUE &&
          eventKey === newCycleOverdueEventKey,
      )
      .map(({ userId }) => userId)
      .sort();
    expect(newCycleOverdueRecipients).toEqual(
      [
        ...new Set([
          departmentUserId,
          ...expectedNextCycleCenters.map(({ id }) => id),
        ]),
      ].sort(),
    );
    expect(new Set(nextCycleRows.map(({ eventKey }) => eventKey)).size).toBe(4);

    const borrowerApi = parseNotificationListResponse(
      await request(server())
        .get('/notifications?limit=100')
        .set('Cookie', departmentCookie)
        .expect(200),
    );
    expect(
      borrowerApi.data
        .filter(
          (notification) => notification.resourceId === centerServiceBorrowId,
        )
        .map(({ type }) => type)
        .sort(),
    ).toEqual(
      [
        NotificationType.BORROW_DUE_SOON,
        NotificationType.BORROW_DUE_SOON,
        NotificationType.BORROW_OVERDUE,
        NotificationType.BORROW_OVERDUE,
      ].sort(),
    );

    await prisma.borrowTransaction.update({
      where: { id: centerServiceBorrowId },
      data: { expectedReturnDate: null },
    });
    await deadlineScheduler.runSweepOnce();
    await expectNoNotificationForResource(
      borrowerStream.reader,
      centerServiceBorrowId,
      50,
    );

    const concurrentReturnDeadline = new Date(
      nextCycleDeadline.getTime() - 60_000,
    );
    await prisma.borrowTransaction.update({
      where: { id: centerServiceBorrowId },
      data: { expectedReturnDate: concurrentReturnDeadline },
    });

    const triggerSuffix = randomUUID().replaceAll('-', '');
    const triggerName = `pause_return_${triggerSuffix}`;
    const functionName = `pause_return_fn_${triggerSuffix}`;
    const advisoryLockKey = 1_904_051_013;
    try {
      await pool!.query(`
        CREATE FUNCTION public."${functionName}"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF OLD."borrow_transaction_id" = '${centerServiceBorrowId}'
            AND NEW."borrow_status_id" <> OLD."borrow_status_id" THEN
            PERFORM pg_advisory_xact_lock(
              ${advisoryLockKey},
              hashtext(OLD."borrow_transaction_id")
            );
            PERFORM pg_sleep(1.5);
          END IF;
          RETURN NEW;
        END;
        $$;
      `);
      await pool!.query(`
        CREATE TRIGGER "${triggerName}"
        BEFORE UPDATE OF "borrow_status_id" ON public."borrow_transaction"
        FOR EACH ROW EXECUTE FUNCTION public."${functionName}"();
      `);

      const returnCsrf = await getCsrfProof(departmentCookie);
      const returnRequest = (async () =>
        await request(server())
          .patch(`/borrowings/${centerServiceBorrowId}/request-return`)
          .set('Origin', 'http://localhost:5173')
          .set('Cookie', returnCsrf.cookie)
          .set('X-CSRF-Token', returnCsrf.token)
          .send({ remark: 'Concurrent deadline notification test' }))();

      let returnUpdateHasLock = false;
      const lockDeadline = Date.now() + 3_000;
      while (Date.now() < lockDeadline) {
        const probe = await pool!.query<{ acquired: boolean }>(
          'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
          [advisoryLockKey, centerServiceBorrowId],
        );
        if (!probe.rows[0]?.acquired) {
          returnUpdateHasLock = true;
          break;
        }
        await pool!.query('SELECT pg_advisory_unlock($1, hashtext($2))', [
          advisoryLockKey,
          centerServiceBorrowId,
        ]);
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
      }
      expect(returnUpdateHasLock).toBe(true);

      await deadlineScheduler.runSweepOnce();
      const returnResponse = await returnRequest;
      expect(returnResponse.status).toBe(200);
      await deadlineScheduler.runSweepOnce();
      await expectNoNotificationForResource(
        borrowerStream.reader,
        centerServiceBorrowId,
        250,
      );
      expect(
        await prisma.notification.count({
          where: {
            resourceId: centerServiceBorrowId,
            eventKey: `${NotificationType.BORROW_OVERDUE}:${centerServiceBorrowId}:${concurrentReturnDeadline.getTime()}`,
          },
        }),
      ).toBe(0);
    } finally {
      await pool!.query(
        `DROP TRIGGER IF EXISTS "${triggerName}" ON public."borrow_transaction"`,
      );
      await pool!.query(`DROP FUNCTION IF EXISTS public."${functionName}"()`);
    }

    const borrowedStatus = await prisma.borrowStatus.findUniqueOrThrow({
      where: { code: 'BORROWED' },
      select: { id: true },
    });
    for (const [index, statusCode] of [
      'PENDING_APPROVE',
      'APPROVED',
      'IN_PICKUP',
      'PENDING_RETURN',
      'RETURNED',
      'CANCELLED',
    ].entries()) {
      const status = await prisma.borrowStatus.upsert({
        where: { code: statusCode },
        update: {},
        create: { code: statusCode, name: statusCode },
        select: { id: true },
      });
      await prisma.borrowTransaction.update({
        where: { id: centerServiceBorrowId },
        data: {
          borrow_status_id: status.id,
          expectedReturnDate: new Date(
            borrowDeadlineNow.getTime() - 10_000 - index,
          ),
        },
      });
      await deadlineScheduler.runSweepOnce();
      await expectNoNotificationForResource(
        borrowerStream.reader,
        centerServiceBorrowId,
        50,
      );
    }

    await prisma.borrowTransaction.update({
      where: { id: centerServiceBorrowId },
      data: {
        borrow_status_id: borrowedStatus.id,
        expectedReturnDate: nextCycleDeadline,
      },
    });
    for (const controller of abortControllers) controller.abort();
    abortControllers.splice(0, abortControllers.length);
    await app.close();
    app = await createNotificationIntegrationApplication();
    await refreshTicket03Sessions();
    const restartedBorrowerStream = await openStream(departmentCookie);
    const restartedInitial = await restartedBorrowerStream.reader.next(5_000);
    expect(restartedInitial.frame?.event).toBe('notifications.sync_required');
    await app.get(BorrowDeadlineNotificationsService).runSweepOnce();
    await expectNoNotificationForResource(
      restartedBorrowerStream.reader,
      centerServiceBorrowId,
      250,
    );
    const afterRestartApi = parseNotificationListResponse(
      await request(server())
        .get('/notifications?limit=100')
        .set('Cookie', departmentCookie)
        .expect(200),
    );
    expect(
      afterRestartApi.data.filter(
        ({ resourceId, type }) =>
          resourceId === centerServiceBorrowId &&
          (type === NotificationType.BORROW_DUE_SOON ||
            type === NotificationType.BORROW_OVERDUE),
      ),
    ).toHaveLength(4);
    restartedBorrowerStream.controller.abort();
  });

  it('excludes ineligible borrowers from deadline notifications while still notifying active center staff about overdue loans', async () => {
    await refreshTicket03Sessions();
    const now = new Date();
    const deadline = new Date(now.getTime() + 60 * 60 * 1000);
    borrowDeadlineNow = now;
    const fixtures: Array<{ id: string; userId: string; cookie: string }> = [];
    for (const borrower of [
      { userId: departmentUserId, cookie: departmentCookie },
      { userId: extensionRequesterUserId, cookie: extensionRequesterCookie },
    ]) {
      const assetId = await createDeadlineTestAsset(
        `Ineligible borrower test asset ${randomUUID().slice(0, 8)}`,
      );
      const response = await request(server())
        .post('/borrowings')
        .set('Cookie', firstCenterCookie)
        .send({
          assetId,
          borrowerId: borrower.userId,
          deliveryMethod: 'PICKUP',
          expectedReturnDate: deadline.toISOString(),
        })
        .expect(201);
      const id = parseBorrowingResponse(response).id;
      borrowIds.push(id);
      fixtures.push({ id, ...borrower });
    }
    const firstCenterStream = await openStream(firstCenterCookie);
    const secondCenterStream = await openStream(secondCenterCookie);
    for (const stream of [firstCenterStream, secondCenterStream]) {
      expect((await stream.reader.next(5_000)).frame?.event).toBe(
        'notifications.sync_required',
      );
    }
    try {
      await prisma.user.update({
        where: { id: departmentUserId },
        data: { banned: true },
      });
      await prisma.user.update({
        where: { id: extensionRequesterUserId },
        data: { deletedAt: new Date() },
      });
      const scheduler = app.get(BorrowDeadlineNotificationsService);
      await scheduler.runSweepOnce();
      borrowDeadlineNow = new Date(deadline.getTime() + 1);
      await scheduler.runSweepOnce();
      await waitForCreatedNotification(
        firstCenterStream.reader,
        fixtures[0].id,
        NotificationType.BORROW_OVERDUE,
      );
      await waitForCreatedNotification(
        secondCenterStream.reader,
        fixtures[1].id,
        NotificationType.BORROW_OVERDUE,
      );
    } finally {
      await prisma.user.update({
        where: { id: departmentUserId },
        data: { banned: false },
      });
      await prisma.user.update({
        where: { id: extensionRequesterUserId },
        data: { deletedAt: null },
      });
      firstCenterStream.controller.abort();
      secondCenterStream.controller.abort();
    }
    // Re-enable the accounts only to inspect their persisted history through HTTP.
    for (const fixture of fixtures) {
      const history = parseNotificationListResponse(
        await request(server())
          .get('/notifications?limit=100')
          .set('Cookie', fixture.cookie)
          .expect(200),
      );
      expect(
        history.data.filter(({ resourceId }) => resourceId === fixture.id),
      ).toEqual([]);
    }
  });
});
