import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { createCsrfToken, csrfCookieName } from './csrf-protection';

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
});
