import { ForbiddenException } from '@nestjs/common';
import { AdminStepUpService } from './admin-step-up.service';

describe('AdminStepUpService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    session: { findFirst: jest.fn() },
    adminStepUp: { upsert: jest.fn(), findUnique: jest.fn() },
  };
  const twoFactorService = { verifyCurrentTotp: jest.fn() };
  const service = new AdminStepUpService(
    prisma as never,
    twoFactorService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.session.findFirst.mockResolvedValue({ id: 'session-1' });
  });

  it('grants five minutes only after current-session TOTP verification', async () => {
    const before = Date.now();
    const grant = await service.verifyAndGrant(
      'admin-1',
      'session-1',
      '123456',
    );

    expect(twoFactorService.verifyCurrentTotp).toHaveBeenCalledWith(
      'admin-1',
      '123456',
    );
    expect(grant.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 300_000);
    expect(prisma.adminStepUp.upsert).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
      create: { sessionId: 'session-1', expiresAt: grant.expiresAt },
      update: { expiresAt: grant.expiresAt },
    });
  });

  it('does not reuse a grant in another session', async () => {
    prisma.adminStepUp.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      session: {
        userId: 'admin-1',
        expiresAt: new Date(Date.now() + 60_000),
        user: { role: 'ADMIN' },
      },
    });

    await expect(
      service.requireActive('admin-1', 'session-1'),
    ).resolves.toBeUndefined();
    prisma.adminStepUp.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.requireActive('admin-1', 'session-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const lastCall = prisma.adminStepUp.findUnique.mock.calls.at(-1) as
      | [{ where: { sessionId: string } }]
      | undefined;
    expect(lastCall?.[0].where.sessionId).toBe('session-2');
  });

  it('rejects an expired grant', async () => {
    prisma.adminStepUp.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1),
      session: {
        userId: 'admin-1',
        expiresAt: new Date(Date.now() + 60_000),
        user: { role: 'ADMIN' },
      },
    });

    await expect(
      service.requireActive('admin-1', 'session-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
