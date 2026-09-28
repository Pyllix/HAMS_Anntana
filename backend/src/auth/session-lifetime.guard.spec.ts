import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SessionLifetimeGuard } from './session-lifetime.guard';
import type { SessionLifetimeService } from './session-lifetime.service';

function contextFor(request: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SessionLifetimeGuard', () => {
  const service = { enforceSession: jest.fn() };
  const guard = new SessionLifetimeGuard(
    service as unknown as SessionLifetimeService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks a cookie session and records the authoritative window on the request', async () => {
    const window = {
      expiresAt: new Date('2026-09-25T01:00:00.000Z'),
      idleExpiresAt: new Date('2026-09-25T01:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-09-25T12:00:00.000Z'),
    };
    service.enforceSession.mockResolvedValue(window);
    const request = {
      method: 'GET',
      path: '/users',
      headers: {
        cookie: 'better-auth.session_token=cookie-session.signature',
        'x-user-activity': '1',
      },
    } as unknown as Request;

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(service.enforceSession).toHaveBeenCalledWith('cookie-session', true);
  });

  it('uses cookie sessions only and counts activity only with the marker', async () => {
    service.enforceSession.mockResolvedValue({
      expiresAt: new Date('2026-09-25T01:00:00.000Z'),
      idleExpiresAt: new Date('2026-09-25T01:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-09-25T12:00:00.000Z'),
    });

    await guard.canActivate(
      contextFor({
        method: 'GET',
        path: '/users',
        headers: { authorization: 'Bearer bearer-session' },
      }),
    );
    await guard.canActivate(
      contextFor({
        method: 'GET',
        path: '/users',
        headers: { cookie: 'better-auth.session_token=cookie-session' },
      }),
    );

    expect(service.enforceSession.mock.calls).toEqual([
      ['cookie-session', false],
    ]);
  });

  it('rejects expired sessions with the documented response code', async () => {
    service.enforceSession.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        contextFor({
          method: 'GET',
          path: '/users',
          headers: { cookie: 'better-auth.session_token=expired-session' },
        }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SESSION_EXPIRED' }),
      status: 401,
    });
  });

  it('does not block sign-in when a stale cookie is still present', async () => {
    await expect(
      guard.canActivate(
        contextFor({
          method: 'POST',
          path: '/auth/sign-in',
          headers: { cookie: 'better-auth.session_token=stale-session' },
        }),
      ),
    ).resolves.toBe(true);
    expect(service.enforceSession).not.toHaveBeenCalled();
  });

  it('allows routes without a session credential through to the auth guard', async () => {
    await expect(
      guard.canActivate(
        contextFor({ method: 'GET', path: '/users', headers: {} }),
      ),
    ).resolves.toBe(true);
    expect(service.enforceSession).not.toHaveBeenCalled();
  });
});
