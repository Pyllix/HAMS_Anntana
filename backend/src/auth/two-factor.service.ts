import {
  BadRequestException,
  GoneException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';
import { verifyPassword } from 'better-auth/crypto';
import type { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { sharedPrisma } from '../common/config/database.config';

const MANDATORY_2FA_ROLES = [
  'ADMIN',
  'PARCEL_STAFF',
  'ASSET_CENTER_STAFF',
];
const LOCKOUT_LIMIT = 5;
const LOCKOUT_MS = 10 * 60 * 1000;

@Injectable()
export class TwoFactorService {
  requiresTwoFactor(role: string): boolean {
    return MANDATORY_2FA_ROLES.includes(role);
  }

  async hasCompletedEnrollment(userId: string): Promise<boolean> {
    const twoFactor = await sharedPrisma.twoFactorAuth.findUnique({
      where: { userId },
      select: { enrollmentComplete: true },
    });
    return twoFactor?.enrollmentComplete === true;
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const account = await sharedPrisma.account.findFirst({
      where: { userId, providerId: 'credential' },
      select: { password: true },
    });
    if (!account?.password) return false;
    return verifyPassword({ hash: account.password, password });
  }

  async generateSecret(
    userId: string,
    userEmail: string,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    const existing = await sharedPrisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (existing?.enrollmentComplete) {
      throw new BadRequestException({
        code: 'ALREADY_ENROLLED',
        message: '2FA is already enrolled',
      });
    }
    if (existing?.backupCodes.length) {
      throw new BadRequestException({
        code: 'RECOVERY_CODES_ALREADY_ISSUED',
        message: 'Confirm that the recovery codes are saved to finish setup',
      });
    }

    const secret = existing
      ? this.decryptSecret(existing.secretEncrypted)
      : generateSecret();

    if (!existing) {
      await sharedPrisma.twoFactorAuth.create({
        data: {
          userId,
          secretEncrypted: this.encryptSecret(secret),
          backupCodes: [],
          enrollmentComplete: false,
          failedAttempts: 0,
        },
      });
    }

    return {
      secret,
      qrCodeUrl: generateURI({
        issuer: 'HAMS',
        label: userEmail,
        secret,
      }),
    };
  }

  async verifyPendingEnrollment(
    userId: string,
    token: string,
  ): Promise<{ backupCodes: string[] }> {
    const row = await sharedPrisma.twoFactorAuth.findUnique({
      where: { userId },
      select: { secretEncrypted: true },
    });
    if (!row) {
      throw new BadRequestException({
        code: 'ENROLLMENT_NOT_STARTED',
        message: 'Generate an authenticator secret before verifying setup',
      });
    }
    return this.verifyAndEnroll(
      userId,
      this.decryptSecret(row.secretEncrypted),
      token,
    );
  }
  async verifyAndEnroll(
    userId: string,
    secret: string,
    token: string,
  ): Promise<{ backupCodes: string[] }> {
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );
    const hashedBackupCodes = backupCodes.map((code) => this.hashCode(code));

    const valid = await sharedPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM two_factor_auth WHERE user_id = $1 FOR UPDATE',
        userId,
      );
      const row = await tx.twoFactorAuth.findUnique({ where: { userId } });
      if (!row) {
        throw new BadRequestException({
          code: 'ENROLLMENT_NOT_STARTED',
          message: 'Generate an authenticator secret before verifying it',
        });
      }
      if (row.enrollmentComplete || row.backupCodes.length > 0) {
        throw new BadRequestException({
          code: row.enrollmentComplete
            ? 'ALREADY_ENROLLED'
            : 'RECOVERY_CODES_ALREADY_ISSUED',
          message: 'The enrollment is already active or awaiting confirmation',
        });
      }

      const now = new Date();
      if (row.lockedUntil && row.lockedUntil > now) {
        throw this.lockedException(row.lockedUntil);
      }
      const failedAttempts =
        row.lockedUntil && row.lockedUntil <= now ? 0 : row.failedAttempts;

      const storedSecret = this.decryptSecret(row.secretEncrypted);
      if (storedSecret !== secret) {
        throw new BadRequestException({
          code: 'INVALID_TOTP_CODE',
          message: 'The authenticator setup is invalid',
        });
      }
      const { valid: tokenValid } = await verify({
        token,
        secret: storedSecret,
        epochTolerance: 30,
      });
      if (!tokenValid) {
        const nextAttempts = failedAttempts + 1;
        const lockedUntil =
          nextAttempts >= LOCKOUT_LIMIT
            ? new Date(now.getTime() + LOCKOUT_MS)
            : null;
        await tx.twoFactorAuth.update({
          where: { userId },
          data: { failedAttempts: nextAttempts, lockedUntil },
        });
        if (lockedUntil) this.logLockout(userId);
        return false;
      }

      await tx.twoFactorAuth.update({
        where: { userId },
        data: {
          backupCodes: hashedBackupCodes,
          enrolledAt: now,
          enrollmentComplete: false,
          failedAttempts: 0,
          lockedUntil: null,
          lastUsedAt: now,
        },
      });
      return true;
    });

    if (!valid) {
      throw new BadRequestException({
        code: 'INVALID_TOTP_CODE',
        message: 'Invalid TOTP code',
      });
    }
    return { backupCodes };
  }

  async confirmBackupCodesSaved(userId: string): Promise<void> {
    const row = await sharedPrisma.twoFactorAuth.findUnique({
      where: { userId },
    });
    if (!row || row.backupCodes.length !== 10) {
      throw new BadRequestException({
        code: 'RECOVERY_CODES_NOT_SHOWN',
        message: 'Recovery codes must be issued before confirming enrollment',
      });
    }
    await sharedPrisma.twoFactorAuth.update({
      where: { userId },
      data: { enrollmentComplete: true },
    });
  }

  async startAuthenticatorReplacement(
    userId: string,
    userEmail: string,
    currentPassword: string,
    currentTotpCode: string,
  ): Promise<{ qrCodeUrl: string }> {
    if (!(await this.verifyPassword(userId, currentPassword))) {
      throw new BadRequestException({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      });
    }

    const newSecret = generateSecret();
    const verified = await sharedPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM two_factor_auth WHERE user_id = $1 FOR UPDATE',
        userId,
      );
      const row = await tx.twoFactorAuth.findUnique({ where: { userId } });
      if (!row?.enrollmentComplete) {
        throw new BadRequestException({
          code: 'ENROLLMENT_REQUIRED',
          message: 'Complete authenticator enrollment before replacing it',
        });
      }

      const valid = await this.verifySensitiveTotp(
        tx,
        userId,
        row,
        currentTotpCode,
      );
      if (!valid) return false;

      await tx.twoFactorAuth.update({
        where: { userId },
        data: { pendingSecretEncrypted: this.encryptSecret(newSecret) },
      });
      return true;
    });

    if (!verified) throw this.invalidTotpException();
    return {
      qrCodeUrl: generateURI({
        issuer: 'HAMS',
        label: userEmail,
        secret: newSecret,
      }),
    };
  }

  async completeAuthenticatorReplacement(
    userId: string,
    newTotpCode: string,
  ): Promise<void> {
    const verified = await sharedPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM two_factor_auth WHERE user_id = $1 FOR UPDATE',
        userId,
      );
      const row = await tx.twoFactorAuth.findUnique({ where: { userId } });
      if (!row?.enrollmentComplete || !row.pendingSecretEncrypted) {
        throw new BadRequestException({
          code: 'AUTHENTICATOR_REPLACEMENT_NOT_STARTED',
          message: 'Start authenticator replacement before confirming it',
        });
      }

      const valid = await this.verifySensitiveTotp(
        tx,
        userId,
        row,
        newTotpCode,
        row.pendingSecretEncrypted,
      );
      if (!valid) return false;

      await tx.twoFactorAuth.update({
        where: { userId },
        data: {
          secretEncrypted: row.pendingSecretEncrypted,
          pendingSecretEncrypted: null,
          failedAttempts: 0,
          lockedUntil: null,
          lastUsedAt: new Date(),
        },
      });
      return true;
    });

    if (!verified) throw this.invalidTotpException();
  }

  async regenerateRecoveryCodes(
    userId: string,
    currentTotpCode: string,
  ): Promise<string[]> {
    const recoveryCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );
    const hashedRecoveryCodes = recoveryCodes.map((code) => this.hashCode(code));
    const verified = await sharedPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM two_factor_auth WHERE user_id = $1 FOR UPDATE',
        userId,
      );
      const row = await tx.twoFactorAuth.findUnique({ where: { userId } });
      if (!row?.enrollmentComplete) {
        throw new BadRequestException({
          code: 'ENROLLMENT_REQUIRED',
          message: 'Complete authenticator enrollment before issuing recovery codes',
        });
      }

      const valid = await this.verifySensitiveTotp(
        tx,
        userId,
        row,
        currentTotpCode,
      );
      if (!valid) return false;

      await tx.twoFactorAuth.update({
        where: { userId },
        data: { backupCodes: hashedRecoveryCodes },
      });
      return true;
    });

    if (!verified) throw this.invalidTotpException();
    return recoveryCodes;
  }

  async verifyCurrentTotp(userId: string, token: string): Promise<void> {
    const verified = await sharedPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM two_factor_auth WHERE user_id = $1 FOR UPDATE',
        userId,
      );
      const row = await tx.twoFactorAuth.findUnique({ where: { userId } });
      if (!row?.enrollmentComplete) {
        throw new BadRequestException({
          code: 'ENROLLMENT_REQUIRED',
          message: 'Complete authenticator enrollment before verifying TOTP',
        });
      }
      return this.verifySensitiveTotp(tx, userId, row, token);
    });

    if (!verified) throw this.invalidTotpException();
  }

  private async verifySensitiveTotp(
    tx: Prisma.TransactionClient,
    userId: string,
    row: {
      secretEncrypted: string;
      failedAttempts: number;
      lockedUntil: Date | null;
    },
    token: string,
    secretEncrypted = row.secretEncrypted,
  ): Promise<boolean> {
    const now = new Date();
    if (row.lockedUntil && row.lockedUntil > now) {
      throw this.lockedException(row.lockedUntil);
    }

    const tokenValid =
      /^\d{6}$/.test(token) &&
      (
        await verify({
          token,
          secret: this.decryptSecret(secretEncrypted),
          epochTolerance: 30,
        })
      ).valid;
    if (!tokenValid) {
      const failedAttempts =
        row.lockedUntil && row.lockedUntil <= now ? 0 : row.failedAttempts;
      const nextAttempts = failedAttempts + 1;
      const lockedUntil =
        nextAttempts >= LOCKOUT_LIMIT
          ? new Date(now.getTime() + LOCKOUT_MS)
          : null;
      await tx.twoFactorAuth.update({
        where: { userId },
        data: { failedAttempts: nextAttempts, lockedUntil },
      });
      if (lockedUntil) this.logLockout(userId);
      return false;
    }

    await tx.twoFactorAuth.update({
      where: { userId },
      data: { failedAttempts: 0, lockedUntil: null, lastUsedAt: now },
    });
    return true;
  }

  private invalidTotpException(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_TOTP_CODE',
      message: 'Invalid TOTP code',
    });
  }

  async verifyToken(
    userId: string,
    token: string,
  ): Promise<{
    success: boolean;
    usedRecoveryCode?: boolean;
    codesRemaining?: number;
    attemptsRemaining?: number;
  }> {
    const normalized = typeof token === 'string' ? token.trim() : '';
    return sharedPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM two_factor_auth WHERE user_id = $1 FOR UPDATE',
        userId,
      );
      const row = await tx.twoFactorAuth.findUnique({ where: { userId } });
      if (!row || !row.enrollmentComplete) return { success: false };

      const now = new Date();
      if (row.lockedUntil && row.lockedUntil > now) {
        throw this.lockedException(row.lockedUntil);
      }
      const failedAttempts =
        row.lockedUntil && row.lockedUntil <= now ? 0 : row.failedAttempts;

      let isValid = false;
      let usedRecoveryCode = false;
      let updatedCodes = row.backupCodes;

      if (/^\d{6}$/.test(normalized)) {
        const secret = this.decryptSecret(row.secretEncrypted);
        const result = await verify({
          token: normalized,
          secret,
          epochTolerance: 30,
        });
        isValid = result.valid;
      } else if (/^[A-F0-9]{8}$/i.test(normalized)) {
        if (row.backupCodes.length === 0) {
          throw new GoneException({
            code: 'ALL_RECOVERY_CODES_USED',
            message: 'All recovery codes have already been used',
          });
        }
        const hash = this.hashCode(normalized);
        const index = row.backupCodes.indexOf(hash);
        if (index >= 0) {
          updatedCodes = [...row.backupCodes];
          updatedCodes.splice(index, 1);
          isValid = true;
          usedRecoveryCode = true;
        }
      }

      if (!isValid) {
        const nextAttempts = failedAttempts + 1;
        const lockedUntil =
          nextAttempts >= LOCKOUT_LIMIT
            ? new Date(now.getTime() + LOCKOUT_MS)
            : null;
        await tx.twoFactorAuth.update({
          where: { userId },
          data: { failedAttempts: nextAttempts, lockedUntil },
        });
        if (lockedUntil) this.logLockout(userId);
        return {
          success: false,
          attemptsRemaining: Math.max(0, LOCKOUT_LIMIT - nextAttempts),
        };
      }

      await tx.twoFactorAuth.update({
        where: { userId },
        data: {
          backupCodes: updatedCodes,
          failedAttempts: 0,
          lockedUntil: null,
          lastUsedAt: now,
        },
      });
      return {
        success: true,
        usedRecoveryCode,
        codesRemaining: updatedCodes.length,
      };
    });
  }

  private lockedException(lockedUntil: Date): HttpException {
    return new HttpException(
      {
        code: 'TOTP_LOCKED',
        message: 'Two-factor verification is temporarily locked',
        statusCode: 423,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
        ),
      },
      423,
    );
  }

  private logLockout(userId: string): void {
    console.warn('[2FA] Temporary verification lockout for user ' + userId);
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
  }

  private encryptSecret(secret: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return [
      iv.toString('hex'),
      cipher.getAuthTag().toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  private decryptSecret(encryptedData: string): string {
    const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted authenticator secret');
    }
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
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
