import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import { sharedPrisma } from '../common/config/database.config';

// Roles required to enroll in 2FA
const MANDATORY_2FA_ROLES = ['ADMIN', 'PARCEL_STAFF', 'ASSET_CENTER_STAFF'];

@Injectable()
export class TwoFactorService {
  constructor() {
    // Configure TOTP: 6 digits, 30 second window
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    authenticator.options = {
      window: 1, // Accept previous/current/next time step
      digits: 6,
      step: 30,
    };
  }

  /**
   * Check if a user's role requires 2FA enrollment
   */
  requiresTwoFactor(role: string): boolean {
    return MANDATORY_2FA_ROLES.includes(role);
  }

  /**
   * Check if user has completed 2FA enrollment
   */
  async hasCompletedEnrollment(userId: string): Promise<boolean> {
    const twoFactor = await sharedPrisma.twoFactorAuth.findUnique({
      where: { userId },
    });
    return !!twoFactor;
  }

  /**
   * Generate a new TOTP secret and return QR code data
   */
  async generateSecret(
    userId: string,
    userEmail: string,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    // Check if already enrolled
    const existing = await sharedPrisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new BadRequestException('2FA already enrolled');
    }

    // Generate secret
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const secret = authenticator.generateSecret();

    // Generate otpauth:// URI for QR code
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const otpauthUrl = authenticator.keyuri(userEmail, 'HAMS', secret);

    return {
      secret: secret as string,
      qrCodeUrl: otpauthUrl as string,
    };
  }

  /**
   * Verify TOTP code and complete enrollment
   */
  async verifyAndEnroll(
    userId: string,
    secret: string,
    token: string,
  ): Promise<{ backupCodes: string[] }> {
    // Verify the TOTP token
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Generate 10 recovery codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );

    // Hash backup codes before storing
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash('sha256').update(code).digest('hex'),
    );

    // Encrypt secret before storing
    const encryptedSecret = this.encryptSecret(secret);

    // Store in database
    await sharedPrisma.twoFactorAuth.create({
      data: {
        userId,
        secretEncrypted: encryptedSecret,
        backupCodes: hashedBackupCodes,
        enrolledAt: new Date(),
      },
    });

    return { backupCodes };
  }

  /**
   * Confirm that user has saved backup codes (complete enrollment)
   */
  async confirmBackupCodesSaved(userId: string): Promise<void> {
    const twoFactor = await sharedPrisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor) {
      throw new BadRequestException('2FA not enrolled');
    }

    // Enrollment is already complete when backup codes are generated
    // This is just a confirmation step
  }

  /**
   * Verify TOTP or recovery code for login
   */
  async verifyToken(
    userId: string,
    token: string,
  ): Promise<{ success: boolean; usedRecoveryCode?: boolean }> {
    const twoFactor = await sharedPrisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor) {
      return { success: false };
    }

    // Check if locked due to failed attempts
    if (twoFactor.lockedUntil && twoFactor.lockedUntil > new Date()) {
      throw new BadRequestException(
        'Account temporarily locked due to failed attempts',
      );
    }

    // First try recovery code (8 hex chars)
    if (/^[A-F0-9]{8}$/i.test(token)) {
      const recoveryResult = await this.tryRecoveryCode(userId, token);
      if (recoveryResult) {
        return { success: true, usedRecoveryCode: true };
      }
      // Fall through to try as TOTP in case it's a numeric code
    }

    // Try TOTP verification
    const secret = this.decryptSecret(twoFactor.secretEncrypted);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) {
      // Increment failed attempts
      const newFailedAttempts = twoFactor.failedAttempts + 1;
      const shouldLock = newFailedAttempts >= 5;

      await sharedPrisma.twoFactorAuth.update({
        where: { userId },
        data: {
          failedAttempts: newFailedAttempts,
          ...(shouldLock
            ? {
                lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
              }
            : {}),
        },
      });

      // Log lockout event
      if (shouldLock) {
        console.warn(
          `[2FA] User ${userId} locked due to ${newFailedAttempts} failed attempts`,
        );
      }

      return { success: false };
    }

    // Reset failed attempts and update last used
    await sharedPrisma.twoFactorAuth.update({
      where: { userId },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastUsedAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * Try to verify and consume a recovery code
   * Returns true if code was valid and consumed successfully
   */
  private async tryRecoveryCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    // Normalize to uppercase
    const normalizedCode = code.toUpperCase();
    const hashedCode = crypto
      .createHash('sha256')
      .update(normalizedCode)
      .digest('hex');

    // Use transaction with row lock to prevent race conditions
    try {
      const result = await sharedPrisma.$transaction(
        async (tx) => {
          // Lock the row for update to prevent concurrent modifications
          // Use raw query with FOR UPDATE to lock the row
          await tx.$executeRaw`SELECT 1 FROM two_factor_auth WHERE user_id = ${userId} FOR UPDATE`;

          const twoFactor = await tx.twoFactorAuth.findUnique({
            where: { userId },
          });

          if (!twoFactor) {
            return false;
          }

          // Check if locked
          if (twoFactor.lockedUntil && twoFactor.lockedUntil > new Date()) {
            throw new BadRequestException(
              'Account temporarily locked due to failed attempts',
            );
          }

          // Check if code exists in backup codes
          const codeIndex = twoFactor.backupCodes.indexOf(hashedCode);
          if (codeIndex === -1) {
            // Code not found - increment failed attempts
            const newFailedAttempts = twoFactor.failedAttempts + 1;
          const shouldLock = newFailedAttempts >= 5;

          await tx.twoFactorAuth.update({
            where: { userId },
            data: {
              failedAttempts: newFailedAttempts,
              ...(shouldLock
                ? {
                    lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
                  }
                : {}),
            },
          });

          if (shouldLock) {
            console.warn(
              `[2FA] User ${userId} locked due to ${newFailedAttempts} failed recovery code attempts`,
            );
          }

          return false;
        }

        // Remove the used recovery code
        const updatedCodes = [...twoFactor.backupCodes];
        updatedCodes.splice(codeIndex, 1);

        await tx.twoFactorAuth.update({
          where: { userId },
          data: {
            backupCodes: updatedCodes,
            failedAttempts: 0,
            lockedUntil: null,
            lastUsedAt: new Date(),
          },
        });

        console.info(
          `[2FA] User ${userId} successfully used recovery code (${updatedCodes.length} remaining)`,
        );

        return true;
      });

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Transaction failed - possibly concurrent usage
      console.error(`[2FA] Recovery code transaction failed for ${userId}`, error);
      return false;
    }
  }

  /**
   * Encrypt secret using AES-256-GCM
   */
  private encryptSecret(secret: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt secret
   */
  private decryptSecret(encryptedData: string): string {
    const key = this.getEncryptionKey();
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get encryption key from environment
   */
  private getEncryptionKey(): Buffer {
    const key = process.env.TWO_FACTOR_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      throw new Error(
        'TWO_FACTOR_ENCRYPTION_KEY must be 64 hex characters (32 bytes)',
      );
    }
    return Buffer.from(key, 'hex');
  }
}
