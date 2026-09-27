import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { sharedPrisma } from '../common/config/database.config';

const TRUST_DAYS = 14;
const TRUST_MS = TRUST_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class TrustedBrowserService {
  async resolveTrustForSignIn(
    userId: string,
    browserToken?: string,
  ): Promise<{ trusted: boolean; revokedOtherUser: boolean }> {
    if (!browserToken || browserToken.length > 128) {
      return { trusted: false, revokedOtherUser: false };
    }

    const tokenHash = this.hashToken(browserToken);
    const device = await sharedPrisma.trustedDevice.findUnique({
      where: { token: tokenHash },
    });
    if (!device) return { trusted: false, revokedOtherUser: false };

    if (device.expiresAt <= new Date()) {
      await sharedPrisma.trustedDevice.deleteMany({
        where: { id: device.id },
      });
      return { trusted: false, revokedOtherUser: false };
    }

    if (device.userId !== userId) {
      await sharedPrisma.trustedDevice.deleteMany({
        where: { id: device.id },
      });
      console.info(
        '[TrustedBrowser] Revoked a browser credential after a different account sign-in',
      );
      return { trusted: false, revokedOtherUser: true };
    }

    return { trusted: true, revokedOtherUser: false };
  }

  async isBrowserTrusted(
    userId: string,
    browserToken?: string,
  ): Promise<{ trusted: boolean }> {
    const result = await this.resolveTrustForSignIn(userId, browserToken);
    return { trusted: result.trusted };
  }

  async grantTrust(
    userId: string,
    userAgent: string,
    ipAddress: string,
    previousBrowserToken?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    if (previousBrowserToken && previousBrowserToken.length <= 128) {
      await sharedPrisma.trustedDevice.deleteMany({
        where: { token: this.hashToken(previousBrowserToken) },
      });
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const grantedAt = new Date();
    const expiresAt = new Date(grantedAt.getTime() + TRUST_MS);
    await sharedPrisma.trustedDevice.create({
      data: {
        userId,
        token: this.hashToken(token),
        userAgent: this.fingerprintUserAgent(userAgent),
        ipAddress,
        grantedAt,
        expiresAt,
      },
    });

    console.info(
      '[TrustedBrowser] Granted a 14-day browser credential for user ' + userId,
    );
    return { token, expiresAt };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const result = await sharedPrisma.trustedDevice.deleteMany({
      where: { userId },
    });
    if (result.count > 0) {
      console.info(
        '[TrustedBrowser] Revoked ' +
          result.count +
          ' browser credential(s) for user ' +
          userId,
      );
    }
  }

  async revokeTrustedBrowser(userId: string, idOrToken: string): Promise<void> {
    const possibleHash = this.hashToken(idOrToken);
    await sharedPrisma.trustedDevice.deleteMany({
      where: {
        userId,
        OR: [{ id: idOrToken }, { token: possibleHash }],
      },
    });
  }

  async getTrustedBrowsers(userId: string) {
    const devices = await sharedPrisma.trustedDevice.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { grantedAt: 'desc' },
    });

    return devices.map((device) => ({
      id: device.id,
      userAgent: device.userAgent,
      ipAddress: device.ipAddress,
      grantedAt: device.grantedAt,
      expiresAt: device.expiresAt,
    }));
  }

  async cleanupExpired(userId?: string): Promise<number> {
    const result = await sharedPrisma.trustedDevice.deleteMany({
      where: { expiresAt: { lte: new Date() }, ...(userId ? { userId } : {}) },
    });
    return result.count;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private fingerprintUserAgent(userAgent: string): string {
    const normalized = userAgent.replace(/\d+\.\d+\.\d+/g, '').trim();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}
