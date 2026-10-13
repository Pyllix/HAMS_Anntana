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
  ): Promise<NotificationReadAllResponseDto> {
    // Keep the cutoff and update in one statement so concurrent arrivals stay outside its snapshot.
    const changed = await this.prisma.$queryRaw<{ readAt: Date }[]>`
      WITH cutoff AS (
        SELECT transaction_timestamp()::timestamp(3) AS value
      )
      UPDATE public.notifications AS target
      SET read_at = cutoff.value
      FROM cutoff
      WHERE target.user_id = ${userId}
        AND target.read_at IS NULL
        AND target.created_at <= cutoff.value
      RETURNING target.read_at AS "readAt"
    `;

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
    const recipients = await tx.user.findMany({
      where: {
        role: UserRole.ASSET_CENTER_STAFF,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    const recipientIds = [...new Set(recipients.map(({ id }) => id))];
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
