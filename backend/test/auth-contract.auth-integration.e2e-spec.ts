/**
 * Auth Contract Integration Tests — Ticket 01
 *
 * These tests exercise the REAL BetterAuth integration against a disposable
 * TEST_DATABASE_URL. They do NOT mock the AuthGuard, better-auth module, or
 * any session middleware. The goal is to prove the observable HTTP contract
 * documented in docs/auth-api-contract.md.
 *
 * Prerequisites:
 *   - TEST_DATABASE_URL environment variable pointing to a clean PostgreSQL DB
 *   - `npx prisma migrate deploy` run against that DB
 *
 * Run:
 *   $env:TEST_DATABASE_URL = "postgresql://..."
 *   npx jest --config ./test/jest-auth-integration.json --runInBand
 */

import 'dotenv/config';
import type { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';

// The setup file rejects missing or unsafe TEST_DATABASE_URL values before this suite loads.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = describe;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return all Set-Cookie header values without changing their attributes. */
function setCookies(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as string | string[] | undefined;
  return Array.isArray(header) ? header : header ? [header] : [];
}

function extractCookie(res: request.Response, name: string): string | null {
  return (
    setCookies(res).find((cookie) => cookie.startsWith(`${name}=`)) ?? null
  );
}

function isHttpOnly(res: request.Response, name: string): boolean {
  const cookie = extractCookie(res, name);
  return cookie !== null && /(?:^|;)\s*HttpOnly(?:;|$)/i.test(cookie);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describeWithDatabase(
  'Auth Contract (HTTP + Real BetterAuth + PostgreSQL)',
  () => {
    let app: INestApplication;
    let prisma: PrismaClient;
    let pool: import('pg').Pool | undefined;
    let testSectionId: string;

    // Fixture accounts use UsersService so BetterAuth hashes their passwords.
    const testEmail = {
      admin: 'test-admin-01@hams-test.local',
      parcel: 'test-parcel-01@hams-test.local',
      dept: 'test-dept-01@hams-test.local',
    };
    const sharedPassword = 'TestPassword@1234!';

    const server = () => app.getHttpServer() as Server;

    // -----------------------------------------------------------------------
    // App bootstrap — uses real BetterAuth & real Prisma adapter
    // -----------------------------------------------------------------------
    beforeAll(async () => {
      // Real Prisma connected to test DB (DATABASE_URL was set by setup file)
      const pg = await import('pg');
      pool = new pg.Pool({ connectionString: testDatabaseUrl });
      const adapter = new PrismaPg(pool);
      prisma = new PrismaClient({ adapter } as any);

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();

      const testSection = await prisma.section.upsert({
        where: { code: 'TEST-AUTH-SEC' },
        update: {},
        create: {
          code: 'TEST-AUTH-SEC',
          name: 'Test Auth Section',
        },
      });
      testSectionId = testSection.id;
    });

    async function seedUser(
      email: string,
      role: 'ADMIN' | 'PARCEL_STAFF' | 'DEPARTMENT_STAFF',
      userName: string,
    ) {
      await prisma.user.deleteMany({ where: { email } });

      const usersService = app.get(UsersService);
      await usersService.create({
        email,
        password: sharedPassword,
        userName,
        firstname: 'Test',
        lastname: role,
        role: role as UserRole,
        sectionId: testSectionId,
      });

      await prisma.user.updateMany({
        where: { email },
        data: { emailVerified: true },
      });
    }

    afterAll(async () => {
      // Clean up test accounts to keep the DB tidy between runs
      try {
        await prisma.user.deleteMany({
          where: {
            email: {
              in: [
                ...Object.values(testEmail),
                'test-change-pwd@hams-test.local',
              ],
            },
          },
        });
        await prisma.section.deleteMany({
          where: { code: 'TEST-AUTH-SEC' },
        });
      } catch {
        // Ignore — table may not exist on a fresh DB
      }
      await prisma.$disconnect();
      if (pool) {
        await pool.end();
      }
      await app.close();
    });

    // -----------------------------------------------------------------------
    // § 10: Public self-signup is disabled
    // -----------------------------------------------------------------------
    describe('Public self-signup is disabled', () => {
      it('POST /api/auth/sign-up/email -> 403 PUBLIC_SIGNUP_DISABLED', async () => {
        const res = await request(server())
          .post('/api/auth/sign-up/email')
          .send({
            email: 'attacker@evil.com',
            password: 'Hacker@1234',
            name: 'Hacker',
          });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('PUBLIC_SIGNUP_DISABLED');
      });
    });

    // -----------------------------------------------------------------------
    // § 4.1 / § 4.2: Non-mandatory role — password-only sign-in
    // -----------------------------------------------------------------------
    describe('Current password sign-in transport (until tickets 02 and 23)', () => {
      let sessionToken: string;
      let sessionCookie: string;

      beforeAll(async () => {
        await seedUser(testEmail.dept, 'DEPARTMENT_STAFF', 'test_dept_01');
      });

      it('authenticates a non-mandatory Role through real BetterAuth', async () => {
        const res = await request(server()).post('/auth/sign-in').send({
          email: testEmail.dept,
          password: sharedPassword,
        });

        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(0);
        expect(res.body.user).toHaveProperty('email', testEmail.dept);
        sessionToken = res.body.token;

        // Store session cookie for ticket 02 tests
        const cookie = extractCookie(res, 'better-auth.session_token');
        if (cookie) {
          sessionCookie = cookie;
        }
      });

      it('reads the authenticated session via Bearer token', async () => {
        expect(sessionToken).toBeTruthy();
        const res = await request(server())
          .get('/auth/session')
          .set('Authorization', 'Bearer ' + sessionToken);

        expect(res.status).toBe(200);
        expect(res.body.session).toHaveProperty('userId');
        expect(res.headers['cache-control']).toBe('no-store');
      });

      it('reads the authenticated session via Cookie (ticket 02)', async () => {
        expect(sessionCookie).toBeTruthy();
        const res = await request(server())
          .get('/auth/session')
          .set('Cookie', sessionCookie);

        expect(res.status).toBe(200);
        expect(res.body.session).toHaveProperty('userId');
        expect(res.headers['cache-control']).toBe('no-store');
      });

      it('revokes the session on sign-out', async () => {
        expect(sessionToken).toBeTruthy();
        const signedOut = await request(server())
          .post('/auth/sign-out')
          .set('Authorization', 'Bearer ' + sessionToken);

        expect(signedOut.status).toBe(200);

        // Verify cookie was cleared
        const cookieHeaders = setCookies(signedOut);
        const clearedCookie = cookieHeaders.find((c) =>
          c.startsWith('better-auth.session_token='),
        );
        expect(clearedCookie).toBeTruthy();
        expect(clearedCookie).toMatch(/Max-Age=0|expires=.*Thu.*01.*Jan.*1970/i);

        const afterSignOut = await request(server())
          .get('/auth/session')
          .set('Authorization', 'Bearer ' + sessionToken);

        expect(afterSignOut.status).toBe(200);
        expect(afterSignOut.body.session).toBeNull();
      });
    });

    // Ticket 02 adds the cookie assertion. Ticket 23 removes the legacy
    // browser-visible token after the Frontend migration is complete.
    it('sets an HttpOnly Session Cookie (ticket 02)', async () => {
      const res = await request(server()).post('/auth/sign-in').send({
        email: testEmail.dept,
        password: sharedPassword,
      });
      expect(res.status).toBe(200);
      expect(isHttpOnly(res, 'better-auth.session_token')).toBe(true);
    });

    it.skip('keeps the Session Token out of JSON (ticket 23)', async () => {
      const res = await request(server()).post('/auth/sign-in').send({
        email: testEmail.dept,
        password: sharedPassword,
      });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('token');
      expect(res.body).not.toHaveProperty('sessionToken');
      expect(res.body).not.toHaveProperty('accessToken');
    });

    // -----------------------------------------------------------------------
    // § 3: Mandatory Role — enrollment gate
    // -----------------------------------------------------------------------
    describe.skip('Mandatory Role: enrollment gate (ticket 03)', () => {
      let preAuthCookie: string;

      beforeAll(async () => {
        await seedUser(testEmail.admin, 'ADMIN', 'test_admin_01');
      });

      it('issues only pre-auth state after password verification', async () => {
        const res = await request(server()).post('/auth/sign-in').send({
          email: testEmail.admin,
          password: sharedPassword,
        });

        expect(res.status).toBe(200);
        expect(res.body.requiresTwoFactor).toBe(true);
        expect(res.body).not.toHaveProperty('token');
        preAuthCookie = extractCookie(res, 'hams.pre_auth') ?? '';
        expect(preAuthCookie).toBeTruthy();
      });

      it('rejects Business API access with the pre-auth cookie', async () => {
        expect(preAuthCookie).toBeTruthy();
        const res = await request(server())
          .get('/users')
          .set('Cookie', preAuthCookie);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ENROLLMENT_REQUIRED');
      });
    });

    // -----------------------------------------------------------------------
    // § 4.4: CSRF endpoint
    // -----------------------------------------------------------------------
    describe('CSRF proof for anonymous and pre-auth states (ticket 02)', () => {
      it('GET /auth/csrf issues a proof before sign-in', async () => {
        const res = await request(server()).get('/auth/csrf');
        expect(res.status).toBe(200);
        expect(typeof res.body.csrfToken).toBe('string');
        expect(res.body.csrfToken.length).toBeGreaterThan(0);
      });
    });

    // -----------------------------------------------------------------------
    // § 4.1: Invalid credentials
    // -----------------------------------------------------------------------
    describe('Sign-in: error cases', () => {
      it('returns 401 INVALID_CREDENTIALS for wrong password', async () => {
        const res = await request(server()).post('/auth/sign-in').send({
          email: testEmail.dept,
          password: 'WrongPassword999!',
        });

        expect(res.status).toBe(401);
      });

      it('returns 401 for non-existent email', async () => {
        const res = await request(server()).post('/auth/sign-in').send({
          email: 'nobody@nowhere.invalid',
          password: 'AnyPassword@1',
        });

        expect(res.status).toBe(401);
      });
    });

    // -----------------------------------------------------------------------
    // § 4.12 / § 9: Change password (self-service)
    // -----------------------------------------------------------------------
    describe('Change password (current transport)', () => {
      const changeEmail = 'test-change-pwd@hams-test.local';
      const newPassword = 'NewPassword@5678!';
      let activeToken: string;

      beforeAll(async () => {
        await seedUser(changeEmail, 'DEPARTMENT_STAFF', 'test_change_pwd_01');
        const signInRes = await request(server()).post('/auth/sign-in').send({
          email: changeEmail,
          password: sharedPassword,
        });
        expect(signInRes.status).toBe(200);
        expect(typeof signInRes.body.token).toBe('string');
        activeToken = signInRes.body.token;
      });

      it('changes the password with the current password', async () => {
        expect(activeToken).toBeTruthy();
        const res = await request(server())
          .post('/auth/change-password')
          .set('Authorization', 'Bearer ' + activeToken)
          .send({ currentPassword: sharedPassword, newPassword });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
      });

      it('accepts the new password', async () => {
        const res = await request(server()).post('/auth/sign-in').send({
          email: changeEmail,
          password: newPassword,
        });
        expect(res.status).toBe(200);
      });

      it('rejects the old password', async () => {
        const res = await request(server()).post('/auth/sign-in').send({
          email: changeEmail,
          password: sharedPassword,
        });
        expect(res.status).toBe(401);
      });
    });

    // -----------------------------------------------------------------------
    // § 4.2: Session endpoint shape
    // -----------------------------------------------------------------------
    describe('GET /auth/session without cookie', () => {
      it('returns 200 with null session when unauthenticated', async () => {
        const res = await request(server()).get('/auth/session');

        expect(res.status).toBe(200);
        expect(res.body.session).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    // § 11: HAMS account route and direct BetterAuth admin boundary
    // -----------------------------------------------------------------------
    describe('HAMS account creation and direct BetterAuth boundary', () => {
      const createdEmail = 'test-created-by-admin@hams-test.local';

      beforeAll(async () => {
        await seedUser(testEmail.admin, 'ADMIN', 'test_admin_01');
      });

      afterAll(async () => {
        await prisma.user.deleteMany({ where: { email: createdEmail } });
      });

      it('rejects an unauthenticated HAMS account creation request', async () => {
        const res = await request(server()).post('/users').send({
          email: 'sneaky@outside.com',
          password: 'Password@1234',
          userName: 'sneaky',
          firstname: 'Sneaky',
          lastname: 'User',
          role: 'DEPARTMENT_STAFF',
          sectionId: testSectionId,
        });
        expect(res.status).toBe(401);
      });

      it('blocks a direct BetterAuth admin route without a session', async () => {
        const res = await request(server())
          .post('/api/auth/admin/create-user')
          .send({
            email: 'sneaky@outside.com',
            password: sharedPassword,
            name: 'Sneaky',
          });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('DIRECT_ADMIN_ROUTE_DISABLED');
      });

      it('blocks a direct BetterAuth admin route for non-ADMIN', async () => {
        const signedIn = await request(server()).post('/auth/sign-in').send({
          email: testEmail.dept,
          password: sharedPassword,
        });
        expect(signedIn.status).toBe(200);
        expect(typeof signedIn.body.token).toBe('string');

        const res = await request(server())
          .post('/api/auth/admin/set-user-password')
          .set('Authorization', 'Bearer ' + signedIn.body.token)
          .send({ userId: 'unknown', newPassword: sharedPassword });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('DIRECT_ADMIN_ROUTE_DISABLED');
      });

      it('allows an ADMIN through the HAMS account route', async () => {
        const signedIn = await request(server()).post('/auth/sign-in').send({
          email: testEmail.admin,
          password: sharedPassword,
        });
        expect(signedIn.status).toBe(200);
        expect(typeof signedIn.body.token).toBe('string');

        const res = await request(server())
          .post('/users')
          .set('Authorization', 'Bearer ' + signedIn.body.token)
          .send({
            email: createdEmail,
            password: sharedPassword,
            userName: 'test_created_by_admin',
            firstname: 'Created',
            lastname: 'By Admin',
            role: 'DEPARTMENT_STAFF',
            sectionId: testSectionId,
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('email', createdEmail);
      });
    });
  },
);
