import 'dotenv/config';
import type { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { generateSync } from 'otplib';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { TwoFactorService } from '../src/auth/two-factor.service';
import { IMAGE_CLOCK, type ImageClock } from '../src/images/image-clock.port';
import {
  ImageStorageError,
  IMAGE_STORAGE,
  type ImageObjectReference,
  type ImageStoragePort,
  type UploadInstructionsInput,
  type VerifyUploadedObjectInput,
} from '../src/images/image-storage.port';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const sharedPassword = 'TestPassword@1234!';
const originalCompletionAttemptLimit =
  process.env.IMAGE_UPLOAD_MAX_COMPLETION_ATTEMPTS_PER_INTENT;
const originalIntentLimit =
  process.env.IMAGE_UPLOAD_MAX_INTENTS_PER_ACTOR_PER_HOUR;
const originalCrudAttachmentEnabled = process.env.IMAGE_CRUD_ATTACHMENT_ENABLED;
const fixedNow = new Date('2026-10-01T03:00:00.000Z');
jest.setTimeout(60_000);
const fixtureEmails = {
  admin: 'test-image-admin@hams-test.local',
  assetCenter: 'test-image-asset-center@hams-test.local',
  department: 'test-image-department@hams-test.local',
  parcel: 'test-image-parcel@hams-test.local',
  ticket02Employee: 'test-image-ticket02-employee@hams-test.local',
  ticket02Rollback: 'test-image-ticket02-rollback@hams-test.local',
};

interface UploadIntentResponse {
  readonly uploadId: string;
  readonly purpose: string;
  readonly status: string;
  readonly targetId: string | null;
  readonly creationContextToken: string | null;
  readonly issuedAt: string;
  readonly signatureExpiresAt: string;
  readonly uploadInstructions: {
    readonly method: string;
    readonly url: string;
    readonly fields: Readonly<Record<string, string>>;
  };
}

interface UploadStatusResponse {
  readonly status: string;
  readonly attachmentExpiresAt: string | null;
  readonly verifiedImage?: {
    readonly format: string;
    readonly width: number;
    readonly height: number;
    readonly bytes: number;
  };
}

interface ApiErrorResponse {
  readonly code: string;
}

function responseBody<T>(response: request.Response): T {
  const serialized = JSON.stringify(response.body);
  if (serialized === undefined) {
    throw new Error('The HTTP response did not contain JSON');
  }
  return JSON.parse(serialized) as T;
}

class DeterministicImageClock implements ImageClock {
  private current = new Date(fixedNow);

  now(): Date {
    return new Date(this.current);
  }

  set(value: Date): void {
    this.current = new Date(value);
  }
}

class DeterministicImageStorage implements ImageStoragePort {
  readonly createdInstructions: UploadInstructionsInput[] = [];
  readonly verifiedEvidence: VerifyUploadedObjectInput[] = [];
  readonly deleteCalls: ImageObjectReference[] = [];
  failNextInstruction = false;
  failNextVerification = false;

  constructor(private readonly clock: ImageClock) {}

  getProviderContext() {
    return { provider: 'cloudinary', accountId: 'test-cloud' };
  }

  createUploadInstructions(input: UploadInstructionsInput): {
    url: string;
    method: 'POST';
    fields: Record<string, string>;
    expiresAt: Date;
  } {
    if (this.failNextInstruction) {
      this.failNextInstruction = false;
      throw new ImageStorageError(
        'UNAVAILABLE',
        'The test provider is temporarily unavailable',
      );
    }
    this.createdInstructions.push(input);
    return {
      url: 'https://cloudinary.test/image/upload',
      method: 'POST',
      fields: {
        api_key: 'test-api-key',
        public_id: input.publicId,
        signature: 'test-only-signature',
      },
      expiresAt: input.signatureExpiresAt,
    };
  }

  verifyUploadedObject(input: VerifyUploadedObjectInput): Promise<{
    publicId: string;
    version: number;
    resourceType: 'image';
    deliveryType: 'upload' | 'authenticated';
    createdAt: Date;
    format: 'jpg';
    bytes: number;
    width: number;
    height: number;
    pages: 1;
    sourcePolicyRevision: string;
  }> {
    this.verifiedEvidence.push(input);
    if (this.failNextVerification) {
      this.failNextVerification = false;
      return Promise.reject(
        new ImageStorageError(
          'UNAVAILABLE',
          'The test provider is temporarily unavailable',
        ),
      );
    }
    if (input.evidence.signature !== 'a'.repeat(40)) {
      return Promise.reject(
        new ImageStorageError(
          'EVIDENCE_INVALID',
          'The provider upload evidence is invalid',
        ),
      );
    }
    const width = Math.min(800, input.policy.maxEdge);
    const height = Math.min(600, input.policy.maxEdge);
    return Promise.resolve({
      publicId: input.publicId,
      version: input.evidence.version,
      resourceType: 'image',
      deliveryType: input.deliveryType,
      createdAt: this.clock.now(),
      format: 'jpg',
      bytes: 1_024,
      width,
      height,
      pages: 1,
      sourcePolicyRevision: input.policy.revision,
    });
  }

  publicUrl(reference: ImageObjectReference): string {
    return `https://images.test/image/upload/v${reference.version}/${reference.publicId}.jpg`;
  }

  createShortLivedReadGrant(): never {
    throw new Error('not used by upload acceptance tests');
  }

  deleteObject(reference: ImageObjectReference): Promise<void> {
    this.deleteCalls.push(reference);
    return Promise.resolve();
  }
}

function cookies(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  return Array.isArray(header) ? header : header ? [header] : [];
}

function cookiePair(res: request.Response, name: string): string {
  return (
    cookies(res)
      .find((value) => value.startsWith(`${name}=`))
      ?.split(';', 1)[0] ?? ''
  );
}

function sessionCookieHeader(res: request.Response): string {
  return cookies(res)
    .filter((value) =>
      /^(?:__Secure-)?better-auth\.session_(?:token|data)(?:\.\d+)?=/i.test(
        value,
      ),
    )
    .map((value) => value.split(';', 1)[0])
    .join('; ');
}

describe('Image upload API (real HAMS auth + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let pool: import('pg').Pool | undefined;
  let sectionId: string;
  let adminId: string;
  let adminCookie: string;
  let adminTotpSecret: string;
  let departmentCookie: string;
  let parcelCookie: string;
  let assetCenterCookie: string;
  let pendingAssetUploadId: string;
  const createdAssetIds: string[] = [];
  let csrfCookieName: string;
  const clock = new DeterministicImageClock();
  const storage = new DeterministicImageStorage(clock);
  const server = () => app.getHttpServer() as Server;

  async function createVerifiedUpload(
    headers: {
      Origin: string;
      Cookie: string;
      'X-CSRF-Token': string;
    },
    purpose: 'ASSET_IMAGE' | 'EMPLOYEE_PHOTO',
    targetId?: string,
  ): Promise<UploadIntentResponse> {
    const intent = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose,
        ...(targetId ? { targetId } : {}),
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });
    expect(intent.status).toBe(201);
    const intentBody = responseBody<UploadIntentResponse>(intent);
    const complete = await request(server())
      .post(`/images/uploads/${intentBody.uploadId}/complete`)
      .set(headers)
      .send({
        publicId: intentBody.uploadInstructions.fields.public_id,
        version: 1,
        signature: 'a'.repeat(40),
      });
    expect(complete.status).toBe(200);
    return intentBody;
  }

  async function issueCsrfCookie(sessionCookie: string): Promise<string> {
    const csrf = await request(server())
      .get('/auth/csrf')
      .set('Cookie', sessionCookie);
    expect(csrf.status).toBe(200);
    return `${sessionCookie}; ${cookiePair(csrf, csrfCookieName)}`;
  }

  async function seedUser(
    email: string,
    role: UserRole,
    userName: string,
  ): Promise<string> {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      await prisma.user.delete({ where: { id: existing.id } });
    }
    await app.get(UsersService).create(
      {
        email,
        password: sharedPassword,
        userName,
        firstname: 'Image',
        lastname: 'Test',
        role,
        sectionId,
      },
      'system:image-upload-test',
    );
    const user = await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
      select: { id: true },
    });
    return user.id;
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for image upload tests');
    }
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.IMAGE_UPLOAD_MAX_COMPLETION_ATTEMPTS_PER_INTENT = '2';
    process.env.IMAGE_UPLOAD_MAX_INTENTS_PER_ACTOR_PER_HOUR = '100';
    process.env.IMAGE_CRUD_ATTACHMENT_ENABLED = 'true';
    csrfCookieName =
      process.env.NODE_ENV === 'production' ? '__Host-hams.csrf' : 'hams.csrf';
    const pg = await import('pg');
    pool = new pg.Pool({ connectionString: testDatabaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const imageUploadTable = await pool.query<{ table_name: string | null }>(
      "SELECT to_regclass('public.image_upload')::text AS table_name",
    );
    if (!imageUploadTable.rows[0]?.table_name) {
      throw new Error(
        'Apply the current Prisma schema to TEST_DATABASE_URL before running image upload acceptance tests',
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IMAGE_STORAGE)
      .useValue(storage)
      .overrideProvider(IMAGE_CLOCK)
      .useValue(clock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const section = await prisma.section.upsert({
      where: { code: 'TEST-IMAGE-SEC' },
      update: {},
      create: { code: 'TEST-IMAGE-SEC', name: 'Image Upload Test Section' },
    });
    sectionId = section.id;
    adminId = await seedUser(
      fixtureEmails.admin,
      UserRole.ADMIN,
      'test_image_admin',
    );
    await seedUser(
      fixtureEmails.department,
      UserRole.DEPARTMENT_STAFF,
      'test_image_department',
    );
    const assetCenterId = await seedUser(
      fixtureEmails.assetCenter,
      UserRole.ASSET_CENTER_STAFF,
      'test_image_asset_center',
    );
    const parcelId = await seedUser(
      fixtureEmails.parcel,
      UserRole.PARCEL_STAFF,
      'test_image_parcel',
    );

    const twoFactor = app.get(TwoFactorService);
    const enrollment = await twoFactor.generateSecret(
      adminId,
      fixtureEmails.admin,
    );
    adminTotpSecret = enrollment.secret;
    await twoFactor.verifyPendingEnrollment(
      adminId,
      generateSync({ secret: adminTotpSecret }),
    );
    await twoFactor.confirmBackupCodesSaved(adminId);

    const assetCenterEnrollment = await twoFactor.generateSecret(
      assetCenterId,
      fixtureEmails.assetCenter,
    );
    await twoFactor.verifyPendingEnrollment(
      assetCenterId,
      generateSync({ secret: assetCenterEnrollment.secret }),
    );
    await twoFactor.confirmBackupCodesSaved(assetCenterId);

    const parcelEnrollment = await twoFactor.generateSecret(
      parcelId,
      fixtureEmails.parcel,
    );
    await twoFactor.verifyPendingEnrollment(
      parcelId,
      generateSync({ secret: parcelEnrollment.secret }),
    );
    await twoFactor.confirmBackupCodesSaved(parcelId);

    const adminSignIn = await request(server()).post('/auth/sign-in').send({
      email: fixtureEmails.admin,
      password: sharedPassword,
    });
    expect(adminSignIn.status).toBe(200);
    const adminVerified = await request(server())
      .post('/auth/2fa/verify-totp')
      .set('Cookie', cookiePair(adminSignIn, 'hams.pre_auth'))
      .send({ code: generateSync({ secret: adminTotpSecret }) });
    expect(adminVerified.status).toBe(200);
    adminCookie = sessionCookieHeader(adminVerified);

    const assetCenterSignIn = await request(server())
      .post('/auth/sign-in')
      .send({
        email: fixtureEmails.assetCenter,
        password: sharedPassword,
      });
    expect(assetCenterSignIn.status).toBe(200);
    const assetCenterVerified = await request(server())
      .post('/auth/2fa/verify-totp')
      .set('Cookie', cookiePair(assetCenterSignIn, 'hams.pre_auth'))
      .send({ code: generateSync({ secret: assetCenterEnrollment.secret }) });
    expect(assetCenterVerified.status).toBe(200);
    assetCenterCookie = sessionCookieHeader(assetCenterVerified);

    const parcelSignIn = await request(server()).post('/auth/sign-in').send({
      email: fixtureEmails.parcel,
      password: sharedPassword,
    });
    expect(parcelSignIn.status).toBe(200);
    const parcelVerified = await request(server())
      .post('/auth/2fa/verify-totp')
      .set('Cookie', cookiePair(parcelSignIn, 'hams.pre_auth'))
      .send({ code: generateSync({ secret: parcelEnrollment.secret }) });
    expect(parcelVerified.status).toBe(200);
    parcelCookie = sessionCookieHeader(parcelVerified);

    const departmentSignIn = await request(server())
      .post('/auth/sign-in')
      .send({
        email: fixtureEmails.department,
        password: sharedPassword,
      });
    expect(departmentSignIn.status).toBe(200);
    departmentCookie = sessionCookieHeader(departmentSignIn);
  });

  afterAll(async () => {
    if (prisma) {
      const fixtureUsers = await prisma.user.findMany({
        where: { email: { in: Object.values(fixtureEmails) } },
        select: { id: true },
      });
      const userIds = fixtureUsers.map((user) => user.id);
      try {
        const fixtureUploads = await prisma.imageUpload.findMany({
          where: { uploaderId: { in: userIds } },
          select: { publicId: true },
        });
        await prisma.imageCleanup.deleteMany({
          where: {
            publicId: { in: fixtureUploads.map(({ publicId }) => publicId) },
          },
        });
        await prisma.imageUpload.deleteMany({
          where: { uploaderId: { in: userIds } },
        });
      } catch (error) {
        if (
          !(
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2021'
          )
        ) {
          throw error;
        }
      }
      await prisma.preAuthChallenge.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.twoFactorAuth.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.trustedDevice.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.asset.deleteMany({ where: { id: { in: createdAssetIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.company.deleteMany({ where: { code: 'IMAGE-TEST' } });
      await prisma.assetType.deleteMany({ where: { name: 'Image Test Type' } });
      await prisma.assetStatus.deleteMany({
        where: { code: 'IMAGE_TEST_NORMAL' },
      });
      await prisma.section.deleteMany({ where: { code: 'TEST-IMAGE-SEC' } });
      await prisma.$disconnect();
    }
    if (pool) await pool.end();
    if (app) await app.close();
    if (originalCompletionAttemptLimit === undefined) {
      delete process.env.IMAGE_UPLOAD_MAX_COMPLETION_ATTEMPTS_PER_INTENT;
    } else {
      process.env.IMAGE_UPLOAD_MAX_COMPLETION_ATTEMPTS_PER_INTENT =
        originalCompletionAttemptLimit;
    }
    if (originalIntentLimit === undefined) {
      delete process.env.IMAGE_UPLOAD_MAX_INTENTS_PER_ACTOR_PER_HOUR;
    } else {
      process.env.IMAGE_UPLOAD_MAX_INTENTS_PER_ACTOR_PER_HOUR =
        originalIntentLimit;
    }
    if (originalCrudAttachmentEnabled === undefined) {
      delete process.env.IMAGE_CRUD_ATTACHMENT_ENABLED;
    } else {
      process.env.IMAGE_CRUD_ATTACHMENT_ENABLED = originalCrudAttachmentEnabled;
    }
  });

  beforeEach(() => {
    clock.set(fixedNow);
    storage.failNextInstruction = false;
    storage.failNextVerification = false;
  });

  it('denies unauthenticated upload authorization without creating an intent', async () => {
    const before = storage.createdInstructions.length;
    const response = await request(server()).post('/images/uploads').send({
      purpose: 'ASSET_IMAGE',
      sourceContentType: 'image/jpeg',
      sourceSizeBytes: 1024,
    });

    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(storage.createdInstructions).toHaveLength(before);
  });

  it('requires the purpose-specific role for Employee Photo', async () => {
    const cookie = await issueCsrfCookie(departmentCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const before = storage.createdInstructions.length;
    const response = await request(server())
      .post('/images/uploads')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', decodeURIComponent(csrfToken ?? ''))
      .send({
        purpose: 'EMPLOYEE_PHOTO',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });

    expect(response.status).toBe(403);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(storage.createdInstructions).toHaveLength(before);
  });

  it('rejects a session request without CSRF proof', async () => {
    const before = storage.createdInstructions.length;
    const response = await request(server())
      .post('/images/uploads')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', adminCookie)
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });

    expect(response.status).toBe(403);
    expect(storage.createdInstructions).toHaveLength(before);
  });

  it('creates, verifies, and returns a stable pending Asset Image upload', async () => {
    const cookie = await issueCsrfCookie(adminCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    expect(csrfToken).toBeTruthy();
    const intent = await request(server())
      .post('/images/uploads')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', decodeURIComponent(csrfToken ?? ''))
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 2048,
      });

    expect(intent.status).toBe(201);
    const intentBody = responseBody<UploadIntentResponse>(intent);
    pendingAssetUploadId = intentBody.uploadId;
    expect(intent.headers['cache-control']).toBe('private, no-store');
    expect(intentBody.uploadId).toEqual(expect.any(String));
    expect(intentBody.status).toBe('AUTHORIZED');
    expect(
      Date.parse(intentBody.signatureExpiresAt) -
        Date.parse(intentBody.issuedAt),
    ).toBe(60 * 60 * 1000);
    expect(intentBody.uploadInstructions.method).toBe('POST');
    expect(intentBody.uploadInstructions.url).toContain('cloudinary.test');
    expect(JSON.stringify(intentBody)).not.toContain('test-api-secret');
    expect(JSON.stringify(intentBody)).not.toContain('api_secret');

    const publicId = intentBody.uploadInstructions.fields.public_id;
    const rejectedEvidence = await request(server())
      .post(`/images/uploads/${intentBody.uploadId}/complete`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', decodeURIComponent(csrfToken ?? ''))
      .send({
        publicId: `${publicId}-forged`,
        version: 1,
        signature: 'a'.repeat(40),
      });
    expect(rejectedEvidence.status).toBe(400);

    const complete = () =>
      request(server())
        .post(`/images/uploads/${intentBody.uploadId}/complete`)
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', decodeURIComponent(csrfToken ?? ''))
        .send({
          publicId,
          version: 1,
          signature: 'a'.repeat(40),
        });

    const first = await complete();
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('private, no-store');
    const firstBody = responseBody<UploadStatusResponse>(first);
    expect(firstBody.status).toBe('VERIFIED_PENDING');
    expect(firstBody.verifiedImage).toMatchObject({
      format: 'jpg',
      width: 800,
      height: 600,
      bytes: 1024,
    });
    const attachmentDeadline = firstBody.attachmentExpiresAt;

    const retry = await complete();
    expect(retry.status).toBe(200);
    const retryBody = responseBody<UploadStatusResponse>(retry);
    expect(retryBody.attachmentExpiresAt).toBe(attachmentDeadline);

    const status = await request(server())
      .get(`/images/uploads/${intentBody.uploadId}`)
      .set('Cookie', adminCookie);
    expect(status.status).toBe(200);
    expect(status.headers['cache-control']).toBe('private, no-store');
    const statusBody = responseBody<UploadStatusResponse>(status);
    expect(statusBody.status).toBe('VERIFIED_PENDING');
    expect(statusBody.attachmentExpiresAt).toBe(attachmentDeadline);
  });

  it('allows ASSET_CENTER_STAFF to request an Asset Image', async () => {
    const cookie = await issueCsrfCookie(assetCenterCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const response = await request(server())
      .post('/images/uploads')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', decodeURIComponent(csrfToken ?? ''))
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });

    expect(response.status).toBe(201);
    expect(responseBody<UploadIntentResponse>(response).purpose).toBe(
      'ASSET_IMAGE',
    );
  });

  it('allows ADMIN to create and verify an Employee Photo for their own account', async () => {
    const cookie = await issueCsrfCookie(adminCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const headers = {
      Origin: 'http://localhost:5173',
      Cookie: cookie,
      'X-CSRF-Token': decodeURIComponent(csrfToken ?? ''),
    };
    const intent = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'EMPLOYEE_PHOTO',
        targetId: adminId,
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });

    expect(intent.status).toBe(201);
    const intentBody = responseBody<UploadIntentResponse>(intent);
    expect(intentBody.targetId).toBe(adminId);
    expect(storage.createdInstructions.at(-1)?.deliveryType).toBe(
      'authenticated',
    );
    const complete = await request(server())
      .post(`/images/uploads/${intentBody.uploadId}/complete`)
      .set(headers)
      .send({
        publicId: intentBody.uploadInstructions.fields.public_id,
        version: 1,
        signature: 'a'.repeat(40),
      });
    expect(complete.status).toBe(200);
    expect(responseBody<UploadStatusResponse>(complete).status).toBe(
      'VERIFIED_PENDING',
    );
    expect(storage.verifiedEvidence.at(-1)?.deliveryType).toBe('authenticated');
  });

  it('does not accept Base64, arbitrary URLs, or oversized declared files', async () => {
    const cookie = await issueCsrfCookie(adminCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const headers = {
      Origin: 'http://localhost:5173',
      Cookie: cookie,
      'X-CSRF-Token': decodeURIComponent(csrfToken ?? ''),
    };

    const base64 = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
        dataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      });
    expect(base64.status).toBe(400);

    const arbitraryUrl = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
        url: 'https://untrusted.example/image.jpg',
      });
    expect(arbitraryUrl.status).toBe(400);

    const oversized = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 10_000_001,
      });
    expect(oversized.status).toBe(400);
  });

  it('allows PARCEL_STAFF to request Asset Images but not Employee Photos or another uploader’s status', async () => {
    const cookie = await issueCsrfCookie(parcelCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const headers = {
      Origin: 'http://localhost:5173',
      Cookie: cookie,
      'X-CSRF-Token': decodeURIComponent(csrfToken ?? ''),
    };
    const assetIntent = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });
    expect(assetIntent.status).toBe(201);

    const beforeEmployeeIntent = storage.createdInstructions.length;
    const employeeIntent = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'EMPLOYEE_PHOTO',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });
    expect(employeeIntent.status).toBe(403);
    expect(storage.createdInstructions).toHaveLength(beforeEmployeeIntent);

    const otherUploaderStatus = await request(server())
      .get(`/images/uploads/${pendingAssetUploadId}`)
      .set('Cookie', parcelCookie);
    expect(otherUploaderStatus.status).toBe(404);
  });

  it('rejects forged provider signatures and bounds completion retries', async () => {
    const cookie = await issueCsrfCookie(adminCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const headers = {
      Origin: 'http://localhost:5173',
      Cookie: cookie,
      'X-CSRF-Token': decodeURIComponent(csrfToken ?? ''),
    };
    const intent = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });
    expect(intent.status).toBe(201);
    const intentBody = responseBody<UploadIntentResponse>(intent);

    const complete = (signature: string) =>
      request(server())
        .post(`/images/uploads/${intentBody.uploadId}/complete`)
        .set(headers)
        .send({
          publicId: intentBody.uploadInstructions.fields.public_id,
          version: 1,
          signature,
        });
    const forged = await complete('b'.repeat(40));
    expect(forged.status).toBe(400);
    expect(responseBody<ApiErrorResponse>(forged).code).toBe(
      'UPLOAD_EVIDENCE_INVALID',
    );

    const finalAllowedAttempt = await complete('b'.repeat(40));
    expect(finalAllowedAttempt.status).toBe(400);
    expect(responseBody<ApiErrorResponse>(finalAllowedAttempt).code).toBe(
      'UPLOAD_EVIDENCE_INVALID',
    );

    const limitedRetry = await complete('a'.repeat(40));
    expect(limitedRetry.status).toBe(429);
    expect(responseBody<ApiErrorResponse>(limitedRetry).code).toBe(
      'UPLOAD_RATE_LIMITED',
    );
  });

  it('returns a storage outage and permits retry within the configured attempt budget', async () => {
    const cookie = await issueCsrfCookie(adminCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const headers = {
      Origin: 'http://localhost:5173',
      Cookie: cookie,
      'X-CSRF-Token': decodeURIComponent(csrfToken ?? ''),
    };
    const initialIntentCount = await prisma.imageUpload.count({
      where: { uploaderId: adminId },
    });
    storage.failNextInstruction = true;
    const allocationOutage = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });
    expect(allocationOutage.status).toBe(503);
    expect(responseBody<ApiErrorResponse>(allocationOutage).code).toBe(
      'IMAGE_STORAGE_UNAVAILABLE',
    );
    expect(
      await prisma.imageUpload.count({ where: { uploaderId: adminId } }),
    ).toBe(initialIntentCount);

    const intent = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });
    expect(intent.status).toBe(201);
    const intentBody = responseBody<UploadIntentResponse>(intent);

    storage.failNextVerification = true;
    const complete = () =>
      request(server())
        .post(`/images/uploads/${intentBody.uploadId}/complete`)
        .set(headers)
        .send({
          publicId: intentBody.uploadInstructions.fields.public_id,
          version: 1,
          signature: 'a'.repeat(40),
        });

    const outage = await complete();
    expect(outage.status).toBe(503);
    expect(responseBody<ApiErrorResponse>(outage).code).toBe(
      'IMAGE_STORAGE_UNAVAILABLE',
    );
    const retry = await complete();
    expect(retry.status).toBe(200);
    expect(responseBody<UploadStatusResponse>(retry).status).toBe(
      'VERIFIED_PENDING',
    );
  });

  it('expires a pending image at its exact deadline using the controlled test clock', async () => {
    const cookie = await issueCsrfCookie(adminCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const headers = {
      Origin: 'http://localhost:5173',
      Cookie: cookie,
      'X-CSRF-Token': decodeURIComponent(csrfToken ?? ''),
    };
    const intent = await request(server())
      .post('/images/uploads')
      .set(headers)
      .send({
        purpose: 'ASSET_IMAGE',
        sourceContentType: 'image/jpeg',
        sourceSizeBytes: 1024,
      });
    expect(intent.status).toBe(201);
    const intentBody = responseBody<UploadIntentResponse>(intent);
    const evidence = {
      publicId: intentBody.uploadInstructions.fields.public_id,
      version: 1,
      signature: 'a'.repeat(40),
    };
    const complete = await request(server())
      .post(`/images/uploads/${intentBody.uploadId}/complete`)
      .set(headers)
      .send(evidence);
    expect(complete.status).toBe(200);
    const completeBody = responseBody<UploadStatusResponse>(complete);
    expect(completeBody.status).toBe('VERIFIED_PENDING');

    clock.set(new Date(completeBody.attachmentExpiresAt as string));
    const expired = await request(server())
      .get(`/images/uploads/${intentBody.uploadId}`)
      .set('Cookie', adminCookie);
    expect(expired.status).toBe(200);
    const expiredBody = responseBody<UploadStatusResponse>(expired);
    expect(expiredBody.status).toBe('EXPIRED');
    expect(expiredBody.attachmentExpiresAt).toBe(
      completeBody.attachmentExpiresAt,
    );
    const persisted = await prisma.imageUpload.findUniqueOrThrow({
      where: { id: intentBody.uploadId },
      select: { status: true },
    });
    expect(persisted.status).toBe('EXPIRED');
  });

  it('attaches a verified Asset Image through the existing asset create endpoint', async () => {
    const cookie = await issueCsrfCookie(adminCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const headers = {
      Origin: 'http://localhost:5173',
      Cookie: cookie,
      'X-CSRF-Token': decodeURIComponent(csrfToken ?? ''),
    };
    const [company, status, existingType] = await Promise.all([
      prisma.company.upsert({
        where: { code: 'IMAGE-TEST' },
        update: {},
        create: { code: 'IMAGE-TEST', name: 'Image Test Company' },
      }),
      prisma.assetStatus.upsert({
        where: { code: 'IMAGE_TEST_NORMAL' },
        update: {},
        create: { code: 'IMAGE_TEST_NORMAL', name: 'Image Test Normal' },
      }),
      prisma.assetType.findFirst({ where: { name: 'Image Test Type' } }),
    ]);
    const assetType =
      existingType ??
      (await prisma.assetType.create({
        data: { name: 'Image Test Type', useful_life: 5 },
      }));
    const intentBody = await createVerifiedUpload(headers, 'ASSET_IMAGE');

    const assetBasePayload = {
      noid: 'TICKET-02-IMAGE',
      name: 'Ticket 02 image attachment',
      model: 'TEST-IMAGE',
      budgetType: 'TEST',
      acqType: 'TEST',
      acqDoc: 'TICKET-02',
      price: '1000',
      pmType: 'IM',
      calType: 'IC',
      riskLevel: 'MEDIUM',
      receivedDate: '2026-10-01T00:00:00.000Z',
      section_id: sectionId,
      company_id: company.id,
      type_id: assetType.id,
      asset_status_id: status.id,
      owner_id: adminId,
    };
    const payload = {
      ...assetBasePayload,
      imageUploadId: intentBody.uploadId,
      imageCreationContextToken: intentBody.creationContextToken,
    };
    const created = await request(server())
      .post('/asset')
      .set(headers)
      .send(payload);
    if (created.status !== 201) {
      throw new Error(JSON.stringify(created.body));
    }
    expect(created.status).toBe(201);
    const createdBody = responseBody<{ id: string; imageUrl: string }>(created);
    createdAssetIds.push(createdBody.id);

    const record = await prisma.asset.findUniqueOrThrow({
      where: { id: createdBody.id },
    });
    expect(record.imageUrl).toBe(
      `https://images.test/image/upload/v1/${intentBody.uploadInstructions.fields.public_id}.jpg`,
    );
    const upload = await prisma.imageUpload.findUniqueOrThrow({
      where: { id: intentBody.uploadId },
    });
    expect(upload.status).toBe('CLAIMED');
    expect(upload.claimedTargetId).toBe(record.id);
    await expect(
      prisma.$executeRaw`
        UPDATE "asset"
        SET "image_public_id" = NULL
        WHERE "asset_id" = ${record.id}
      `,
    ).rejects.toThrow(/asset_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "asset"
        SET "image_storage_provider" = NULL
        WHERE "asset_id" = ${record.id}
      `,
    ).rejects.toThrow(/asset_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "asset"
        SET "image_storage_account_id" = NULL
        WHERE "asset_id" = ${record.id}
      `,
    ).rejects.toThrow(/asset_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "asset"
        SET "image_resource_type" = NULL
        WHERE "asset_id" = ${record.id}
      `,
    ).rejects.toThrow(/asset_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "asset"
        SET "image_delivery_type" = NULL
        WHERE "asset_id" = ${record.id}
      `,
    ).rejects.toThrow(/asset_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "asset"
        SET "image_version" = NULL
        WHERE "asset_id" = ${record.id}
      `,
    ).rejects.toThrow(/asset_image_locator_complete_check/);

    const createRetry = await request(server())
      .post('/asset')
      .set(headers)
      .send(payload);
    expect(createRetry.status).toBe(201);
    expect(responseBody<{ id: string }>(createRetry).id).toBe(record.id);
    expect(
      await prisma.asset.count({ where: { noid: 'TICKET-02-IMAGE' } }),
    ).toBe(1);

    const siblingResponse = await request(server())
      .post('/asset')
      .set(headers)
      .send({ ...assetBasePayload, noid: 'TICKET-02-OTHER' });
    expect(siblingResponse.status).toBe(201);
    const sibling = responseBody<{ id: string }>(siblingResponse);
    createdAssetIds.push(sibling.id);

    const wrongTargetUpload = await createVerifiedUpload(
      headers,
      'ASSET_IMAGE',
      sibling.id,
    );
    const wrongTargetSave = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ imageUploadId: wrongTargetUpload.uploadId });
    expect(wrongTargetSave.status).toBe(409);
    expect(
      (
        await prisma.imageUpload.findUniqueOrThrow({
          where: { id: wrongTargetUpload.uploadId },
        })
      ).status,
    ).toBe('VERIFIED_PENDING');

    const wrongPurposeUpload = await createVerifiedUpload(
      headers,
      'EMPLOYEE_PHOTO',
      adminId,
    );
    const wrongPurposeSave = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ imageUploadId: wrongPurposeUpload.uploadId });
    expect(wrongPurposeSave.status).toBe(409);
    expect(
      (
        await prisma.imageUpload.findUniqueOrThrow({
          where: { id: wrongPurposeUpload.uploadId },
        })
      ).status,
    ).toBe('VERIFIED_PENDING');

    const otherUploaderCookie = await issueCsrfCookie(assetCenterCookie);
    const otherUploaderCsrf = otherUploaderCookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const otherUploaderHeaders = {
      Origin: 'http://localhost:5173',
      Cookie: otherUploaderCookie,
      'X-CSRF-Token': decodeURIComponent(otherUploaderCsrf ?? ''),
    };
    const wrongOwnerUpload = await createVerifiedUpload(
      otherUploaderHeaders,
      'ASSET_IMAGE',
      record.id,
    );
    const wrongOwnerSave = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ imageUploadId: wrongOwnerUpload.uploadId });
    expect(wrongOwnerSave.status).toBe(404);
    expect(
      (
        await prisma.imageUpload.findUniqueOrThrow({
          where: { id: wrongOwnerUpload.uploadId },
        })
      ).status,
    ).toBe('VERIFIED_PENDING');

    const omittedImage = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ remark: 'photo field omitted' });
    expect(omittedImage.status).toBe(200);
    const nullImage = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ imageUrl: null });
    expect(nullImage.status).toBe(200);
    const emptyUploadReference = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ imageUploadId: '' });
    expect(emptyUploadReference.status).toBe(400);
    const nullUploadReference = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ imageUploadId: null });
    expect(nullUploadReference.status).toBe(200);
    const preserved = await prisma.asset.findUniqueOrThrow({
      where: { id: record.id },
    });
    expect(preserved.imagePublicId).toBe(upload.publicId);
    expect(preserved.imageUrl).toBe(record.imageUrl);

    const replacement = await createVerifiedUpload(
      headers,
      'ASSET_IMAGE',
      record.id,
    );
    const replacementBody = {
      imageUploadId: replacement.uploadId,
      name: 'Asset metadata saved with replacement B',
    };
    const attachedReplacement = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send(replacementBody);
    expect(attachedReplacement.status).toBe(200);
    const replacementRecord = await prisma.asset.findUniqueOrThrow({
      where: { id: record.id },
    });
    expect(replacementRecord.imagePublicId).toBe(
      replacement.uploadInstructions.fields.public_id,
    );
    const replacementRetry = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send(replacementBody);
    expect(replacementRetry.status).toBe(200);
    expect(
      (
        await prisma.imageUpload.findUniqueOrThrow({
          where: { id: replacement.uploadId },
        })
      ).status,
    ).toBe('CLAIMED');

    const failedSaveUpload = await createVerifiedUpload(
      headers,
      'ASSET_IMAGE',
      record.id,
    );
    const failedSave = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ imageUploadId: failedSaveUpload.uploadId, type_id: 2147483647 });
    expect(failedSave.status).toBeGreaterThanOrEqual(400);
    const afterFailedSave = await prisma.asset.findUniqueOrThrow({
      where: { id: record.id },
    });
    expect(afterFailedSave.imagePublicId).toBe(
      replacement.uploadInstructions.fields.public_id,
    );
    expect(
      (
        await prisma.imageUpload.findUniqueOrThrow({
          where: { id: failedSaveUpload.uploadId },
        })
      ).status,
    ).toBe('VERIFIED_PENDING');

    const concurrentUploads = [
      await createVerifiedUpload(headers, 'ASSET_IMAGE', record.id),
      await createVerifiedUpload(headers, 'ASSET_IMAGE', record.id),
    ];
    const concurrentSaves = await Promise.all(
      concurrentUploads.map((concurrentUpload, index) =>
        request(server())
          .patch(`/asset/${record.id}`)
          .set(headers)
          .send({
            imageUploadId: concurrentUpload.uploadId,
            name: `Asset metadata saved with concurrent ${index}`,
          }),
      ),
    );
    expect(concurrentSaves.map(({ status: httpStatus }) => httpStatus)).toEqual(
      [200, 200],
    );
    const concurrentUploadRows = await prisma.imageUpload.findMany({
      where: { id: { in: concurrentUploads.map(({ uploadId }) => uploadId) } },
    });
    expect(
      concurrentUploadRows
        .map(({ status: uploadStatus }) => uploadStatus)
        .sort(),
    ).toEqual(['CLAIMED', 'SUPERSEDED']);
    const supersededConcurrentUpload = concurrentUploadRows.find(
      ({ status: uploadStatus }) => uploadStatus === 'SUPERSEDED',
    );
    if (!supersededConcurrentUpload) {
      throw new Error('No concurrent replacement was marked superseded');
    }
    const finalAsset = await prisma.asset.findUniqueOrThrow({
      where: { id: record.id },
    });
    expect(
      concurrentUploads.some(
        ({ uploadInstructions }) =>
          uploadInstructions.fields.public_id === finalAsset.imagePublicId,
      ),
    ).toBe(true);
    const winningUploadIndex = concurrentUploads.findIndex(
      ({ uploadInstructions }) =>
        uploadInstructions.fields.public_id === finalAsset.imagePublicId,
    );
    expect(finalAsset.name).toBe(
      `Asset metadata saved with concurrent ${winningUploadIndex}`,
    );
    const staleMetadataOnlyEdit = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ remark: 'stale metadata-only edit' });
    expect(staleMetadataOnlyEdit.status).toBe(200);
    expect(
      (await prisma.asset.findUniqueOrThrow({ where: { id: record.id } }))
        .imagePublicId,
    ).toBe(finalAsset.imagePublicId);
    const supersededUpdateRetry = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send(replacementBody);
    expect(supersededUpdateRetry.status).toBe(200);
    const afterStaleRetry = await prisma.asset.findUniqueOrThrow({
      where: { id: record.id },
    });
    expect(afterStaleRetry.imagePublicId).toBe(finalAsset.imagePublicId);
    expect(afterStaleRetry.name).toBe(finalAsset.name);
    const cleanupRows = await prisma.imageCleanup.findMany({
      where: {
        publicId: {
          in: [
            upload.publicId,
            replacement.uploadInstructions.fields.public_id,
            supersededConcurrentUpload.publicId,
          ],
        },
      },
    });
    expect(cleanupRows.map(({ publicId }) => publicId).sort()).toEqual(
      [
        upload.publicId,
        replacement.uploadInstructions.fields.public_id,
        supersededConcurrentUpload.publicId,
      ].sort(),
    );
    expect(storage.deleteCalls).toHaveLength(0);

    const supersededCreateRetry = await request(server())
      .post('/asset')
      .set(headers)
      .send(payload);
    expect(supersededCreateRetry.status).toBe(201);
    const afterCreateRetry = await prisma.asset.findUniqueOrThrow({
      where: { id: record.id },
    });
    expect(afterCreateRetry.imagePublicId).toBe(finalAsset.imagePublicId);
    expect(afterCreateRetry.name).toBe(finalAsset.name);

    const expiringUpload = await createVerifiedUpload(
      headers,
      'ASSET_IMAGE',
      record.id,
    );
    clock.set(new Date(fixedNow.getTime() + 60 * 60 * 1000));
    const expiredSave = await request(server())
      .patch(`/asset/${record.id}`)
      .set(headers)
      .send({ imageUploadId: expiringUpload.uploadId });
    expect(expiredSave.status).toBe(410);
    expect(
      (await prisma.asset.findUniqueOrThrow({ where: { id: record.id } }))
        .imagePublicId,
    ).toBe(finalAsset.imagePublicId);
  });

  it('creates and updates an Employee Photo transactionally and compensates failed account creation', async () => {
    const cookie = await issueCsrfCookie(adminCookie);
    const csrfToken = cookie
      .split(`${csrfCookieName}=`)
      .at(-1)
      ?.split(';', 1)[0];
    const headers = {
      Origin: 'http://localhost:5173',
      Cookie: cookie,
      'X-CSRF-Token': decodeURIComponent(csrfToken ?? ''),
    };
    const intent = await createVerifiedUpload(headers, 'EMPLOYEE_PHOTO');
    const createUserPayload = {
      userName: 'ticket02-image-user',
      firstname: 'Ticket Two',
      lastname: 'Image User',
      email: fixtureEmails.ticket02Employee,
      password: sharedPassword,
      role: 'DEPARTMENT_STAFF',
      sectionId,
      imageUploadId: intent.uploadId,
      imageCreationContextToken: intent.creationContextToken,
    };
    const created = await request(server())
      .post('/users')
      .set(headers)
      .send(createUserPayload);
    expect(created.status).toBe(201);
    const createdBody = responseBody<{ id: string }>(created);
    const employee = await prisma.user.findUniqueOrThrow({
      where: { id: createdBody.id },
    });
    expect(employee.imageUrl).toBeNull();
    expect(employee.imagePublicId).toBe(
      intent.uploadInstructions.fields.public_id,
    );
    await expect(
      prisma.$executeRaw`
        UPDATE "users"
        SET "image_storage_provider" = NULL
        WHERE "id" = ${employee.id}
      `,
    ).rejects.toThrow(/users_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "users"
        SET "image_storage_account_id" = NULL
        WHERE "id" = ${employee.id}
      `,
    ).rejects.toThrow(/users_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "users"
        SET "image_public_id" = NULL
        WHERE "id" = ${employee.id}
      `,
    ).rejects.toThrow(/users_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "users"
        SET "image_resource_type" = NULL
        WHERE "id" = ${employee.id}
      `,
    ).rejects.toThrow(/users_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "users"
        SET "image_delivery_type" = NULL
        WHERE "id" = ${employee.id}
      `,
    ).rejects.toThrow(/users_image_locator_complete_check/);
    await expect(
      prisma.$executeRaw`
        UPDATE "users"
        SET "image_version" = NULL
        WHERE "id" = ${employee.id}
      `,
    ).rejects.toThrow(/users_image_locator_complete_check/);
    expect(
      (
        await prisma.imageUpload.findUniqueOrThrow({
          where: { id: intent.uploadId },
        })
      ).claimedTargetId,
    ).toBe(employee.id);

    const createRetry = await request(server())
      .post('/users')
      .set(headers)
      .send(createUserPayload);
    expect(createRetry.status).toBe(201);
    expect(responseBody<{ id: string }>(createRetry).id).toBe(employee.id);
    expect(
      await prisma.user.count({
        where: { email: fixtureEmails.ticket02Employee },
      }),
    ).toBe(1);

    const updateIntent = await createVerifiedUpload(
      headers,
      'EMPLOYEE_PHOTO',
      employee.id,
    );
    const updatePhoto = await request(server())
      .patch(`/users/${employee.id}`)
      .set(headers)
      .send({ imageUploadId: updateIntent.uploadId });
    expect(updatePhoto.status).toBe(200);
    const updatedEmployee = await prisma.user.findUniqueOrThrow({
      where: { id: employee.id },
    });
    expect(updatedEmployee.imageUrl).toBeNull();
    expect(updatedEmployee.imagePublicId).toBe(
      updateIntent.uploadInstructions.fields.public_id,
    );
    expect(
      (
        await prisma.imageUpload.findUniqueOrThrow({
          where: { id: intent.uploadId },
        })
      ).status,
    ).toBe('SUPERSEDED');
    expect(
      await prisma.imageCleanup.findFirst({
        where: {
          storageProvider: 'cloudinary',
          storageAccountId: 'test-cloud',
          publicId: intent.uploadInstructions.fields.public_id,
          resourceType: 'image',
          deliveryType: 'authenticated',
        },
      }),
    ).not.toBeNull();

    const staleProfileEdit = await request(server())
      .patch(`/users/${employee.id}`)
      .set(headers)
      .send({ firstname: 'Profile Updated' });
    expect(staleProfileEdit.status).toBe(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: employee.id } }))
        .imagePublicId,
    ).toBe(updateIntent.uploadInstructions.fields.public_id);

    const rollbackIntent = await createVerifiedUpload(
      headers,
      'EMPLOYEE_PHOTO',
    );
    const usersService = app.get(UsersService);
    const auditSpy = jest
      .spyOn(
        usersService as unknown as {
          recordSecurityAudit: () => Promise<void>;
        },
        'recordSecurityAudit',
      )
      .mockRejectedValueOnce(new Error('force transaction rollback in test'));
    try {
      const failedCreate = await request(server())
        .post('/users')
        .set(headers)
        .send({
          ...createUserPayload,
          userName: 'ticket02-rollback-user',
          email: fixtureEmails.ticket02Rollback,
          imageUploadId: rollbackIntent.uploadId,
          imageCreationContextToken: rollbackIntent.creationContextToken,
        });
      expect(failedCreate.status).toBeGreaterThanOrEqual(500);
    } finally {
      auditSpy.mockRestore();
    }
    expect(
      await prisma.user.findUnique({
        where: { email: fixtureEmails.ticket02Rollback },
      }),
    ).toBeNull();
    expect(
      (
        await prisma.imageUpload.findUniqueOrThrow({
          where: { id: rollbackIntent.uploadId },
        })
      ).status,
    ).toBe('VERIFIED_PENDING');
  });
});
