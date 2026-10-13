import { NotificationResourceType, NotificationType } from '@prisma/client';
import type { MessageEvent } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SessionLifetimeService } from '../auth/session-lifetime.service';
import { NotificationStreamService } from './notification-stream.service';

describe('NotificationStreamService', () => {
  it('aborts the HTTP transport when authorization is revoked', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      userId: 'user-1',
      user: { deletedAt: null, banned: false },
    });
    const enforceSession = jest.fn().mockResolvedValue({});
    const prisma = {
      session: { findUnique },
    } as unknown as PrismaService;
    const sessionLifetime = {
      enforceSession,
    } as unknown as SessionLifetimeService;
    const service = new NotificationStreamService(prisma, sessionLifetime);
    const abortTransport = jest.fn();
    const received: MessageEvent[] = [];
    let resolveInitial: (event: MessageEvent) => void = () => undefined;
    let resolveClosed: () => void = () => undefined;
    const initialEvent = new Promise<MessageEvent>((resolve) => {
      resolveInitial = resolve;
    });
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });

    service.connect('user-1', 'session-1', abortTransport).subscribe({
      next: (event) => {
        received.push(event);
        resolveInitial(event);
      },
      complete: resolveClosed,
    });

    await expect(initialEvent).resolves.toMatchObject({
      type: 'notifications.sync_required',
      data: { reason: 'connected' },
    });

    findUnique.mockResolvedValue(null);
    service.publishCreated('user-1', {
      id: 'notification-1',
      type: NotificationType.BORROW_APPROVAL_REQUIRED,
      title: 'มีคำขอยืมใหม่รออนุมัติ',
      message: 'คำขอยืมรออนุมัติ',
      resourceType: NotificationResourceType.BORROW_TRANSACTION,
      resourceId: 'borrow-1',
      readAt: null,
      createdAt: new Date(),
    });

    await closed;
    expect(abortTransport).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(1);
  });
});
