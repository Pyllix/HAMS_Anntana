import {
  NotificationResourceType,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { NotificationStreamService } from './notification-stream.service';
import { PrismaService } from '../prisma.service';

describe('Unrepairable receipt notifications', () => {
  const job = {
    id: 'repair-1',
    jobNo: 'REP-202610-0001',
    assetName: 'เครื่องทดสอบ',
    assetCode: 'EQ-001',
    sectionId: 'section-1',
  };
  const notification = {
    id: 'notification-1',
    userId: 'department-1',
    type: NotificationType.REPAIR_UNREPAIRABLE_RECEIVED,
    title: 'เครื่องซ่อมไม่ได้ พัสดุรับมอบแล้ว',
    message: 'Receipt confirmed',
    resourceType: NotificationResourceType.REPAIR_JOB,
    resourceId: job.id,
    eventKey: `${NotificationType.REPAIR_UNREPAIRABLE_RECEIVED}:${job.id}`,
    readAt: null,
    createdAt: new Date('2026-10-15T08:00:00.000Z'),
  };
  const prisma = {
    user: { findMany: jest.fn() },
    notification: { createManyAndReturn: jest.fn() },
  };
  const stream = { publishCreated: jest.fn() };
  const tx = prisma as unknown as Prisma.TransactionClient;
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    stream as unknown as NotificationStreamService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findMany.mockResolvedValue([
      { id: 'department-1' },
      { id: 'department-2' },
      { id: 'department-1' },
    ]);
    prisma.notification.createManyAndReturn.mockResolvedValue([notification]);
  });

  it('targets active section members and stores one copy per user with a stable event key', async () => {
    const rows = await service.createRepairUnrepairableReceived(tx, job);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            section_id: job.sectionId,
            role: {
              in: [UserRole.DEPARTMENT_STAFF, UserRole.ASSET_CENTER_STAFF],
            },
          },
          { deletedAt: null, OR: [{ banned: false }, { banned: null }] },
        ],
      },
      select: { id: true },
    });
    const details = {
      type: NotificationType.REPAIR_UNREPAIRABLE_RECEIVED,
      title: 'เครื่องซ่อมไม่ได้ พัสดุรับมอบแล้ว',
      message:
        'งานซ่อม REP-202610-0001 สำหรับ เครื่องทดสอบ (EQ-001) ซ่อมไม่ได้ พัสดุรับมอบเพื่อเก็บรอจำหน่ายแล้ว',
      resourceType: NotificationResourceType.REPAIR_JOB,
      resourceId: job.id,
      eventKey: `${NotificationType.REPAIR_UNREPAIRABLE_RECEIVED}:${job.id}`,
      createdAt: expect.any(Date) as unknown,
    };
    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        { ...details, userId: 'department-1' },
        { ...details, userId: 'department-2' },
      ],
      skipDuplicates: true,
      select: expect.objectContaining({ id: true, userId: true }) as unknown,
    });
    expect(rows).toEqual([notification]);
    expect(stream.publishCreated).not.toHaveBeenCalled();

    service.publishCommitted(rows);
    expect(stream.publishCreated).toHaveBeenCalledWith(
      'department-1',
      expect.objectContaining({
        id: notification.id,
        type: NotificationType.REPAIR_UNREPAIRABLE_RECEIVED,
        resourceId: job.id,
        readAt: null,
      }),
    );
  });

  it('does not insert or publish when the section has no active recipients', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await expect(
      service.createRepairUnrepairableReceived(tx, job),
    ).resolves.toEqual([]);
    expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
    expect(stream.publishCreated).not.toHaveBeenCalled();
  });

  it('supports assets without a registration code', async () => {
    await service.createRepairUnrepairableReceived(tx, {
      ...job,
      assetCode: null,
    });
    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            message:
              'งานซ่อม REP-202610-0001 สำหรับ เครื่องทดสอบ ซ่อมไม่ได้ พัสดุรับมอบเพื่อเก็บรอจำหน่ายแล้ว',
          }),
        ]) as unknown,
      }),
    );
  });

  it('propagates insert failure so the receipt transaction can roll back without SSE', async () => {
    prisma.notification.createManyAndReturn.mockRejectedValue(
      new Error('Insert failed'),
    );
    await expect(
      service.createRepairUnrepairableReceived(tx, job),
    ).rejects.toThrow('Insert failed');
    expect(stream.publishCreated).not.toHaveBeenCalled();
  });
});
