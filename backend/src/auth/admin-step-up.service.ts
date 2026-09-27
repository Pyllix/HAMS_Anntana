import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TwoFactorService } from './two-factor.service';

const ADMIN_STEP_UP_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AdminStepUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async verifyAndGrant(
    userId: string,
    sessionId: string,
    totpCode: string,
  ): Promise<{ expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'ADMIN_STEP_UP_REQUIRED',
        message: 'Only an ADMIN can start an administrative Step-up',
      });
    }

    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!session) {
      throw new ForbiddenException({
        code: 'STEP_UP_SESSION_INVALID',
        message: 'The current session is no longer active',
      });
    }

    await this.twoFactorService.verifyCurrentTotp(userId, totpCode);

    const expiresAt = new Date(Date.now() + ADMIN_STEP_UP_TTL_MS);
    await this.prisma.adminStepUp.upsert({
      where: { sessionId },
      create: { sessionId, expiresAt },
      update: { expiresAt },
    });

    return { expiresAt };
  }

  async requireActive(userId: string, sessionId: string): Promise<void> {
    const grant = await this.prisma.adminStepUp.findUnique({
      where: { sessionId },
      select: {
        expiresAt: true,
        session: {
          select: {
            userId: true,
            expiresAt: true,
            user: { select: { role: true } },
          },
        },
      },
    });
    const now = new Date();
    if (
      !grant ||
      grant.expiresAt <= now ||
      grant.session.userId !== userId ||
      grant.session.expiresAt <= now ||
      grant.session.user.role !== 'ADMIN'
    ) {
      throw new ForbiddenException({
        code: 'STEP_UP_REQUIRED',
        message: 'Fresh ADMIN TOTP verification is required',
      });
    }
  }

  async clearForUser(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      select: { id: true },
    });
    if (sessions.length === 0) return;
    await this.prisma.adminStepUp.deleteMany({
      where: { sessionId: { in: sessions.map(({ id }) => id) } },
    });
  }
}
