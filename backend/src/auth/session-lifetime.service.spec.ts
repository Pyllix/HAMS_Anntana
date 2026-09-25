import { SessionLifetimeService } from './session-lifetime.service';
import { sharedPrisma } from '../common/config/database.config';

type StoredSession = {
  id: string;
  token: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

const sessions = new Map<string, StoredSession>();
jest.mock('../common/config/database.config', () => ({
  sharedPrisma: {
    session: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const prismaSession = sharedPrisma.session as unknown as {
  findUnique: jest.Mock;
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
};

function createSession(input: Partial<StoredSession> = {}): StoredSession {
  const createdAt = input.createdAt ?? new Date('2026-09-25T00:00:00.000Z');
  return {
    id: input.id ?? 'session-1',
    token: input.token ?? 'session-token',
    userId: input.userId ?? 'user-1',
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    expiresAt:
      input.expiresAt ?? new Date(createdAt.getTime() + 12 * 60 * 60 * 1000),
  };
}

describe('SessionLifetimeService', () => {
  const service = new SessionLifetimeService();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-25T00:00:00.000Z'));
    sessions.clear();
    jest.clearAllMocks();
    prismaSession.findUnique.mockImplementation(
      async ({ where }: { where: { token: string } }) => {
        const session = sessions.get(where.token);
        return session ? { ...session } : null;
      },
    );
    prismaSession.updateMany.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string; updatedAt: Date; expiresAt: Date };
        data: Partial<StoredSession>;
      }) => {
        const session = [...sessions.values()].find(
          (candidate) => candidate.id === where.id,
        );
        if (
          !session ||
          session.updatedAt.getTime() !== where.updatedAt.getTime() ||
          session.expiresAt.getTime() !== where.expiresAt.getTime()
        ) {
          return { count: 0 };
        }
        Object.assign(session, data);
        return { count: 1 };
      },
    );
    prismaSession.deleteMany.mockImplementation(
      async ({
        where,
      }: {
        where: { id: string; updatedAt: Date; expiresAt: Date };
      }) => {
        const session = [...sessions.values()].find(
          (candidate) => candidate.id === where.id,
        );
        if (
          !session ||
          session.updatedAt.getTime() !== where.updatedAt.getTime() ||
          session.expiresAt.getTime() !== where.expiresAt.getTime()
        ) {
          return { count: 0 };
        }
        sessions.delete(session.token);
        return { count: 1 };
      },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a polling request from moving the idle deadline', async () => {
    const session = createSession();
    sessions.set(session.token, session);
    jest.advanceTimersByTime(55 * 60 * 1000);

    const window = await service.enforceSession(session.token, false);

    expect(window).toEqual({
      expiresAt: new Date('2026-09-25T01:00:00.000Z'),
      idleExpiresAt: new Date('2026-09-25T01:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-09-25T12:00:00.000Z'),
    });
    expect(session.updatedAt).toEqual(session.createdAt);
    expect(session.expiresAt).toEqual(window?.expiresAt);
  });

  it('extends idle expiry after a user action without moving absolute expiry', async () => {
    const session = createSession();
    sessions.set(session.token, session);
    jest.advanceTimersByTime(55 * 60 * 1000);

    const window = await service.enforceSession(session.token, true);

    expect(window).toEqual({
      expiresAt: new Date('2026-09-25T01:55:00.000Z'),
      idleExpiresAt: new Date('2026-09-25T01:55:00.000Z'),
      absoluteExpiresAt: new Date('2026-09-25T12:00:00.000Z'),
    });
    expect(session.updatedAt).toEqual(new Date('2026-09-25T00:55:00.000Z'));
    expect(session.expiresAt).toEqual(window?.expiresAt);
  });

  it('uses the latest valid deadline after concurrent update conflicts', async () => {
    const session = createSession();
    sessions.set(session.token, session);
    prismaSession.updateMany.mockImplementation(async () => {
      const activityAt = new Date();
      session.updatedAt = activityAt;
      session.expiresAt = new Date(activityAt.getTime() + 60 * 60 * 1000);
      return { count: 0 };
    });

    const window = await service.enforceSession(session.token, true);

    expect(window?.expiresAt).toEqual(new Date('2026-09-25T01:00:00.000Z'));
    expect(window?.absoluteExpiresAt).toEqual(
      new Date('2026-09-25T12:00:00.000Z'),
    );
    expect(prismaSession.updateMany).toHaveBeenCalledTimes(8);
  });
  it('keeps simultaneous device sessions independent', async () => {
    const firstDevice = createSession({
      token: 'device-one',
      userId: 'same-user',
    });
    const secondDevice = createSession({
      id: 'session-2',
      token: 'device-two',
      userId: 'same-user',
    });
    sessions.set(firstDevice.token, firstDevice);
    sessions.set(secondDevice.token, secondDevice);
    jest.advanceTimersByTime(30 * 60 * 1000);

    await service.enforceSession(firstDevice.token, true);
    const secondWindow = await service.enforceSession(
      secondDevice.token,
      false,
    );

    expect(firstDevice.updatedAt).toEqual(new Date('2026-09-25T00:30:00.000Z'));
    expect(secondDevice.updatedAt).toEqual(secondDevice.createdAt);
    expect(secondWindow?.expiresAt).toEqual(
      new Date('2026-09-25T01:00:00.000Z'),
    );
  });

  it('expires a session at the 60-minute idle boundary, even with an activity header', async () => {
    const session = createSession();
    sessions.set(session.token, session);
    jest.advanceTimersByTime(60 * 60 * 1000);

    await expect(
      service.enforceSession(session.token, true),
    ).resolves.toBeNull();
    expect(sessions.has(session.token)).toBe(false);
  });

  it('keeps the 12-hour absolute boundary fixed while activity continues', async () => {
    const session = createSession({
      updatedAt: new Date('2026-09-25T11:20:00.000Z'),
      expiresAt: new Date('2026-09-25T12:00:00.000Z'),
    });
    sessions.set(session.token, session);
    jest.setSystemTime(new Date('2026-09-25T11:50:00.000Z'));

    const beforeAbsoluteExpiry = await service.enforceSession(
      session.token,
      true,
    );

    expect(beforeAbsoluteExpiry?.expiresAt).toEqual(
      new Date('2026-09-25T12:00:00.000Z'),
    );
    expect(session.updatedAt).toEqual(new Date('2026-09-25T11:50:00.000Z'));

    jest.setSystemTime(new Date('2026-09-25T12:00:00.000Z'));
    await expect(
      service.enforceSession(session.token, true),
    ).resolves.toBeNull();
    expect(sessions.has(session.token)).toBe(false);
  });
});
