jest.mock('../common/config/database.config', () => {
  type Row = Record<string, unknown> & { id: string; userId: string };
  const rows = new Map<string, Row>();
  const lockTails = new Map<string, Promise<void>>();
  let nextId = 0;

  const clone = <T extends Record<string, unknown> | null>(value: T): T => {
    if (!value) return value;
    return {
      ...value,
      backupCodes: Array.isArray(value.backupCodes)
        ? [...value.backupCodes]
        : value.backupCodes,
      enrolledAt:
        value.enrolledAt instanceof Date
          ? new Date(value.enrolledAt)
          : value.enrolledAt,
      lockedUntil:
        value.lockedUntil instanceof Date
          ? new Date(value.lockedUntil)
          : value.lockedUntil,
    } as T;
  };

  const model = {
    findUnique: async ({ where }: { where: { userId: string } }) =>
      clone(rows.get(where.userId) ?? null),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: 'two-factor-' + ++nextId,
        failedAttempts: 0,
        lockedUntil: null,
        enrolledAt: new Date(),
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      } as unknown as Row;
      rows.set(row.userId, row);
      return clone(row);
    },
    update: async ({
      where,
      data,
    }: {
      where: { userId: string };
      data: Record<string, unknown>;
    }) => {
      const current = rows.get(where.userId);
      if (!current) throw new Error('Missing test 2FA row');
      const updated = { ...current, ...data, updatedAt: new Date() } as Row;
      rows.set(where.userId, updated);
      return clone(updated);
    },
    deleteMany: async ({ where }: { where?: { userId?: { in?: string[] } } }) => {
      const ids = where?.userId?.in ?? [...rows.keys()];
      let count = 0;
      for (const id of ids) count += Number(rows.delete(id));
      return { count };
    },
  };

  const acquire = async (key: string) => {
    const previous = lockTails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => (release = resolve));
    lockTails.set(key, current);
    await previous;
    return () => {
      release();
      if (lockTails.get(key) === current) lockTails.delete(key);
    };
  };

  const transaction = async <T>(callback: (tx: unknown) => Promise<T>) => {
    let unlock: (() => void) | undefined;
    const tx = {
      twoFactorAuth: model,
      $queryRawUnsafe: async (_query: string, key: string) => {
        unlock = await acquire(key);
        return [];
      },
    };
    try {
      return await callback(tx);
    } finally {
      unlock?.();
    }
  };

  return {
    sharedPrisma: {
      twoFactorAuth: model,
      trustedDevice: { deleteMany: async () => ({ count: 0 }) },
      __twoFactorRows: rows,
      account: { findFirst: async () => ({ password: 'test-password-hash' }) },
      $transaction: transaction,
      $disconnect: async () => undefined,
    },
    __twoFactorRows: rows,
  };
});

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
  generateURI: jest.fn(
    ({ issuer, label, secret }: { issuer: string; label: string; secret: string }) =>
      'otpauth://totp/' + issuer + ':' + label + '?secret=' + secret,
  ),
  verify: jest.fn(({ token }: { token: string }) =>
    Promise.resolve({ valid: token === '123456', delta: 0 }),
  ),
}));

jest.mock('better-auth/crypto', () => ({
  verifyPassword: jest.fn(
    ({ password }: { hash: string; password: string }) =>
      Promise.resolve(password === 'current-password'),
  ),
}));

import { sharedPrisma } from '../common/config/database.config';
import { generateSecret } from 'otplib';
import { TwoFactorService } from './two-factor.service';

const testDatabase = sharedPrisma as unknown as {
  __twoFactorRows: Map<string, Record<string, unknown>>;
};

describe('TwoFactorService (isolated persistence)', () => {
  const service = new TwoFactorService();
  const userId = 'two-factor-unit-user';

  beforeAll(() => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  beforeEach(() => {
    testDatabase.__twoFactorRows.clear();
    jest.mocked(generateSecret).mockClear();
  });

  async function beginEnrollment() {
    const { secret } = await service.generateSecret(userId, 'unit@example.test');
    const { backupCodes } = await service.verifyPendingEnrollment(
      userId,
      '123456',
    );
    return { secret, backupCodes };
  }

  async function completeEnrollment() {
    const result = await beginEnrollment();
    await service.confirmBackupCodesSaved(userId);
    return result;
  }

  it('keeps setup incomplete until recovery code acknowledgement and stores hashes only', async () => {
    const { secret, backupCodes } = await beginEnrollment();
    const row = testDatabase.__twoFactorRows.get(userId)!;

    expect(row.secretEncrypted).not.toContain(secret);
    expect(row.backupCodes).toHaveLength(10);
    expect(row.backupCodes).not.toContain(backupCodes[0]);
    expect(await service.hasCompletedEnrollment(userId)).toBe(false);

    await service.confirmBackupCodesSaved(userId);
    expect(await service.hasCompletedEnrollment(userId)).toBe(true);
  });

  it('consumes a recovery code once, including when two sign-in attempts race', async () => {
    const { backupCodes } = await completeEnrollment();
    const results = await Promise.all([
      service.verifyToken(userId, backupCodes[0]),
      service.verifyToken(userId, backupCodes[0]),
    ]);

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => result.usedRecoveryCode)).toHaveLength(1);
    expect(testDatabase.__twoFactorRows.get(userId)?.backupCodes).toHaveLength(9);
  });

  it('counts TOTP and recovery failures together and resets after successful verification', async () => {
    const { backupCodes } = await completeEnrollment();
    await service.verifyToken(userId, '000000');
    await service.verifyToken(userId, '000000');
    await service.verifyToken(userId, '000000');
    await service.verifyToken(userId, 'DEADBEEF');
    await service.verifyToken(userId, 'DEADBEEF');

    await expect(service.verifyToken(userId, '123456')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TOTP_LOCKED' }),
    });

    const lockedRow = testDatabase.__twoFactorRows.get(userId)!;
    expect(lockedRow.lockedUntil).toBeInstanceOf(Date);
    expect(lockedRow.backupCodes).not.toContain(backupCodes[0]);
  });

  it('allows a fresh attempt after a lock has expired', async () => {
    await completeEnrollment();
    await service.verifyToken(userId, '000000');
    const row = testDatabase.__twoFactorRows.get(userId)!;
    row.failedAttempts = 5;
    row.lockedUntil = new Date(Date.now() - 1_000);

    await expect(service.verifyToken(userId, '123456')).resolves.toMatchObject({
      success: true,
    });
    expect(testDatabase.__twoFactorRows.get(userId)?.failedAttempts).toBe(0);
    expect(testDatabase.__twoFactorRows.get(userId)?.lockedUntil).toBeNull();
  });

  it('requires the current password and TOTP before preparing an authenticator replacement', async () => {
    await completeEnrollment();
    const activeSecret = testDatabase.__twoFactorRows.get(userId)!.secretEncrypted;

    await expect(
      service.startAuthenticatorReplacement(
        userId,
        'unit@example.test',
        'wrong-password',
        '123456',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_PASSWORD' }),
    });
    await expect(
      service.startAuthenticatorReplacement(
        userId,
        'unit@example.test',
        'current-password',
        '000000',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_TOTP_CODE' }),
    });
    expect(testDatabase.__twoFactorRows.get(userId)!.pendingSecretEncrypted).toBeUndefined();

    jest
      .mocked(generateSecret)
      .mockReturnValueOnce('REPLACEMENTSECRETJBSWY3DPEHPK3PXP');
    const result = await service.startAuthenticatorReplacement(
      userId,
      'unit@example.test',
      'current-password',
      '123456',
    );

    const pendingRow = testDatabase.__twoFactorRows.get(userId)!;
    expect(result.qrCodeUrl).toContain('REPLACEMENTSECRETJBSWY3DPEHPK3PXP');
    expect(pendingRow.secretEncrypted).toBe(activeSecret);
    expect(pendingRow.pendingSecretEncrypted).toBeDefined();
  });

  it('activates a replacement only after its new TOTP verifies', async () => {
    await completeEnrollment();
    const oldSecret = testDatabase.__twoFactorRows.get(userId)!.secretEncrypted;
    jest
      .mocked(generateSecret)
      .mockReturnValueOnce('NEWACTIVATEDSECRETJBSWY3DPEHPK3PXP');
    await service.startAuthenticatorReplacement(
      userId,
      'unit@example.test',
      'current-password',
      '123456',
    );
    const pendingSecret = testDatabase.__twoFactorRows.get(userId)!.pendingSecretEncrypted;

    await expect(
      service.completeAuthenticatorReplacement(userId, '000000'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_TOTP_CODE' }),
    });
    expect(testDatabase.__twoFactorRows.get(userId)!.secretEncrypted).toBe(oldSecret);
    expect(testDatabase.__twoFactorRows.get(userId)!.pendingSecretEncrypted).toBe(pendingSecret);

    await service.completeAuthenticatorReplacement(userId, '123456');
    const completedRow = testDatabase.__twoFactorRows.get(userId)!;
    expect(completedRow.secretEncrypted).toBe(pendingSecret);
    expect(completedRow.pendingSecretEncrypted).toBeNull();
  });

  it('replaces old recovery codes only after current TOTP and stores the new codes as hashes', async () => {
    const { backupCodes } = await completeEnrollment();
    const originalCodes = [
      ...(testDatabase.__twoFactorRows.get(userId)!.backupCodes as string[]),
    ];

    await expect(
      service.regenerateRecoveryCodes(userId, '000000'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_TOTP_CODE' }),
    });
    expect(testDatabase.__twoFactorRows.get(userId)!.backupCodes).toEqual(originalCodes);

    const replacementCodes = await service.regenerateRecoveryCodes(userId, '123456');
    const storedHashes = testDatabase.__twoFactorRows.get(userId)!.backupCodes as string[];
    expect(replacementCodes).toHaveLength(10);
    expect(storedHashes).toHaveLength(10);
    expect(storedHashes).not.toContain(replacementCodes[0]);
    expect(storedHashes).not.toContain(backupCodes[0]);
    await expect(service.verifyToken(userId, backupCodes[0])).resolves.toMatchObject({
      success: false,
    });
    await expect(service.verifyToken(userId, replacementCodes[0])).resolves.toMatchObject({
      success: true,
      usedRecoveryCode: true,
    });
  });
});
