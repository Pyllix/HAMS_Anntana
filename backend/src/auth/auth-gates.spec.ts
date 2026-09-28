import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MandatoryEnrollmentGuard } from './mandatory-enrollment.guard';
import { PreAuthGuard } from './pre-auth.guard';

type TestRequest = {
  method: string;
  path: string;
  baseUrl?: string;
  headers: Record<string, string | undefined>;
  user?: { id: string; role?: string } | null;
};

function contextFor(request: TestRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('authentication gates', () => {
  describe('PreAuthGuard', () => {
    const preAuthService = { findChallenge: jest.fn() };
    const guard = new PreAuthGuard(preAuthService as never);

    beforeEach(() => jest.clearAllMocks());

    it('blocks business APIs for an enrollment-only challenge', async () => {
      preAuthService.findChallenge.mockResolvedValue({
        id: 'challenge-1',
        userId: 'admin-1',
        state: 'ENROLLMENT',
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        guard.canActivate(
          contextFor({
            method: 'GET',
            path: '/users',
            headers: { cookie: 'hams.pre_auth=opaque' },
          }),
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ENROLLMENT_REQUIRED' }),
      });
    });

    it('allows enrollment endpoints for an enrollment-only challenge', async () => {
      preAuthService.findChallenge.mockResolvedValue({
        id: 'challenge-1',
        userId: 'admin-1',
        state: 'ENROLLMENT',
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        guard.canActivate(
          contextFor({
            method: 'POST',
            path: '/auth/2fa/enable',
            headers: { cookie: 'hams.pre_auth=opaque' },
          }),
        ),
      ).resolves.toBe(true);
    });

    it('allows TOTP verification and blocks enrollment routes after setup', async () => {
      preAuthService.findChallenge.mockResolvedValue({
        id: 'challenge-2',
        userId: 'admin-1',
        state: 'TOTP',
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        guard.canActivate(
          contextFor({
            method: 'POST',
            path: '/auth/2fa/verify-totp',
            headers: { cookie: 'hams.pre_auth=opaque' },
          }),
        ),
      ).resolves.toBe(true);

      await expect(
        guard.canActivate(
          contextFor({
            method: 'POST',
            path: '/auth/2fa/enable',
            headers: { cookie: 'hams.pre_auth=opaque' },
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('MandatoryEnrollmentGuard', () => {
    const twoFactorService = {
      requiresTwoFactor: jest.fn(),
      hasCompletedEnrollment: jest.fn(),
    };
    const guard = new MandatoryEnrollmentGuard(twoFactorService as never);

    beforeEach(() => jest.clearAllMocks());

    it('blocks an existing mandatory-role session until enrollment is complete', async () => {
      twoFactorService.requiresTwoFactor.mockReturnValue(true);
      twoFactorService.hasCompletedEnrollment.mockResolvedValue(false);

      await expect(
        guard.canActivate(
          contextFor({
            method: 'GET',
            path: '/users',
            headers: {},
            user: { id: 'legacy-admin-session', role: 'ADMIN' },
          }),
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ENROLLMENT_REQUIRED' }),
      });
      expect(twoFactorService.hasCompletedEnrollment).toHaveBeenCalledWith(
        'legacy-admin-session',
      );
    });

    it('allows an enrolled mandatory-role session and does not gate other roles', async () => {
      twoFactorService.requiresTwoFactor.mockReturnValue(true);
      twoFactorService.hasCompletedEnrollment.mockResolvedValue(true);
      await expect(
        guard.canActivate(
          contextFor({
            method: 'GET',
            path: '/users',
            headers: {},
            user: { id: 'enrolled-admin', role: 'ADMIN' },
          }),
        ),
      ).resolves.toBe(true);

      twoFactorService.requiresTwoFactor.mockReturnValue(false);
      await expect(
        guard.canActivate(
          contextFor({
            method: 'GET',
            path: '/users',
            headers: {},
            user: { id: 'department-user', role: 'DEPARTMENT_STAFF' },
          }),
        ),
      ).resolves.toBe(true);
      expect(twoFactorService.hasCompletedEnrollment).toHaveBeenCalledTimes(1);
    });

    it('keeps auth routes available to finish enrollment', async () => {
      twoFactorService.requiresTwoFactor.mockReturnValue(true);

      await expect(
        guard.canActivate(
          contextFor({
            method: 'GET',
            path: '/auth/session',
            headers: {},
            user: { id: 'legacy-admin-session', role: 'ADMIN' },
          }),
        ),
      ).resolves.toBe(true);
      expect(twoFactorService.hasCompletedEnrollment).not.toHaveBeenCalled();
    });
  });
});