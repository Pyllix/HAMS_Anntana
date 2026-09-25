import { Injectable } from '@nestjs/common';
import { sharedPrisma } from '../common/config/database.config';

export const SESSION_ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const SESSION_IDLE_LIFETIME_MS = 60 * 60 * 1000;
const MAX_COMPARE_AND_SWAP_ATTEMPTS = 8;

export class SessionLifetimeContentionError extends Error {
  constructor() {
    super('Session changed repeatedly while enforcing its lifetime');
    this.name = 'SessionLifetimeContentionError';
  }
}

export interface SessionExpiryWindow {
  expiresAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

@Injectable()
export class SessionLifetimeService {
  async enforceSession(
    token: string,
    userActivity: boolean,
  ): Promise<SessionExpiryWindow | null> {
    for (
      let attempt = 0;
      attempt < MAX_COMPARE_AND_SWAP_ATTEMPTS;
      attempt += 1
    ) {
      const session = await sharedPrisma.session.findUnique({
        where: { token },
        select: {
          id: true,
          token: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true,
        },
      });
      if (!session) return null;

      const now = new Date();
      const absoluteExpiresAt = new Date(
        session.createdAt.getTime() + SESSION_ABSOLUTE_LIFETIME_MS,
      );
      const idleExpiresAt = new Date(
        session.updatedAt.getTime() + SESSION_IDLE_LIFETIME_MS,
      );
      const expiresAt = new Date(
        Math.min(
          session.expiresAt.getTime(),
          absoluteExpiresAt.getTime(),
          idleExpiresAt.getTime(),
        ),
      );
      const expected = {
        id: session.id,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
      };

      if (expiresAt <= now) {
        const deleted = await sharedPrisma.session.deleteMany({
          where: expected,
        });
        if (deleted.count === 1) return null;
        continue;
      }

      if (userActivity) {
        const nextIdleExpiresAt = new Date(
          now.getTime() + SESSION_IDLE_LIFETIME_MS,
        );
        const nextExpiresAt = new Date(
          Math.min(absoluteExpiresAt.getTime(), nextIdleExpiresAt.getTime()),
        );
        const updated = await sharedPrisma.session.updateMany({
          where: expected,
          data: { updatedAt: now, expiresAt: nextExpiresAt },
        });
        if (updated.count === 1) {
          return {
            expiresAt: nextExpiresAt,
            idleExpiresAt: nextExpiresAt,
            absoluteExpiresAt,
          };
        }
        continue;
      }

      if (session.expiresAt.getTime() > expiresAt.getTime()) {
        const clamped = await sharedPrisma.session.updateMany({
          where: expected,
          data: { expiresAt },
        });
        if (clamped.count !== 1) continue;
      }

      return {
        expiresAt,
        idleExpiresAt: new Date(
          Math.min(idleExpiresAt.getTime(), absoluteExpiresAt.getTime()),
        ),
        absoluteExpiresAt,
      };
    }

    throw new SessionLifetimeContentionError();
  }
}
