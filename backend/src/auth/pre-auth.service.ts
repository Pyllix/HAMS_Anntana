import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { sharedPrisma } from '../common/config/database.config';

export type PreAuthState = 'ENROLLMENT' | 'TOTP';

export interface PreAuthChallenge {
  id: string;
  userId: string;
  state: PreAuthState;
  expiresAt: Date;
}

export interface CompletedPreAuth {
  userId: string;
  state: PreAuthState;
  sessionCookies: string[];
}

@Injectable()
export class PreAuthService {
  static readonly ttlMs = 10 * 60 * 1000;

  async createChallenge(input: {
    userId: string;
    state: PreAuthState;
    sessionToken: string;
    sessionCookies: string[];
  }): Promise<{ token: string; expiresAt: Date }> {
    if (
      !input.sessionToken ||
      !input.sessionCookies.some((cookie) =>
        /(?:__Secure-|__Host-)?better-auth\.session_token=/i.test(cookie),
      )
    ) {
      await this.revokeSession(input.sessionToken);
      throw new InternalServerErrorException(
        'Could not create a protected sign-in challenge',
      );
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + PreAuthService.ttlMs);
    await sharedPrisma.preAuthChallenge.create({
      data: {
        userId: input.userId,
        state: input.state,
        tokenHash: this.hashToken(token),
        sessionTokenEncrypted: this.encrypt(input.sessionToken),
        sessionCookiesEncrypted: this.encrypt(
          JSON.stringify(input.sessionCookies),
        ),
        expiresAt,
      },
    });
    return { token, expiresAt };
  }

  async findChallenge(token: string | undefined): Promise<PreAuthChallenge | null> {
    if (!token || token.length > 128) return null;
    const row = await sharedPrisma.preAuthChallenge.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!row) return null;
    if (row.expiresAt <= new Date()) {
      await this.cancelById(row.id);
      return null;
    }
    return {
      id: row.id,
      userId: row.userId,
      state: row.state as PreAuthState,
      expiresAt: row.expiresAt,
    };
  }

  async getUserSnapshot(userId: string) {
    return sharedPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstname: true,
        role: true,
      },
    });
  }

  async completeChallenge(
    token: string | undefined,
  ): Promise<CompletedPreAuth | null> {
    if (!token || token.length > 128) return null;
    const tokenHash = this.hashToken(token);
    return sharedPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT id FROM pre_auth_challenges WHERE token_hash = $1 FOR UPDATE',
        tokenHash,
      );
      const row = await tx.preAuthChallenge.findUnique({
        where: { tokenHash },
      });
      if (!row) return null;

      if (row.expiresAt <= new Date()) {
        await tx.session.deleteMany({
          where: { token: this.decrypt(row.sessionTokenEncrypted) },
        });
        await tx.preAuthChallenge.delete({ where: { id: row.id } });
        return null;
      }

      const sessionCookies = JSON.parse(
        this.decrypt(row.sessionCookiesEncrypted),
      ) as unknown;
      if (
        !Array.isArray(sessionCookies) ||
        !sessionCookies.every((cookie) => typeof cookie === 'string')
      ) {
        await tx.session.deleteMany({
          where: { token: this.decrypt(row.sessionTokenEncrypted) },
        });
        await tx.preAuthChallenge.delete({ where: { id: row.id } });
        return null;
      }

      await tx.preAuthChallenge.delete({ where: { id: row.id } });
      return {
        userId: row.userId,
        state: row.state as PreAuthState,
        sessionCookies,
      };
    });
  }

  async cancelChallenge(token: string | undefined): Promise<void> {
    if (!token || token.length > 128) return;
    const row = await sharedPrisma.preAuthChallenge.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (row) await this.cancelById(row.id);
  }

  async cleanupExpired(): Promise<number> {
    const expired = await sharedPrisma.preAuthChallenge.findMany({
      where: { expiresAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const row of expired) await this.cancelById(row.id);
    return expired.length;
  }

  private async cancelById(id: string): Promise<void> {
    await sharedPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT id FROM pre_auth_challenges WHERE id = $1 FOR UPDATE',
        id,
      );
      const row = await tx.preAuthChallenge.findUnique({ where: { id } });
      if (!row) return;
      await tx.session.deleteMany({
        where: { token: this.decrypt(row.sessionTokenEncrypted) },
      });
      await tx.preAuthChallenge.delete({ where: { id } });
    });
  }

  private async revokeSession(sessionToken: string): Promise<void> {
    if (!sessionToken) return;
    await sharedPrisma.session.deleteMany({ where: { token: sessionToken } });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private encrypt(value: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [
      iv.toString('hex'),
      cipher.getAuthTag().toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  private decrypt(value: string): string {
    const [ivHex, tagHex, encryptedHex] = value.split(':');
    if (!ivHex || !tagHex || !encryptedHex) {
      throw new Error('Invalid encrypted pre-auth payload');
    }
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getEncryptionKey(): Buffer {
    const configuredKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
    if (!configuredKey || !/^[a-f0-9]{64}$/i.test(configuredKey)) {
      throw new Error(
        'TWO_FACTOR_ENCRYPTION_KEY must be 64 hex characters (32 bytes)',
      );
    }
    return Buffer.from(configuredKey, 'hex');
  }
}