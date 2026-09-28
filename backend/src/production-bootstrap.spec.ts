jest.mock('./common/config/database.config', () => ({
  sharedPrisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    account: { findFirst: jest.fn() },
    bootstrapCredentialDelivery: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    securityAuditLog: { create: jest.fn() },
    twoFactorAuth: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
  },
  sharedPool: { end: jest.fn() },
}));

jest.mock('./auth/auth', () => ({
  auth: { api: { sendVerificationEmail: jest.fn() } },
}));

jest.mock('./common/mail/mail.service', () => ({
  mailService: { sendBootstrapAdminCredentials: jest.fn() },
}));

jest.mock('better-auth/crypto', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
}));

import { UserRole } from '@prisma/client';
import { ensureAdmin } from '../prisma/bootstrap-admins';
import { isAdminReady } from '../prisma/handover-check';
import { auth } from './auth/auth';
import { sharedPrisma } from './common/config/database.config';
import { mailService } from './common/mail/mail.service';

const configuredAdmin = {
  email: 'first.admin@example.org',
  userName: 'first-admin',
  firstname: 'First',
  lastname: 'Admin',
  employeeId: 'HAMS-ADMIN-001',
};

describe('production ADMIN bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (
      sharedPrisma.bootstrapCredentialDelivery.findUnique as jest.Mock
    ).mockResolvedValue(null);
  });

  it('does not create a duplicate or change credentials when bootstrap is rerun', async () => {
    const existingAdmin = {
      id: 'admin-user-1',
      role: UserRole.ADMIN,
      employeeId: configuredAdmin.employeeId,
      userName: configuredAdmin.userName,
      emailVerified: true,
      banned: false,
      deletedAt: null,
    };
    (sharedPrisma.user.findUnique as jest.Mock).mockResolvedValue(
      existingAdmin,
    );
    (sharedPrisma.account.findFirst as jest.Mock).mockResolvedValue({
      id: 'credential-account-1',
    });

    await ensureAdmin(configuredAdmin);
    await ensureAdmin(configuredAdmin);

    expect((sharedPrisma.user.findUnique as jest.Mock).mock.calls).toHaveLength(
      2,
    );
    expect(
      (sharedPrisma.account.findFirst as jest.Mock).mock.calls,
    ).toHaveLength(2);
    expect((sharedPrisma.user.create as jest.Mock).mock.calls).toHaveLength(0);
    expect((sharedPrisma.$transaction as jest.Mock).mock.calls).toHaveLength(0);
    expect(
      (mailService.sendBootstrapAdminCredentials as jest.Mock).mock.calls,
    ).toHaveLength(0);
    expect(auth.api.sendVerificationEmail).not.toHaveBeenCalled();
    expect(existingAdmin).toMatchObject({
      role: UserRole.ADMIN,
      emailVerified: true,
      banned: false,
    });
  });

  it('blocks handover if a configured ADMIN is not email-verified and enrolled', () => {
    expect(
      isAdminReady({
        accountExists: true,
        isAdmin: true,
        isActive: true,
        emailVerified: false,
        twoFactorEnrolled: false,
      }),
    ).toBe(false);
  });

  it('retries a failed credential email with the same password', async () => {
    const previousKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);
    let pending: { userId: string; passwordEncrypted: string } | null = null;
    const existingAdmin = {
      id: 'admin-user-1',
      role: UserRole.ADMIN,
      employeeId: configuredAdmin.employeeId,
      userName: configuredAdmin.userName,
      emailVerified: false,
      banned: false,
      deletedAt: null,
    };
    (sharedPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(existingAdmin);
    (sharedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (sharedPrisma.user.create as jest.Mock).mockImplementation(
      ({ data }: { data: { id: string } }) => {
        existingAdmin.id = data.id;
        return data;
      },
    );
    (sharedPrisma.account.findFirst as jest.Mock).mockResolvedValue({
      id: 'credential-1',
    });
    (sharedPrisma.$transaction as jest.Mock).mockImplementation(
      async (action: (tx: typeof sharedPrisma) => Promise<void>) =>
        action(sharedPrisma),
    );
    (
      sharedPrisma.bootstrapCredentialDelivery.create as jest.Mock
    ).mockImplementation(({ data }: { data: typeof pending }) => {
      pending = data;
    });
    (
      sharedPrisma.bootstrapCredentialDelivery.findUnique as jest.Mock
    ).mockImplementation(() => pending);
    (
      sharedPrisma.bootstrapCredentialDelivery.delete as jest.Mock
    ).mockImplementation(() => {
      pending = null;
    });
    (mailService.sendBootstrapAdminCredentials as jest.Mock)
      .mockRejectedValueOnce(new Error('SMTP unavailable'))
      .mockResolvedValueOnce(undefined);

    try {
      await expect(ensureAdmin(configuredAdmin)).rejects.toThrow(
        'SMTP unavailable',
      );
      expect(pending).not.toBeNull();
      expect(auth.api.sendVerificationEmail).not.toHaveBeenCalled();

      await ensureAdmin(configuredAdmin);
      const deliveries = (
        mailService.sendBootstrapAdminCredentials as jest.Mock
      ).mock.calls as Array<[{ initialPassword: string }]>;
      expect(deliveries[0][0].initialPassword).toBe(
        deliveries[1][0].initialPassword,
      );
      expect((sharedPrisma.user.create as jest.Mock).mock.calls).toHaveLength(
        1,
      );
      expect(pending).toBeNull();
      expect(auth.api.sendVerificationEmail).toHaveBeenCalledTimes(1);
    } finally {
      if (previousKey === undefined)
        delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
      else process.env.TWO_FACTOR_ENCRYPTION_KEY = previousKey;
    }
  });

  it('creates two ADMINs with different initial passwords', async () => {
    const previousKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'b'.repeat(64);
    const pending = new Map<string, string>();
    (sharedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (sharedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (sharedPrisma.$transaction as jest.Mock).mockImplementation(
      async (action: (tx: typeof sharedPrisma) => Promise<void>) =>
        action(sharedPrisma),
    );
    (
      sharedPrisma.bootstrapCredentialDelivery.create as jest.Mock
    ).mockImplementation(
      ({ data }: { data: { userId: string; passwordEncrypted: string } }) => {
        pending.set(data.userId, data.passwordEncrypted);
      },
    );
    (
      sharedPrisma.bootstrapCredentialDelivery.findUnique as jest.Mock
    ).mockImplementation(({ where }: { where: { userId: string } }) => {
      const passwordEncrypted = pending.get(where.userId);
      return passwordEncrypted ? { passwordEncrypted } : null;
    });
    (
      sharedPrisma.bootstrapCredentialDelivery.delete as jest.Mock
    ).mockImplementation(({ where }: { where: { userId: string } }) => {
      pending.delete(where.userId);
    });

    try {
      await ensureAdmin(configuredAdmin);
      await ensureAdmin({
        ...configuredAdmin,
        email: 'second.admin@example.org',
        userName: 'second-admin',
        employeeId: 'HAMS-ADMIN-002',
      });

      const deliveries = (
        mailService.sendBootstrapAdminCredentials as jest.Mock
      ).mock.calls as Array<[{ initialPassword: string }]>;
      expect(deliveries).toHaveLength(2);
      expect(deliveries[0][0].initialPassword).not.toBe(
        deliveries[1][0].initialPassword,
      );
      expect((sharedPrisma.user.create as jest.Mock).mock.calls).toHaveLength(
        2,
      );
      expect(pending.size).toBe(0);
    } finally {
      if (previousKey === undefined)
        delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
      else process.env.TWO_FACTOR_ENCRYPTION_KEY = previousKey;
    }
  });
});
