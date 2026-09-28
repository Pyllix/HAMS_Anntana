jest.mock('../common/config/database.config', () => {
  type Device = Record<string, unknown> & { id: string; token: string; userId: string };
  const rows = new Map<string, Device>();
  let nextId = 0;

  const matches = (row: Device, where: Record<string, unknown>) => {
    if (typeof where.userId === 'string' && row.userId !== where.userId) return false;
    if (typeof where.id === 'string' && row.id !== where.id) return false;
    if (typeof where.token === 'string' && row.token !== where.token) return false;
    const expiry = where.expiresAt as { lte?: Date; gt?: Date } | undefined;
    if (expiry?.lte && (row.expiresAt as Date) > expiry.lte) return false;
    if (expiry?.gt && (row.expiresAt as Date) <= expiry.gt) return false;
    const alternatives = where.OR as Array<Record<string, unknown>> | undefined;
    if (alternatives && !alternatives.some((condition) => matches(row, condition))) {
      return false;
    }
    return true;
  };

  const model = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: 'trusted-device-' + ++nextId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      } as unknown as Device;
      rows.set(row.id, row);
      return { ...row };
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      const row = [...rows.values()].find((item) => matches(item, where));
      return row ? { ...row } : null;
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      [...rows.values()]
        .filter((row) => matches(row, where))
        .sort(
          (left, right) =>
            (right.grantedAt as Date).getTime() -
            (left.grantedAt as Date).getTime(),
        )
        .map((row) => ({ ...row })),
    deleteMany: async ({ where }: { where?: Record<string, unknown> }) => {
      let count = 0;
      for (const [id, row] of rows) {
        if (where && matches(row, where)) count += Number(rows.delete(id));
      }
      return { count };
    },
  };

  return {
    sharedPrisma: { trustedDevice: model, __trustedDeviceRows: rows },
    __trustedDeviceRows: rows,
  };
});

import { sharedPrisma } from '../common/config/database.config';
import { TrustedBrowserService } from './trusted-browser.service';

const testDatabase = sharedPrisma as unknown as {
  __trustedDeviceRows: Map<string, Record<string, unknown>>;
};

describe('TrustedBrowserService (isolated persistence)', () => {
  const service = new TrustedBrowserService();

  beforeEach(() => {
    testDatabase.__trustedDeviceRows.clear();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('stores only a token hash and uses an absolute 14-day expiry', async () => {
    const before = Date.now();
    const grant = await service.grantTrust('account-a', 'Chrome 120.0.0', '127.0.0.1');
    const device = [...testDatabase.__trustedDeviceRows.values()][0];

    expect(grant.token).not.toBe(device.token);
    expect(device.token).toMatch(/^[a-f0-9]{64}$/);
    expect(grant.expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      14 * 24 * 60 * 60 * 1000 - 100,
    );
    expect(grant.expiresAt.getTime() - (device.grantedAt as Date).getTime()).toBe(
      14 * 24 * 60 * 60 * 1000,
    );
  });

  it('trusts only the same account and does not extend expiry on sign-in', async () => {
    const grant = await service.grantTrust('account-a', 'Chrome 120.0.0', '127.0.0.1');
    const before = [...testDatabase.__trustedDeviceRows.values()][0];
    const result = await service.resolveTrustForSignIn('account-a', grant.token);
    const after = [...testDatabase.__trustedDeviceRows.values()][0];

    expect(result).toEqual({ trusted: true, revokedOtherUser: false });
    expect(after.expiresAt).toEqual(before.expiresAt);
    expect(after.grantedAt).toEqual(before.grantedAt);

    await expect(
      service.resolveTrustForSignIn('account-b', grant.token),
    ).resolves.toEqual({ trusted: false, revokedOtherUser: true });
    expect(testDatabase.__trustedDeviceRows.size).toBe(0);
  });

  it('removes expired trust and never exposes the cookie token in browser listings', async () => {
    const grant = await service.grantTrust('account-a', 'Chrome 120.0.0', '127.0.0.1');
    const device = [...testDatabase.__trustedDeviceRows.values()][0];
    device.expiresAt = new Date(Date.now() - 1);

    await expect(
      service.resolveTrustForSignIn('account-a', grant.token),
    ).resolves.toEqual({ trusted: false, revokedOtherUser: false });
    expect(testDatabase.__trustedDeviceRows.size).toBe(0);

    await service.grantTrust('account-a', 'Firefox 120.0.0', '127.0.0.2');
    const browsers = await service.getTrustedBrowsers('account-a');
    expect(browsers).toHaveLength(1);
    expect(browsers[0]).not.toHaveProperty('token');
  });
});