import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationResourceType,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { paginate, PaginatedResult } from '../common/utils/paginate.util';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationReadAllResponseDto } from './dto/notification-read.dto';
import { NotificationStreamService } from './notification-stream.service';

interface NotificationDeliveryRow {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: NotificationResourceType;
  resourceId: string;
  readAt: Date | null;
  createdAt: Date;
}

interface BorrowNotificationDetails {
  id: string;
  borrowNo: string;
  assetName: string;
  expectedReturnDate: Date | null;
}

interface BorrowExtensionNotificationDetails {
  id: string;
  borrowNo: string;
  assetName: string;
  roundNumber: number;
  requestedReturnDate: Date;
}

type BorrowExtensionDecisionType =
  | 'BORROW_EXTENSION_APPROVED'
  | 'BORROW_EXTENSION_REJECTED';

const NOTIFICATION_DATE_FORMATTER = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stream: NotificationStreamService,
  ) {}

  async findForUser(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = { userId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          resourceType: true,
          resourceId: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      ...paginate(rows, total, page, limit),
      data: rows.map((row) => this.toResponse(row)),
    };
  }

  async countUnreadForUser(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markReadForUser(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponseDto> {
    const readAt = new Date();
    const [updated] = await this.prisma.notification.updateManyAndReturn({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        resourceType: true,
        resourceId: true,
        readAt: true,
        createdAt: true,
      },
    });

    if (updated) {
      this.publishReadStateChanged(userId);
      return this.toResponse(updated);
    }

    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        resourceType: true,
        resourceId: true,
        readAt: true,
        createdAt: true,
      },
    });
    if (!existing) throw new NotFoundException('Notification not found');
    return this.toResponse(existing);
  }

  async markAllReadForUser(
    userId: string,
    cutoffAt: Date,
  ): Promise<NotificationReadAllResponseDto> {
    const changed = await this.prisma.notification.updateManyAndReturn({
      where: {
        userId,
        readAt: null,
        createdAt: { lte: cutoffAt },
      },
      data: { readAt: cutoffAt },
      select: { readAt: true },
    });

    if (changed.length > 0) this.publishReadStateChanged(userId);
    return {
      updatedCount: changed.length,
      readAt: changed[0]?.readAt ?? null,
    };
  }

  async createBorrowApprovalRequired(
    tx: Prisma.TransactionClient,
    borrowTransaction: { id: string; borrowNo: string },
    assetName: string,
  ): Promise<NotificationDeliveryRow[]> {
    const recipientIds = await this.findActiveAssetCenterRecipientIds(tx);
    if (recipientIds.length === 0) return [];

    return tx.notification.createManyAndReturn({
      data: recipientIds.map((userId) => ({
        userId,
        type: NotificationType.BORROW_APPROVAL_REQUIRED,
        title: 'มีคำขอยืมใหม่รออนุมัติ',
        message: `คำขอยืม ${borrowTransaction.borrowNo} สำหรับ ${assetName} กำลังรอเจ้าหน้าที่ศูนย์ครุภัณฑ์พิจารณา`,
        resourceType: NotificationResourceType.BORROW_TRANSACTION,
        resourceId: borrowTransaction.id,
        eventKey: `${NotificationType.BORROW_APPROVAL_REQUIRED}:${borrowTransaction.id}`,
      })),
      skipDuplicates: true,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        resourceType: true,
        resourceId: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async createBorrowApproved(
    tx: Prisma.TransactionClient,
    borrowTransaction: BorrowNotificationDetails,
    borrowerId: string,
  ): Promise<NotificationDeliveryRow[]> {
    const borrower = await tx.user.findFirst({
      where: {
        id: borrowerId,
        role: UserRole.DEPARTMENT_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    if (!borrower) return [];

    const returnDeadline = borrowTransaction.expectedReturnDate
      ? ` กำหนดคืน ${NOTIFICATION_DATE_FORMATTER.format(borrowTransaction.expectedReturnDate)}`
      : '';
    return tx.notification.createManyAndReturn({
      data: [
        {
          userId: borrower.id,
          type: NotificationType.BORROW_APPROVED,
          title: 'คำขอยืมได้รับอนุมัติ',
          message: `คำขอยืม ${borrowTransaction.borrowNo} สำหรับ ${borrowTransaction.assetName} ได้รับอนุมัติแล้ว${returnDeadline}`,
          resourceType: NotificationResourceType.BORROW_TRANSACTION,
          resourceId: borrowTransaction.id,
          eventKey: `${NotificationType.BORROW_APPROVED}:${borrowTransaction.id}`,
        },
      ],
      skipDuplicates: true,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        resourceType: true,
        resourceId: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async createBorrowExtensionApprovalRequired(
    tx: Prisma.TransactionClient,
    extension: BorrowExtensionNotificationDetails,
  ): Promise<NotificationDeliveryRow[]> {
    const recipientIds = await this.findActiveAssetCenterRecipientIds(tx);
    if (recipientIds.length === 0) return [];

    const requestedDate = NOTIFICATION_DATE_FORMATTER.format(
      extension.requestedReturnDate,
    );
    return tx.notification.createManyAndReturn({
      data: recipientIds.map((userId) => ({
        userId,
        type: NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED,
        title: 'มีคำขอต่ออายุรอพิจารณา',
        message: `คำขอต่ออายุรอบที่ ${extension.roundNumber} ของรายการยืม ${extension.borrowNo} (${extension.assetName}) รอพิจารณา กำหนดคืนใหม่ ${requestedDate}`,
        resourceType: NotificationResourceType.BORROW_EXTENSION,
        resourceId: extension.id,
        eventKey: `${NotificationType.BORROW_EXTENSION_APPROVAL_REQUIRED}:${extension.id}`,
      })),
      skipDuplicates: true,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        resourceType: true,
        resourceId: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async createBorrowExtensionDecision(
    tx: Prisma.TransactionClient,
    extension: BorrowExtensionNotificationDetails & {
      requestedByUserId: string;
      rejectReason?: string | null;
    },
    type: BorrowExtensionDecisionType,
  ): Promise<NotificationDeliveryRow[]> {
    const recipient = await tx.user.findFirst({
      where: {
        id: extension.requestedByUserId,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    if (!recipient) return [];

    const requestedDate = NOTIFICATION_DATE_FORMATTER.format(
      extension.requestedReturnDate,
    );
    const decisionCopy =
      type === NotificationType.BORROW_EXTENSION_APPROVED
        ? {
            title: 'คำขอต่ออายุได้รับอนุมัติ',
            message: `คำขอต่ออายุรอบที่ ${extension.roundNumber} ของรายการยืม ${extension.borrowNo} (${extension.assetName}) ได้รับอนุมัติ กำหนดคืนใหม่ ${requestedDate}`,
          }
        : {
            title: 'คำขอต่ออายุถูกปฏิเสธ',
            message: `คำขอต่ออายุรอบที่ ${extension.roundNumber} ของรายการยืม ${extension.borrowNo} (${extension.assetName}) ถูกปฏิเสธ กำหนดคืนที่ขอ ${requestedDate}${extension.rejectReason ? ` เหตุผล: ${extension.rejectReason}` : ''}`,
          };

    return tx.notification.createManyAndReturn({
      data: [
        {
          userId: recipient.id,
          type,
          title: decisionCopy.title,
          message: decisionCopy.message,
          resourceType: NotificationResourceType.BORROW_EXTENSION,
          resourceId: extension.id,
          eventKey: `${type}:${extension.id}`,
        },
      ],
      skipDuplicates: true,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        resourceType: true,
        resourceId: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  private async findActiveAssetCenterRecipientIds(
    tx: Prisma.TransactionClient,
  ): Promise<string[]> {
    const recipients = await tx.user.findMany({
      where: {
        role: UserRole.ASSET_CENTER_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    return [...new Set(recipients.map(({ id }) => id))];
  }

  publishCommitted(rows: readonly NotificationDeliveryRow[]): void {
    for (const row of rows) {
      try {
        this.stream.publishCreated(row.userId, this.toResponse(row));
      } catch (error) {
        this.logger.warn(
          `Could not publish committed notification ${row.id} (${error instanceof Error ? error.name : 'unknown error'})`,
        );
      }
    }
  }

  private publishReadStateChanged(userId: string): void {
    try {
      this.stream.publishChanged(userId);
    } catch (error) {
      this.logger.warn(
        `Could not publish read-state change for ${userId} (${error instanceof Error ? error.name : 'unknown error'})`,
      );
    }
  }

  private toResponse(row: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    resourceType: NotificationResourceType;
    resourceId: string;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationResponseDto {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }
}
