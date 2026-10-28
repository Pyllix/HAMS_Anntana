import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { runtimeConfig } from '../common/config/bootstrap-config';
import { loadRuntimeConfig } from '../common/config/runtime-config';
import {
  createCsrfToken,
  csrfCookieName,
  isTrustedOrigin,
  trustedOrigins,
} from './csrf-protection';

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret-for-csrf-proof-signing';
  });

  function contextFor(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('rejects a trusted browser mutation without a CSRF proof', () => {
    expect(() =>
      guard.canActivate(
        contextFor({
          method: 'POST',
          headers: { origin: 'http://localhost:5173' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts a matching CSRF cookie and header from a trusted browser', () => {
    const token = createCsrfToken();
    expect(
      guard.canActivate(
        contextFor({
          method: 'PATCH',
          headers: {
            origin: 'http://localhost:5173',
            cookie: `${csrfCookieName()}=${token}`,
            'x-csrf-token': token,
          },
        }),
      ),
    ).toBe(true);
  });

  it('invalidates a signed proof when the authentication context changes', () => {
    const preAuthCookie = 'hams.pre_auth=pre-auth-session';
    const token = createCsrfToken(preAuthCookie);

    expect(() =>
      guard.canActivate(
        contextFor({
          method: 'POST',
          headers: {
            origin: 'http://localhost:5173',
            cookie: `${preAuthCookie}; ${csrfCookieName()}=${token}; better-auth.session_token=full-session`,
            'x-csrf-token': token,
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a forged cookie even when the header repeats it', () => {
    const forgedToken = `${'a'.repeat(43)}.${'b'.repeat(43)}`;
    expect(() =>
      guard.canActivate(
        contextFor({
          method: 'POST',
          headers: {
            origin: 'http://localhost:5173',
            cookie: `${csrfCookieName()}=${forgedToken}`,
            'x-csrf-token': forgedToken,
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects requests from an untrusted browser origin', () => {
    const token = createCsrfToken();
    expect(() =>
      guard.canActivate(
        contextFor({
          method: 'DELETE',
          headers: {
            origin: 'https://attacker.example',
            cookie: `${csrfCookieName()}=${token}`,
            'x-csrf-token': token,
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('keeps originless non-browser API clients compatible', () => {
    expect(guard.canActivate(contextFor({ method: 'POST', headers: {} }))).toBe(
      true,
    );
  });

  describe('trusted origins by environment', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousFrontendUrl = process.env.FRONTEND_URL;
    const previousPreviewPattern = process.env.VERCEL_PREVIEW_ORIGIN_PATTERN;

    afterAll(() => {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = previousFrontendUrl;
      if (previousPreviewPattern === undefined) {
        delete process.env.VERCEL_PREVIEW_ORIGIN_PATTERN;
      } else {
        process.env.VERCEL_PREVIEW_ORIGIN_PATTERN = previousPreviewPattern;
      }
    });

    it('keeps local origins available during development', () => {
      process.env.NODE_ENV = 'development';
      process.env.FRONTEND_URL = 'http://localhost:5173';
      delete process.env.VERCEL_PREVIEW_ORIGIN_PATTERN;

      expect(trustedOrigins()).toContain('http://localhost:5173');
      expect(isTrustedOrigin('http://localhost:3000')).toBe(true);
    });

    it('limits production origins to the configured HTTPS site and its preview rule', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://hams.example.test';
      delete process.env.VERCEL_PREVIEW_ORIGIN_PATTERN;

      expect(trustedOrigins()).toEqual(['https://hams.example.test']);
      expect(isTrustedOrigin('https://hams.example.test')).toBe(true);
      expect(isTrustedOrigin('http://localhost:5173')).toBe(false);
    });
  });

  describe.each(['http', 'https'])(
    'customer production CSRF over %s',
    (protocol) => {
      const origin = `${protocol}://hams.example.test:20443`;
      const previousEnvironment = process.env;

      beforeEach(() => {
        process.env = {
          NODE_ENV: 'production',
          HAMS_INSTALLATION_MODE: 'customer',
          HAMS_ALLOW_INSECURE_HTTP: 'true',
          DATABASE_URL: 'postgresql://hams:secret@localhost:5432/hams_test',
          BETTER_AUTH_SECRET: 'a'.repeat(48),
          BETTER_AUTH_URL: origin,
          FRONTEND_URL: origin,
          TWO_FACTOR_ENCRYPTION_KEY: 'a'.repeat(64),
          SMTP_HOST: 'mail.example.test',
          SMTP_PORT: '587',
          SMTP_REQUIRE_TLS: 'true',
          SMTP_FROM: 'HAMS <noreply@example.test>',
        };
        jest.replaceProperty(
          runtimeConfig,
          'server',
          loadRuntimeConfig(process.env).server,
        );
      });

      afterEach(() => {
        jest.restoreAllMocks();
        process.env = previousEnvironment;
      });

      it('uses a browser-compatible cookie name and accepts a valid signed proof', () => {
        const expectedName =
          protocol === 'https' ? '__Host-hams.csrf' : 'hams.csrf';
        expect(csrfCookieName()).toBe(expectedName);
        const authCookie = 'hams.pre_auth=production-challenge';
        const token = createCsrfToken(authCookie);
        const request = {
          method: 'POST',
          headers: {
            origin,
            cookie: `${authCookie}; ${expectedName}=${token}`,
            'x-csrf-token': token,
          },
        };
        expect(guard.canActivate(contextFor(request))).toBe(true);
        expect(trustedOrigins()).toEqual([origin]);

        // The wrong scheme/port or a missing proof must still be rejected.
        for (const invalidOrigin of [
          `${protocol === 'http' ? 'https' : 'http'}://hams.example.test:20443`,
          `${protocol}://hams.example.test:20444`,
          'http://localhost:5173',
        ]) {
          expect(() =>
            guard.canActivate(
              contextFor({
                ...request,
                headers: { ...request.headers, origin: invalidOrigin },
              }),
            ),
          ).toThrow(ForbiddenException);
        }
        expect(() =>
          guard.canActivate(
            contextFor({
              ...request,
              headers: { ...request.headers, 'x-csrf-token': undefined },
            }),
          ),
        ).toThrow(ForbiddenException);
      });
    },
  );

  describe('Vercel preview origins', () => {
    const pattern = 'https://hams-anntana-test-*-pyllix.vercel.app';
    const previousPattern = process.env.VERCEL_PREVIEW_ORIGIN_PATTERN;

    beforeEach(() => {
      process.env.VERCEL_PREVIEW_ORIGIN_PATTERN = pattern;
    });

    afterAll(() => {
      if (previousPattern === undefined) {
        delete process.env.VERCEL_PREVIEW_ORIGIN_PATTERN;
      } else {
        process.env.VERCEL_PREVIEW_ORIGIN_PATTERN = previousPattern;
      }
    });

    it('accepts commit and branch previews from the configured project', () => {
      const token = createCsrfToken();
      for (const origin of [
        'https://hams-anntana-test-b3uz0a5qy-pyllix.vercel.app',
        'https://hams-anntana-test-git-feat-2fa-auth-pyllix.vercel.app',
      ]) {
        expect(isTrustedOrigin(origin)).toBe(true);
        expect(
          guard.canActivate(
            contextFor({
              method: 'POST',
              headers: {
                origin,
                cookie: `${csrfCookieName()}=${token}`,
                'x-csrf-token': token,
              },
            }),
          ),
        ).toBe(true);
      }
      expect(trustedOrigins()).toContain(pattern);
    });

    it('rejects previews from another project or Vercel account', () => {
      expect(
        isTrustedOrigin('https://other-project-b3uz0a5qy-pyllix.vercel.app'),
      ).toBe(false);
      expect(
        isTrustedOrigin('https://hams-anntana-test-b3uz0a5qy-other.vercel.app'),
      ).toBe(false);
    });

    it('still requires a CSRF proof on preview requests', () => {
      expect(() =>
        guard.canActivate(
          contextFor({
            method: 'POST',
            headers: {
              origin: 'https://hams-anntana-test-b3uz0a5qy-pyllix.vercel.app',
            },
          }),
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
