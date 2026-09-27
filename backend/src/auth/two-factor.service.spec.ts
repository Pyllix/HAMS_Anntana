import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorService } from './two-factor.service';
import { sharedPrisma } from '../common/config/database.config';

// Mock otplib with a deterministic secret and token
jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
  generateURI: jest.fn(
    ({
      issuer,
      label,
      secret,
    }: {
      issuer: string;
      label: string;
      secret: string;
    }) =>
      `otpauth://totp/${issuer}:${encodeURIComponent(label)}?secret=${secret}&issuer=${issuer}`,
  ),
  verify: jest.fn(({ token }: { token: string }) =>
    Promise.resolve({
      valid: token === '123456',
      delta: token === '123456' ? 0 : null,
    }),
  ),
}));

const TWO_FACTOR_TEST_USERS = ['user-123', 'test-user-id'];

describe('TwoFactorService', () => {
  let service: TwoFactorService;

  beforeAll(async () => {
    // Set up encryption key for tests
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);

    const module: TestingModule = await Test.createTestingModule({
      providers: [TwoFactorService],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
  });

  afterEach(async () => {
    // Clean up test data
    await sharedPrisma.twoFactorAuth.deleteMany({ where: { userId: { in: TWO_FACTOR_TEST_USERS } } });
    await sharedPrisma.trustedDevice.deleteMany({ where: { userId: { in: TWO_FACTOR_TEST_USERS } } });
  });

  afterAll(async () => {
    // Close Prisma connection
    await sharedPrisma.$disconnect();
  });

  describe('generateSecret', () => {
    it('should generate a valid TOTP secret and QR code', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const result = await service.generateSecret(userId, email);

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeUrl');
      expect(result.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(result.qrCodeUrl).toContain('otpauth://totp/');
      expect(result.qrCodeUrl).toContain(encodeURIComponent(email));
    });
  });

  describe('verifyAndEnroll', () => {
    it('should enroll user with valid TOTP token', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const validToken = '123456';

      const result = await service.verifyAndEnroll(userId, secret, validToken);
      await service.confirmBackupCodesSaved(userId);

      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes[0]).toMatch(/^[A-F0-9]{8}$/);

      const enrolled = await service.hasCompletedEnrollment(userId);
      expect(enrolled).toBe(true);
    });

    it('should reject enrollment with invalid token', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);

      await expect(
        service.verifyAndEnroll(userId, secret, '000000'),
      ).rejects.toThrow('Invalid TOTP code');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid TOTP token', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const validToken = '123456';

      await service.verifyAndEnroll(userId, secret, validToken);
      await service.confirmBackupCodesSaved(userId);

      const result = await service.verifyToken(userId, validToken);
      expect(result.success).toBe(true);
      expect(result.usedRecoveryCode).toBe(false);
    });

    it('should reject an invalid TOTP token', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const validToken = '123456';

      await service.verifyAndEnroll(userId, secret, validToken);
      await service.confirmBackupCodesSaved(userId);

      const result = await service.verifyToken(userId, '000000');
      expect(result.success).toBe(false);
    });

    it('should return false for non-enrolled user', async () => {
      const result = await service.verifyToken('non-existent-user', '123456');
      expect(result.success).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('should lock account after 5 failed attempts', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const validToken = '123456';

      await service.verifyAndEnroll(userId, secret, validToken);
      await service.confirmBackupCodesSaved(userId);

      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await service.verifyToken(userId, '000000');
      }

      // Should be locked now
      await expect(service.verifyToken(userId, '000000')).rejects.toThrow(
        'temporarily locked',
      );
    });

    it('should reset failed attempts after successful verification', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const validToken = '123456';

      await service.verifyAndEnroll(userId, secret, validToken);
      await service.confirmBackupCodesSaved(userId);

      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await service.verifyToken(userId, '000000');
      }

      // Successful verification should reset counter
      const result = await service.verifyToken(userId, validToken);
      expect(result.success).toBe(true);

      // Verify counter was reset by checking we can fail 5 more times
      for (let i = 0; i < 5; i++) {
        await service.verifyToken(userId, '000000');
      }

      await expect(service.verifyToken(userId, '000000')).rejects.toThrow(
        'temporarily locked',
      );
    });
  });
it('should allow verification after the lock expires', async () => {
      const userId = 'test-user-id';
      const { secret } = await service.generateSecret(userId, 'test@example.com');
      await service.verifyAndEnroll(userId, secret, '123456');
      await service.confirmBackupCodesSaved(userId);
      await sharedPrisma.twoFactorAuth.update({
        where: { userId },
        data: {
          failedAttempts: 5,
          lockedUntil: new Date(Date.now() - 1000),
        },
      });

      await expect(service.verifyToken(userId, '123456')).resolves.toMatchObject({
        success: true,
      });
      const row = await sharedPrisma.twoFactorAuth.findUnique({
        where: { userId },
      });
      expect(row?.failedAttempts).toBe(0);
      expect(row?.lockedUntil).toBeNull();
    });

  describe('hasCompletedEnrollment', () => {
    it('should return true for enrolled user', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';
      const { secret } = await service.generateSecret(userId, email);
      const validToken = '123456';

      await service.verifyAndEnroll(userId, secret, validToken);
      await service.confirmBackupCodesSaved(userId);

      const hasEnrolled = await service.hasCompletedEnrollment(userId);
      expect(hasEnrolled).toBe(true);
    });

    it('should return false for non-enrolled user', async () => {
      const hasEnrolled =
        await service.hasCompletedEnrollment('non-existent-user');
      expect(hasEnrolled).toBe(false);
    });
  });

  describe('requiresTwoFactor', () => {
    it('should require 2FA for admin role', () => {
      expect(service.requiresTwoFactor('ADMIN')).toBe(true);
    });

    it('should require 2FA for parcel staff', () => {
      expect(service.requiresTwoFactor('PARCEL_STAFF')).toBe(true);
    });

    it('should require 2FA for asset center staff', () => {
      expect(service.requiresTwoFactor('ASSET_CENTER_STAFF')).toBe(true);
    });

    it('should not require 2FA for student role', () => {
      expect(service.requiresTwoFactor('STUDENT')).toBe(false);
    });
  });

  describe('recovery codes', () => {
    it('should accept valid recovery code and consume it', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const { backupCodes } = await service.verifyAndEnroll(
        userId,
        secret,
        '123456',
      );
      await service.confirmBackupCodesSaved(userId);

      // Use first recovery code
      const result = await service.verifyToken(userId, backupCodes[0]);
      expect(result.success).toBe(true);
      expect(result.usedRecoveryCode).toBe(true);

      // Same code should not work again
      const secondAttempt = await service.verifyToken(userId, backupCodes[0]);
      expect(secondAttempt.success).toBe(false);
    });

    it('should reject invalid recovery code', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      await service.verifyAndEnroll(userId, secret, '123456');
      await service.confirmBackupCodesSaved(userId);

      const result = await service.verifyToken(userId, 'DEADBEEF');
      expect(result.success).toBe(false);
    });

    it('should count recovery code failures toward lockout', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      await service.verifyAndEnroll(userId, secret, '123456');
      await service.confirmBackupCodesSaved(userId);

      // 3 failed TOTP attempts
      for (let i = 0; i < 3; i++) {
        await service.verifyToken(userId, '000000');
      }

      // 2 failed recovery code attempts should trigger lockout
      for (let i = 0; i < 2; i++) {
        await service.verifyToken(userId, 'DEADBEEF');
      }

      // Should be locked now
      await expect(service.verifyToken(userId, '123456')).rejects.toThrow(
        'temporarily locked',
      );
    });

    it('should handle concurrent recovery code usage', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const { backupCodes } = await service.verifyAndEnroll(
        userId,
        secret,
        '123456',
      );
      await service.confirmBackupCodesSaved(userId);

      // Try to use same code concurrently
      const results = await Promise.all([
        service.verifyToken(userId, backupCodes[0]),
        service.verifyToken(userId, backupCodes[0]),
      ]);

      // Only one should succeed
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(1);
    });

    it('should accept recovery code regardless of case', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const { backupCodes } = await service.verifyAndEnroll(
        userId,
        secret,
        '123456',
      );
      await service.confirmBackupCodesSaved(userId);

      // Use lowercase version of uppercase code
      const result = await service.verifyToken(
        userId,
        backupCodes[0].toLowerCase(),
      );
      expect(result.success).toBe(true);
      expect(result.usedRecoveryCode).toBe(true);
    });

    it('should reset failed attempts after successful recovery code usage', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const { backupCodes } = await service.verifyAndEnroll(
        userId,
        secret,
        '123456',
      );
      await service.confirmBackupCodesSaved(userId);

      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await service.verifyToken(userId, '000000');
      }

      // Use recovery code
      const result = await service.verifyToken(userId, backupCodes[0]);
      expect(result.success).toBe(true);

      // Should be able to fail 5 more times before lockout
      for (let i = 0; i < 5; i++) {
        await service.verifyToken(userId, '000000');
      }

      await expect(service.verifyToken(userId, '000000')).rejects.toThrow(
        'temporarily locked',
      );
    });
  });
});