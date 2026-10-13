import {
  NotificationResourceType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BorrowDeadlineNotificationsService } from './borrow-deadline-notifications.service';

describe('BorrowDeadlineNotificationsService', () => {
  it('coalesces overlapping sweeps and publishes created notifications after commit', async () => {
    const now = new Date('2026-10-13T00:00:00.000Z');
    const expectedReturnDate = new Date('2026-10-13T23:00:00.000Z');
    const candidate = {
      borrowId: 'borrow-1',
      borrowNo: 'BR-202610-0001',
      borrowerId: 'borrower-1',
      expectedReturnDate,
      assetName: 'Laptop',
      deadlineEpochMs: String(expectedReturnDate.getTime()),
    };
    const createdNotification = {
      id: 'notification-1',
      userId: candidate.borrowerId,
      type: NotificationType.BORROW_DUE_SOON,
      title: 'ใกล้กำหนดคืนครุภัณฑ์',
      message: 'รายการยืม BR-202610-0001 มีกำหนดคืน',
      resourceType: NotificationResourceType.BORROW_TRANSACTION,
      resourceId: candidate.borrowId,
      readAt: null,
      createdAt: now,
    };
    const queryRaw = jest.fn().mockResolvedValue([candidate]);
    const transaction = {
      $queryRaw: queryRaw,
    } as unknown as Prisma.TransactionClient;
    let releaseTransaction!: () => void;
    const transactionGate = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    let notificationCreated!: () => void;
    const notificationCreationStarted = new Promise<void>((resolve) => {
      notificationCreated = resolve;
    });
    const $transaction = jest.fn(
      async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const result = await work(transaction);
        await transactionGate;
        return result;
      },
    );
    const prisma = { $transaction } as unknown as PrismaService;
    const createBorrowDeadlineNotifications = jest.fn(() => {
      notificationCreated();
      return Promise.resolve([createdNotification]);
    });
    const publishCommitted = jest.fn();
    const notifications = {
      createBorrowDeadlineNotifications,
      publishCommitted,
    } as unknown as NotificationsService;
    const service = new BorrowDeadlineNotificationsService(
      prisma,
      notifications,
      {
        now: () => now,
      },
    );

    const firstSweep = service.runSweepOnce();
    await notificationCreationStarted;
    const overlappingSweep = service.runSweepOnce();

    expect(overlappingSweep).toBe(firstSweep);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(createBorrowDeadlineNotifications).toHaveBeenCalledWith(
      transaction,
      [
        {
          id: candidate.borrowId,
          borrowNo: candidate.borrowNo,
          borrowerId: candidate.borrowerId,
          assetName: candidate.assetName,
          expectedReturnDate,
          deadlineEpochMs: candidate.deadlineEpochMs,
          type: NotificationType.BORROW_DUE_SOON,
        },
      ],
    );
    expect(publishCommitted).not.toHaveBeenCalled();

    releaseTransaction();

    await expect(firstSweep).resolves.toEqual({
      examined: 1,
      created: 1,
      dueSoon: 1,
      overdue: 0,
    });
    expect(publishCommitted).toHaveBeenCalledWith([createdNotification]);
  });
});
