jest.mock('../common/config/database.config', () => {
  type Challenge = Record<string, unknown> & {
    id: string;
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  };
  const challenges = new Map<string, Challenge>();
  const sessions = new Set<string>();
  const users = new Map<string, Record<string, unknown>>();
  const lockTails = new Map<string, Promise<void>>();
  let nextId = 0;

  const clone = (row: Challenge | undefined) => (row ? { ...row } : null);
  const challengeModel = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: 'pre-auth-' + ++nextId,
        createdAt: new Date(),
        ...data,
      } as unknown as Challenge;
      challenges.set(row.id, row);
      return clone(row)!;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      const row = [...challenges.values()].find((item) =>
        Object.entries(where).every(([key, value]) => item[key] === value),
      );
      return clone(row ?? undefined);
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      const expiry = (where.expiresAt as { lte: Date } | undefined)?.lte;
      return [...challenges.values()]
        .filter((row) => !expiry || row.expiresAt <= expiry)
        .map((row) => ({ id: row.id }));
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const row = challenges.get(where.id);
      if (!row) throw new Error('Missing test pre-auth row');
      challenges.delete(where.id);
      return clone(row)!;
    },
  };
  const sessionModel = {
    deleteMany: async ({ where }: { where: { token: string } }) => ({
      count: Number(sessions.delete(where.token)),
    }),
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
      preAuthChallenge: challengeModel,
      session: sessionModel,
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
      preAuthChallenge: challengeModel,
      session: sessionModel,
      user: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          users.get(where.id) ?? null,
      },
      $transaction: transaction,
      __preAuthChallenges: challenges,
      __preAuthSessions: sessions,
      __preAuthUsers: users,
    },
    __preAuthChallenges: challenges,
    __preAuthSessions: sessions,
    __preAuthUsers: users,
  };
});

import * as crypto from 'crypto';
import { sharedPrisma } from '../common/config/database.config';
import { PreAuthService } from './pre-auth.service';

const testDatabase = sharedPrisma as unknown as {
  __preAuthChallenges: Map<string, Record<string, unknown>>;
  __preAuthSessions: Set<string>;
  __preAuthUsers: Map<string, Record<string, unknown>>;
};

describe('PreAuthService (isolated persistence)', () => {
  const service = new PreAuthService();
  const sessionToken = 'pending-normal-session-token';
  const sessionCookies = [
    'better-auth.session_token=pending-normal-session-token; HttpOnly; Path=/',
  ];

  beforeAll(() => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  beforeEach(() => {
    testDatabase.__preAuthChallenges.clear();
    testDatabase.__preAuthSessions.clear();
    testDatabase.__preAuthUsers.clear();
  });

  it('stores only an opaque challenge hash and encrypts the pending session', async () => {
    testDatabase.__preAuthSessions.add(sessionToken);
    const issued = await service.createChallenge({
      userId: 'admin-1',
      state: 'ENROLLMENT',
      sessionToken,
      sessionCookies,
    });
    const row = [...testDatabase.__preAuthChallenges.values()][0];

    expect(issued.token).not.toBe(row.tokenHash);
    expect(row.tokenHash).toBe(
      crypto.createHash('sha256').update(issued.token).digest('hex'),
    );
    expect(row.sessionTokenEncrypted).not.toContain(sessionToken);
    expect(row.sessionCookiesEncrypted).not.toContain(sessionCookies[0]);
    await expect(service.findChallenge(issued.token)).resolves.toMatchObject({
      userId: 'admin-1',
      state: 'ENROLLMENT',
    });
  });

  it('completes a challenge once and releases the pending session cookies', async () => {
    testDatabase.__preAuthSessions.add(sessionToken);
    const issued = await service.createChallenge({
      userId: 'admin-1',
      state: 'TOTP',
      sessionToken,
      sessionCookies,
    });

    const completed = await Promise.all([
      service.completeChallenge(issued.token),
      service.completeChallenge(issued.token),
    ]);
    const successful = completed.filter((result) => result !== null);

    expect(successful).toHaveLength(1);
    expect(successful[0]).toMatchObject({
      userId: 'admin-1',
      state: 'TOTP',
      sessionCookies,
    });
    expect(testDatabase.__preAuthChallenges.size).toBe(0);
  });

  it('revokes the hidden session when a challenge expires', async () => {
    testDatabase.__preAuthSessions.add(sessionToken);
    const issued = await service.createChallenge({
      userId: 'admin-1',
      state: 'ENROLLMENT',
      sessionToken,
      sessionCookies,
    });
    const row = [...testDatabase.__preAuthChallenges.values()][0];
    row.expiresAt = new Date(Date.now() - 1);

    await expect(service.findChallenge(issued.token)).resolves.toBeNull();
    expect(testDatabase.__preAuthChallenges.size).toBe(0);
    expect(testDatabase.__preAuthSessions.has(sessionToken)).toBe(false);
  });

  it('revokes a session when BetterAuth did not return a session cookie', async () => {
    testDatabase.__preAuthSessions.add(sessionToken);

    await expect(
      service.createChallenge({
        userId: 'admin-1',
        state: 'TOTP',
        sessionToken,
        sessionCookies: [],
      }),
    ).rejects.toThrow('Could not create a protected sign-in challenge');
    expect(testDatabase.__preAuthSessions.has(sessionToken)).toBe(false);
    expect(testDatabase.__preAuthChallenges.size).toBe(0);
  });
});