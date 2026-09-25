import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorService } from './two-factor.service';
import { sharedPrisma } from '../common/config/database.config';

// Mock otplib with a deterministic secret
jest.mock('otplib', () => ({
  authenticator: {
    options: {},
    generateSecret: jest.fn(() => 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
    keyuri: jest.fn(
      (email: string, issuer: string) =>
        `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=${issuer}`,
    ),
    verify: jest.fn(({ token }: { token: string }) => {
      // Simple mock: accept '123456' as valid for any secret
      return token === '123456';
    }),
    generate: jest.fn(() => '123456'),
  },
}));

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
    await sharedPrisma.twoFactorAuth.deleteMany({});
    await sharedPrisma.trustedDevice.deleteMany({});
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

      const isValid = await service.verifyToken(userId, validToken);
      expect(isValid).toBe(true);
    });

    it('should reject an invalid TOTP token', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const validToken = '123456';

      await service.verifyAndEnroll(userId, secret, validToken);

      const isValid = await service.verifyToken(userId, '000000');
      expect(isValid).toBe(false);
    });

    it('should return false for non-enrolled user', async () => {
      const isValid = await service.verifyToken('non-existent-user', '123456');
      expect(isValid).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('should lock account after 5 failed attempts', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const { secret } = await service.generateSecret(userId, email);
      const validToken = '123456';

      await service.verifyAndEnroll(userId, secret, validToken);

      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await service.verifyToken(userId, '000000');
      }

      // Should be locked now
      await expect(service.verifyToken(userId, '000000')).rejects.toThrow(
        'Account temporarily locked',
      );
    });
  });

  describe('hasCompletedEnrollment', () => {
    it('should return true for enrolled user', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';
      const { secret } = await service.generateSecret(userId, email);
      const validToken = '123456';

      await service.verifyAndEnroll(userId, secret, validToken);

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
});
