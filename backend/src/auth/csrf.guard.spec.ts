import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
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
