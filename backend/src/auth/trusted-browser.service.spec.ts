import { Test, TestingModule } from '@nestjs/testing';
import { TrustedBrowserService } from './trusted-browser.service';
import { sharedPrisma } from '../common/config/database.config';

describe('TrustedBrowserService', () => {
  const TRUST_TEST_USERS = ['test-user-1', 'user-a', 'user-b'];
  let service: TrustedBrowserService;

  beforeAll(async () => {
    // Ensure clean state before all tests
    await sharedPrisma.trustedDevice.deleteMany({ where: { userId: { in: TRUST_TEST_USERS } } });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrustedBrowserService],
    }).compile();

    service = module.get<TrustedBrowserService>(TrustedBrowserService);

    // Clean up test data
    await sharedPrisma.trustedDevice.deleteMany({ where: { userId: { in: TRUST_TEST_USERS } } });
  });

  afterEach(async () => {
    await sharedPrisma.trustedDevice.deleteMany({ where: { userId: { in: TRUST_TEST_USERS } } });
  });

  afterAll(async () => {
    // Final cleanup
    await sharedPrisma.trustedDevice.deleteMany({ where: { userId: { in: TRUST_TEST_USERS } } });
  });

  describe('grantTrust', () => {
    it('should grant trust for 14 days', async () => {
      const userId = 'test-user-1';
      const userAgent = 'Mozilla/5.0 Chrome/120.0.0.0';
      const ipAddress = '192.168.1.1';

      const result = await service.grantTrust(userId, userAgent, ipAddress);

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');

      const device = await sharedPrisma.trustedDevice.findFirst({
        where: { userId },
      });

      expect(device).toBeDefined();
      expect(device?.userId).toBe(userId);

      // Check that expiration is approximately 14 days
      const expiryDiff =
        device!.expiresAt.getTime() - device!.grantedAt.getTime();
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;
      expect(expiryDiff).toBeGreaterThanOrEqual(fourteenDays - 1000);
      expect(expiryDiff).toBeLessThanOrEqual(fourteenDays + 1000);
    });

    it('should revoke A trust when B signs in with A browser cookie', async () => {
      const userAgent = 'Mozilla/5.0 Chrome/120.0.0.0';
      const ipAddress = '192.168.1.1';

      const grantA = await service.grantTrust('user-a', userAgent, ipAddress);
      const signInB = await service.resolveTrustForSignIn('user-b', grantA.token);

      expect(signInB).toEqual({ trusted: false, revokedOtherUser: true });
      expect(
        await sharedPrisma.trustedDevice.count({ where: { userId: 'user-a' } }),
      ).toBe(0);

      await service.grantTrust('user-b', userAgent, ipAddress);
      expect(
        await sharedPrisma.trustedDevice.count({ where: { userId: 'user-b' } }),
      ).toBe(1);
    });

    it('should replace old trust for same user on same browser', async () => {
      const userId = 'test-user-1';
      const userAgent = 'Mozilla/5.0 Chrome/120.0.0.0';
      const ipAddress = '192.168.1.1';

      const result1 = await service.grantTrust(userId, userAgent, ipAddress);
      const result2 = await service.grantTrust(userId, userAgent, ipAddress, result1.token);

      expect(result1.token).not.toBe(result2.token);

      const devices = await sharedPrisma.trustedDevice.findMany({
        where: { userId },
      });

      expect(devices).toHaveLength(1);
      expect(devices[0].token).toMatch(/^[a-f0-9]{64}$/);
      expect(devices[0].token).not.toBe(result2.token);
    });
  });

  describe('isBrowserTrusted', () => {
    it('should return true for trusted browser', async () => {
      const userId = 'test-user-1';
      const userAgent = 'Mozilla/5.0 Chrome/120.0.0.0';
      const ipAddress = '192.168.1.1';

      await service.grantTrust(userId, userAgent, ipAddress);

      const grant = await service.grantTrust(userId, userAgent, ipAddress);
      const result = await service.isBrowserTrusted(userId, grant.token);

      expect(result.trusted).toBe(true);
    });

    it('should return false for untrusted browser', async () => {
      const result = await service.isBrowserTrusted(
        'test-user-1',
        'unissued-browser-token',
      );

      expect(result.trusted).toBe(false);
    });

    it('should return false for expired trust', async () => {
      const userId = 'test-user-1';
      const userAgent = 'Mozilla/5.0 Chrome/120.0.0.0';
      const ipAddress = '192.168.1.1';

      const grant = await service.grantTrust(userId, userAgent, ipAddress);
      const device = await sharedPrisma.trustedDevice.findFirst({
        where: { userId },
      });
      await sharedPrisma.trustedDevice.update({
        where: { id: device!.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const result = await service.isBrowserTrusted(userId, grant.token);

      expect(result.trusted).toBe(false);
    });

    it('should not trust browser for different user', async () => {
      const userAgent = 'Mozilla/5.0 Chrome/120.0.0.0';
      const ipAddress = '192.168.1.1';

      const grant = await service.grantTrust('user-a', userAgent, ipAddress);

      const result = await service.resolveTrustForSignIn('user-b', grant.token);

      expect(result.trusted).toBe(false);
      expect(result.revokedOtherUser).toBe(true);
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all trusted browsers for user', async () => {
      const userId = 'test-user-1';

      // Grant trust on multiple browsers
      await service.grantTrust(
        userId,
        'Mozilla/5.0 Chrome/120.0.0.0',
        '192.168.1.1',
      );
      await service.grantTrust(
        userId,
        'Mozilla/5.0 Firefox/120.0',
        '192.168.1.2',
      );

      let devices = await sharedPrisma.trustedDevice.findMany({
        where: { userId },
      });
      expect(devices).toHaveLength(2);

      await service.revokeAllForUser(userId);

      devices = await sharedPrisma.trustedDevice.findMany({
        where: { userId },
      });
      expect(devices).toHaveLength(0);
    });
  });

  describe('revokeTrustedBrowser', () => {
    it('should revoke specific trusted browser', async () => {
      const userId = 'test-user-1';
      const userAgent = 'Mozilla/5.0 Chrome/120.0.0.0';
      const ipAddress = '192.168.1.1';

      const result = await service.grantTrust(userId, userAgent, ipAddress);

      await service.revokeTrustedBrowser(userId, result.token);

      const devices = await sharedPrisma.trustedDevice.findMany({
        where: { userId },
      });
      expect(devices).toHaveLength(0);
    });
  });

  describe('getTrustedBrowsers', () => {
    it('should return list of active trusted browsers', async () => {
      const userId = 'test-user-1';

      await service.grantTrust(
        userId,
        'Mozilla/5.0 Chrome/120.0.0.0',
        '192.168.1.1',
      );
      await service.grantTrust(
        userId,
        'Mozilla/5.0 Firefox/120.0',
        '192.168.1.2',
      );

      const browsers = await service.getTrustedBrowsers(userId);

      expect(browsers).toHaveLength(2);
      expect(browsers[0]).toHaveProperty('id');
      expect(browsers[0]).toHaveProperty('ipAddress');
      expect(browsers[0]).toHaveProperty('grantedAt');
      expect(browsers[0]).toHaveProperty('expiresAt');
    });

    it('should not include expired browsers', async () => {
      const userId = 'test-user-1';

      // Create expired trust
      await sharedPrisma.trustedDevice.create({
        data: {
          userId,
          token: 'expired-token',
          userAgent: 'fingerprint',
          ipAddress: '192.168.1.1',
          grantedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      });

      const browsers = await service.getTrustedBrowsers(userId);

      expect(browsers).toHaveLength(0);
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired trusted browsers', async () => {
      const userId = 'test-user-1';

      // Create expired trust
      await sharedPrisma.trustedDevice.create({
        data: {
          userId,
          token: 'expired-token',
          userAgent: 'fingerprint',
          ipAddress: '192.168.1.1',
          grantedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      });

      // Create active trust
      await service.grantTrust(
        userId,
        'Mozilla/5.0 Chrome/120.0.0.0',
        '192.168.1.2',
      );

      const count = await service.cleanupExpired(userId);

      expect(count).toBe(1);

      const remaining = await sharedPrisma.trustedDevice.findMany({ where: { userId } });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].token).not.toBe('expired-token');
    });
  });
});
