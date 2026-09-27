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
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { generateSync } from 'otplib';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { TwoFactorService } from '../src/auth/two-factor.service';
import { auth } from '../src/auth/auth';

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

function cookiePair(res: request.Response, name: string): string {
  const cookie = extractCookie(res, name);
  return cookie ? cookie.split(';', 1)[0] : '';
}

function sessionCookieHeader(res: request.Response): string {
  return setCookies(res)
    .filter((cookie) =>
      /^(?:__Secure-)?better-auth\.session_(?:token|data)(?:\.\d+)?=/i.test(
        cookie,
      ),
    )
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
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
      process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);
      // Real Prisma connected to test DB (DATABASE_URL was set by setup file)
      const pg = await import('pg');
      pool = new pg.Pool({ connectionString: testDatabaseUrl });
      const adapter = new PrismaPg(pool);
      prisma = new PrismaClient({ adapter });

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
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        await prisma.preAuthChallenge.deleteMany({
          where: { userId: existingUser.id },
        });
        await prisma.twoFactorAuth.deleteMany({
          where: { userId: existingUser.id },
        });
        await prisma.trustedDevice.deleteMany({
          where: { userId: existingUser.id },
        });
        await prisma.user.deleteMany({ where: { id: existingUser.id } });
      }

      const usersService = app.get(UsersService);
      await usersService.create(
        {
          email,
          password: sharedPassword,
          userName,
          firstname: 'Test',
          lastname: role,
          role: role,
          sectionId: testSectionId,
        },
        'system:auth-integration-fixture',
      );

      await prisma.user.updateMany({
        where: { email },
        data: { emailVerified: true },
      });
    }

    afterAll(async () => {
      try {
        const fixtureEmails = [
          ...Object.values(testEmail),
          'test-change-pwd@hams-test.local',
        ];
        const fixtures = await prisma.user.findMany({
          where: { email: { in: fixtureEmails } },
          select: { id: true },
        });
        const fixtureUserIds = fixtures.map((user) => user.id);
        await prisma.preAuthChallenge.deleteMany({
          where: { userId: { in: fixtureUserIds } },
        });
        await prisma.twoFactorAuth.deleteMany({
          where: { userId: { in: fixtureUserIds } },
        });
        await prisma.trustedDevice.deleteMany({
          where: { userId: { in: fixtureUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: fixtureUserIds } },
        });
        await prisma.section.deleteMany({ where: { code: 'TEST-AUTH-SEC' } });
      } catch {
        // Ignore a partial cleanup after a failed test setup.
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
    describe('Cookie-only password sign-in transport (ticket 13)', () => {
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
        expect(res.body).not.toHaveProperty('token');
        expect(res.body).not.toHaveProperty('sessionToken');
        expect(res.body).not.toHaveProperty('accessToken');
        expect(res.body.user).toHaveProperty('email', testEmail.dept);
        const cookieToken = cookiePair(res, 'better-auth.session_token').split(
          '=',
          2,
        )[1];
        expect(cookieToken).toBeTruthy();
        sessionToken = cookieToken.split('.', 1)[0];
        expect(JSON.stringify(res.body)).not.toContain(sessionToken);

        // The browser receives only the HttpOnly Cookie, never the token in JSON.
        sessionCookie = sessionCookieHeader(res);
      });

      it('does not restore a session from a legacy Bearer token', async () => {
        expect(sessionToken).toBeTruthy();
        const res = await request(server())
          .get('/auth/session')
          .set('Authorization', 'Bearer ' + sessionToken);

        expect(res.status).toBe(200);
        expect(res.body.session).toBeNull();
        expect(res.headers['cache-control']).toBe('no-store');
      });

      it('rejects a legacy Bearer token on Business APIs', async () => {
        const res = await request(server())
          .get('/users')
          .set('Authorization', 'Bearer ' + sessionToken);

        expect(res.status).toBe(401);
      });

      it('restores the authenticated session via Cookie without returning its token', async () => {
        expect(sessionCookie).toBeTruthy();
        const res = await request(server())
          .get('/auth/session')
          .set('Cookie', sessionCookie);

        expect(res.status).toBe(200);
        expect(res.body.session).toHaveProperty('userId');
        expect(res.body.session).not.toHaveProperty('token');
        expect(res.body).not.toHaveProperty('sessionToken');
        expect(res.body).not.toHaveProperty('accessToken');
        expect(JSON.stringify(res.body)).not.toContain(sessionToken);
        expect(res.headers['cache-control']).toBe('no-store');
      });

      it('blocks the direct BetterAuth session endpoint', async () => {
        const res = await request(server())
          .get('/api/auth/get-session')
          .set('Cookie', sessionCookie);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('DIRECT_SESSION_ROUTE_DISABLED');
        expect(JSON.stringify(res.body)).not.toContain(sessionToken);
      });

      it('revokes the session on sign-out', async () => {
        expect(sessionToken).toBeTruthy();
        const signedOut = await request(server())
          .post('/auth/sign-out')
          .set('Cookie', sessionCookie);

        expect(signedOut.status).toBe(200);

        // Verify cookie was cleared
        const cookieHeaders = setCookies(signedOut);
        const clearedCookie = cookieHeaders.find((c) =>
          c.startsWith('better-auth.session_token='),
        );
        expect(clearedCookie).toBeTruthy();
        expect(clearedCookie).toMatch(
          /Max-Age=0|expires=.*Thu.*01.*Jan.*1970/i,
        );

        const afterSignOut = await request(server())
          .get('/auth/session')
          .set('Cookie', sessionCookie);

        expect(afterSignOut.status).toBe(401);
        expect(
          await prisma.session.findUnique({ where: { token: sessionToken } }),
        ).toBeNull();
      });
    });

    // Regression guard for the cookie-only sign-in contract.
    it('sets an HttpOnly Session Cookie (ticket 02)', async () => {
      const res = await request(server()).post('/auth/sign-in').send({
        email: testEmail.dept,
        password: sharedPassword,
      });
      expect(res.status).toBe(200);
      expect(isHttpOnly(res, 'better-auth.session_token')).toBe(true);
    });

    it('keeps the Session Token out of JSON (ticket 13)', async () => {
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
    describe('Mandatory Role: enrollment gate (ticket 03)', () => {
      let preAuthCookie: string;
      let totpSecret: string;
      let adminUserId: string;
      let recoveryCode: string;

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
        preAuthCookie = cookiePair(res, 'hams.pre_auth');
        expect(preAuthCookie).toBeTruthy();
        const admin = await prisma.user.findUnique({
          where: { email: testEmail.admin },
          select: { id: true },
        });
        adminUserId = admin!.id;
        expect(extractCookie(res, 'better-auth.session_token')).toMatch(
          /Max-Age=0/,
        );
      });

      it('blocks a pre-existing mandatory-role session before enrollment', async () => {
        const legacySignIn = await auth.api.signInEmail({
          headers: new Headers(),
          body: { email: testEmail.admin, password: sharedPassword },
          returnHeaders: true,
        });
        const setCookieHeaders = (
          legacySignIn.headers as Headers & { getSetCookie: () => string[] }
        ).getSetCookie();
        const cookie = setCookieHeaders
          .filter((value) => /better-auth\.session_token=/i.test(value))
          .map((value) => value.split(';', 1)[0])
          .join('; ');
        expect(cookie).toContain('better-auth.session_token=');
        const legacyToken = cookie.match(
          /better-auth\.session_token=([^;]+)/i,
        )?.[1];
        expect(legacyToken).toBeTruthy();

        const businessApi = await request(server())
          .get('/users')
          .set('Cookie', cookie);
        expect(businessApi.status).toBe(403);
        expect(businessApi.body.code).toBe('ENROLLMENT_REQUIRED');

        const session = await request(server())
          .get('/auth/session')
          .set('Cookie', cookie);
        expect(session.status).toBe(200);
        expect(session.body.session).toBeNull();
        expect(
          await prisma.session.findUnique({ where: { token: legacyToken! } }),
        ).toBeNull();
      });
      it('blocks direct BetterAuth sign-in from bypassing the HAMS gate', async () => {
        const res = await request(server())
          .post('/api/auth/sign-in/email')
          .send({
            email: testEmail.admin,
            password: sharedPassword,
          });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('HAMS_SIGNIN_REQUIRED');
      });

      it('rejects Business API access with the pre-auth cookie', async () => {
        expect(preAuthCookie).toBeTruthy();
        const res = await request(server())
          .get('/users')
          .set('Cookie', preAuthCookie);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ENROLLMENT_REQUIRED');
      });

      it('requires acknowledgement before issuing the session cookie', async () => {
        const enabled = await request(server())
          .post('/auth/2fa/enable')
          .set('Cookie', preAuthCookie)
          .send({ password: sharedPassword });
        expect(enabled.status).toBe(200);
        expect(typeof enabled.body.totpURI).toBe('string');
        totpSecret =
          new URL(enabled.body.totpURI).searchParams.get('secret') ?? '';
        expect(totpSecret).toBeTruthy();

        const code = generateSync({ secret: totpSecret });
        const verified = await request(server())
          .post('/auth/2fa/verify-setup')
          .set('Cookie', preAuthCookie)
          .send({ code });
        expect(verified.status).toBe(200);
        expect(verified.body.backupCodes).toHaveLength(10);
        recoveryCode = verified.body.backupCodes[0];

        const acknowledged = await request(server())
          .post('/auth/2fa/acknowledge-recovery-codes')
          .set('Cookie', preAuthCookie)
          .send({ acknowledged: true });
        expect(acknowledged.status).toBe(200);
        expect(acknowledged.body.enrollmentComplete).toBe(true);
        expect(acknowledged.body).not.toHaveProperty('token');
        expect(isHttpOnly(acknowledged, 'better-auth.session_token')).toBe(
          true,
        );

        const sessionCookie = sessionCookieHeader(acknowledged);
        const session = await request(server())
          .get('/auth/session')
          .set('Cookie', sessionCookie);
        expect(session.status).toBe(200);
        expect(session.body.session).toHaveProperty('userId', adminUserId);
      });

      it('allows opt-in browser trust only after TOTP and revokes it for another account', async () => {
        const secondSignIn = await request(server())
          .post('/auth/sign-in')
          .send({
            email: testEmail.admin,
            password: sharedPassword,
          });
        expect(secondSignIn.status).toBe(200);
        expect(secondSignIn.body.twoFactorRedirect).toBe('/2fa/verify');
        expect(secondSignIn.body).not.toHaveProperty('token');
        const verificationCookie = cookiePair(secondSignIn, 'hams.pre_auth');
        expect(verificationCookie).toBeTruthy();

        const verified = await request(server())
          .post('/auth/2fa/verify-totp')
          .set('Cookie', verificationCookie)
          .send({
            code: generateSync({ secret: totpSecret }),
            trustBrowser: true,
          });
        expect(verified.status).toBe(200);
        expect(verified.body).not.toHaveProperty('token');
        expect(verified.body).not.toHaveProperty('trustedBrowserToken');
        const trustCookie = cookiePair(verified, 'better-auth.trust_device');
        expect(trustCookie).toBeTruthy();
        expect(isHttpOnly(verified, 'better-auth.trust_device')).toBe(true);
        expect(extractCookie(verified, 'better-auth.trust_device')).toMatch(
          /Max-Age=1209600/,
        );

        const trustedSignIn = await request(server())
          .post('/auth/sign-in')
          .set('Cookie', trustCookie)
          .send({ email: testEmail.admin, password: sharedPassword });
        expect(trustedSignIn.status).toBe(200);
        expect(trustedSignIn.body.requiresTwoFactor).toBe(false);
        expect(trustedSignIn.body.trustedBrowser).toBe(true);
        expect(trustedSignIn.body).not.toHaveProperty('token');

        await seedUser(testEmail.parcel, 'PARCEL_STAFF', 'test_parcel_01');
        const parcelUser = await prisma.user.findUnique({
          where: { email: testEmail.parcel },
        });
        await prisma.twoFactorAuth.create({
          data: {
            userId: parcelUser!.id,
            secretEncrypted: 'test-only-enrolled-secret',
            backupCodes: [],
            enrollmentComplete: true,
          },
        });

        const otherAccount = await request(server())
          .post('/auth/sign-in')
          .set('Cookie', trustCookie)
          .send({ email: testEmail.parcel, password: sharedPassword });
        expect(otherAccount.status).toBe(200);
        expect(otherAccount.body.twoFactorRedirect).toBe('/2fa/verify');
        expect(otherAccount.body).not.toHaveProperty('token');
        expect(
          await prisma.trustedDevice.count({ where: { userId: adminUserId } }),
        ).toBe(0);
      });

      it('consumes a recovery code once during sign-in', async () => {
        const signIn = await request(server()).post('/auth/sign-in').send({
          email: testEmail.admin,
          password: sharedPassword,
        });
        const preAuthCookie = cookiePair(signIn, 'hams.pre_auth');
        expect(preAuthCookie).toBeTruthy();

        const verified = await request(server())
          .post('/auth/2fa/verify-recovery-code')
          .set('Cookie', preAuthCookie)
          .send({ code: recoveryCode });
        expect(verified.status).toBe(200);
        expect(verified.body.usedRecoveryCode).toBe(true);
        expect(verified.body).not.toHaveProperty('token');
        expect(isHttpOnly(verified, 'better-auth.session_token')).toBe(true);

        const repeatSignIn = await request(server())
          .post('/auth/sign-in')
          .send({
            email: testEmail.admin,
            password: sharedPassword,
          });
        const repeated = await request(server())
          .post('/auth/2fa/verify-recovery-code')
          .set('Cookie', cookiePair(repeatSignIn, 'hams.pre_auth'))
          .send({ code: recoveryCode });
        expect(repeated.status).toBe(400);
        expect(repeated.body.code).toBe('INVALID_RECOVERY_CODE');
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
        const csrfCookieName =
          process.env.NODE_ENV === 'production'
            ? '__Host-hams.csrf'
            : 'hams.csrf';
        expect(isHttpOnly(res, csrfCookieName)).toBe(true);
        expect(extractCookie(res, csrfCookieName)).toMatch(/Max-Age=43200/i);
        expect(cookiePair(res, csrfCookieName)).toContain(res.body.csrfToken);
        expect(res.headers['cache-control']).toBe('no-store');
      });

      it('rejects browser mutations without a matching cookie proof', async () => {
        const res = await request(server())
          .post('/auth/sign-in')
          .set('Origin', 'http://localhost:5173')
          .send({
            email: 'nobody@nowhere.invalid',
            password: 'NoPassword@1234!',
          });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('CSRF_INVALID');
      });

      it('accepts the issued cookie proof and reaches the sign-in handler', async () => {
        const csrf = await request(server()).get('/auth/csrf');
        const csrfCookieName =
          process.env.NODE_ENV === 'production'
            ? '__Host-hams.csrf'
            : 'hams.csrf';
        const res = await request(server())
          .post('/auth/sign-in')
          .set('Origin', 'http://localhost:5173')
          .set('Cookie', cookiePair(csrf, csrfCookieName))
          .set('X-CSRF-Token', csrf.body.csrfToken)
          .send({
            email: 'nobody@nowhere.invalid',
            password: 'NoPassword@1234!',
          });

        expect(res.status).toBe(401);
      });

      it('rejects a mismatched header and cookie proof', async () => {
        const csrf = await request(server()).get('/auth/csrf');
        const csrfCookieName =
          process.env.NODE_ENV === 'production'
            ? '__Host-hams.csrf'
            : 'hams.csrf';
        const res = await request(server())
          .post('/auth/sign-in')
          .set('Origin', 'http://localhost:5173')
          .set('Cookie', cookiePair(csrf, csrfCookieName))
          .set('X-CSRF-Token', 'a'.repeat(43) + '.' + 'b'.repeat(43))
          .send({
            email: 'nobody@nowhere.invalid',
            password: 'NoPassword@1234!',
          });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('CSRF_INVALID');
      });

      it('protects direct BetterAuth mutation routes too', async () => {
        const res = await request(server())
          .post('/api/auth/sign-out')
          .set('Origin', 'http://localhost:5173');

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('CSRF_INVALID');
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
    describe('Change password (cookie session)', () => {
      const changeEmail = 'test-change-pwd@hams-test.local';
      const newPassword = 'NewPassword@5678!';
      let activeSessionCookie: string;

      beforeAll(async () => {
        await seedUser(changeEmail, 'DEPARTMENT_STAFF', 'test_change_pwd_01');
        const signInRes = await request(server()).post('/auth/sign-in').send({
          email: changeEmail,
          password: sharedPassword,
        });
        expect(signInRes.status).toBe(200);
        expect(signInRes.body).not.toHaveProperty('token');
        activeSessionCookie = sessionCookieHeader(signInRes);
      });

      it('changes the password with the current password', async () => {
        expect(activeSessionCookie).toBeTruthy();
        const res = await request(server())
          .post('/auth/change-password')
          .set('Cookie', activeSessionCookie)
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
      let adminTotpSecret: string;

      beforeAll(async () => {
        await seedUser(testEmail.admin, 'ADMIN', 'test_admin_01');
        const admin = await prisma.user.findUniqueOrThrow({
          where: { email: testEmail.admin },
          select: { id: true },
        });
        const twoFactorService = app.get(TwoFactorService);
        const enrollment = await twoFactorService.generateSecret(
          admin.id,
          testEmail.admin,
        );
        adminTotpSecret = enrollment.secret;
        await twoFactorService.verifyPendingEnrollment(
          admin.id,
          generateSync({ secret: adminTotpSecret }),
        );
        await twoFactorService.confirmBackupCodesSaved(admin.id);
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

        const res = await request(server())
          .post('/api/auth/admin/set-user-password')
          .set('Cookie', sessionCookieHeader(signedIn))
          .send({ userId: 'unknown', newPassword: sharedPassword });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('DIRECT_ADMIN_ROUTE_DISABLED');
      });

      it('blocks self-promotion through BetterAuth update-user', async () => {
        const signedIn = await request(server()).post('/auth/sign-in').send({
          email: testEmail.dept,
          password: sharedPassword,
        });
        expect(signedIn.status).toBe(200);

        const res = await request(server())
          .post('/api/auth/update-user')
          .set('Cookie', sessionCookieHeader(signedIn))
          .send({ role: 'ADMIN' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('DIRECT_ACCOUNT_UPDATE_DISABLED');
        const user = await prisma.user.findUniqueOrThrow({
          where: { email: testEmail.dept },
          select: { role: true },
        });
        expect(user.role).toBe('DEPARTMENT_STAFF');
      });

      it('allows an enrolled ADMIN through the HAMS account route', async () => {
        const signedIn = await request(server()).post('/auth/sign-in').send({
          email: testEmail.admin,
          password: sharedPassword,
        });
        expect(signedIn.status).toBe(200);
        expect(signedIn.body.requiresTwoFactor).toBe(true);
        expect(signedIn.body).not.toHaveProperty('token');
        const preAuthCookie = cookiePair(signedIn, 'hams.pre_auth');

        const verified = await request(server())
          .post('/auth/2fa/verify-totp')
          .set('Cookie', preAuthCookie)
          .send({ code: generateSync({ secret: adminTotpSecret }) });
        expect(verified.status).toBe(200);
        const sessionCookie = sessionCookieHeader(verified);
        expect(sessionCookie).toContain('better-auth.session_token=');

        const res = await request(server())
          .post('/users')
          .set('Cookie', sessionCookie)
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
