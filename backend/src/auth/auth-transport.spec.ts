import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

describe.each(['http', 'https'])(
  'real Better Auth transport over %s',
  (protocol) => {
    it('verifies email and issues a usable session with the configured origin and cookie mode', () => {
      const backendRoot = path.resolve(__dirname, '../..');
      const origin = `${protocol}://hams.example.test:20443`;
      // Run outside Jest's Better Auth mocks. Only persistence and mail delivery
      // are replaced: no PostgreSQL connection or SMTP message is needed.
      const script = `
      const assert = require('node:assert/strict');
      const { betterAuth } = require('better-auth');
      const { memoryAdapter } = require('better-auth/adapters/memory');
      const { mailService } = require('./src/common/mail/mail.service');
      const { auth } = require('./src/auth/auth');
      const { sharedPool, sharedPrisma } = require('./src/common/config/database.config');
      let verificationUrl;
      mailService.sendVerificationEmail = async (message) => {
        verificationUrl = message.verificationUrl;
      };
      (async () => {
        const instance = betterAuth({
          ...auth.options,
          database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
          rateLimit: { enabled: false },
          telemetry: { enabled: false },
        });
        const email = 'transport-test@example.test';
        const password = 'TransportTestPassword123!';
        await instance.api.signUpEmail({ body: { name: 'Transport Test', email, password } });
        assert.ok(verificationUrl, 'verification email must be generated');
        const url = new URL(verificationUrl);
        assert.equal(url.origin, ${JSON.stringify(origin)});
        assert.equal(url.pathname, '/api/auth/verify-email');
        assert.equal(url.searchParams.get('callbackURL'), ${JSON.stringify(`${origin}/login?verified=true`)});
        const verified = await instance.handler(new Request(verificationUrl));
        assert.equal(verified.status, 302);
        assert.equal(verified.headers.get('location'), ${JSON.stringify(`${origin}/login?verified=true`)});
        const login = await instance.api.signInEmail({
          body: { email, password }, returnHeaders: true,
        });
        const cookies = login.headers.getSetCookie();
        const cookieName = ${JSON.stringify(`${protocol === 'https' ? '__Secure-' : ''}better-auth.session_token`)};
        const sessionCookie = cookies.find((cookie) => cookie.startsWith(cookieName + '='));
        assert.ok(sessionCookie, 'session cookie must match the configured protocol');
        assert.equal(/;\\s*Secure(?:;|$)/i.test(sessionCookie), ${protocol === 'https'});
        assert.match(sessionCookie, /;\\s*HttpOnly(?:;|$)/i);
        assert.match(sessionCookie, /;\\s*SameSite=Lax(?:;|$)/i);
        const session = await instance.api.getSession({
          headers: new Headers({ cookie: sessionCookie.split(';', 1)[0] }),
        });
        assert.equal(session.user.email, email);
        assert.equal(session.user.emailVerified, true);
        process.stdout.write('AUTH_TRANSPORT_OK');
      })().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      }).finally(async () => {
        await sharedPrisma.$disconnect();
        await sharedPool.end();
      });
    `;
      const result = spawnSync(
        process.execPath,
        ['--require', 'ts-node/register', '-e', script],
        {
          cwd: backendRoot,
          encoding: 'utf8',
          timeout: 30_000,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            HAMS_INSTALLATION_MODE: 'customer',
            HAMS_ALLOW_INSECURE_HTTP: protocol === 'http' ? 'true' : 'false',
            BETTER_AUTH_URL: origin,
            FRONTEND_URL: origin,
            BETTER_AUTH_SECRET: 'transport-test-secret-'.repeat(3),
            TWO_FACTOR_ENCRYPTION_KEY: 'a'.repeat(64),
            DATABASE_URL:
              'postgresql://hams:unit-only@127.0.0.1:1/hams_transport_test',
            IMAGE_STORAGE_PROVIDER: 'cloudinary',
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: '1',
            SMTP_SECURE: 'false',
            SMTP_REQUIRE_TLS: 'true',
            SMTP_USER: '',
            SMTP_PASS: '',
            SMTP_FROM: 'HAMS <noreply@example.test>',
            AUTH_DB_DIAGNOSTICS: '0',
            DOTENV_CONFIG_PATH: path.join(os.tmpdir(), 'hams-no-env-file'),
          },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('AUTH_TRANSPORT_OK');
    }, 35_000);
  },
);
