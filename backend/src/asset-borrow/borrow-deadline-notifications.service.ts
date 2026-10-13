import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface BorrowDeadlineClock {
  now(): Date;
}

export const BORROW_DEADLINE_CLOCK = Symbol('BORROW_DEADLINE_CLOCK');

interface BorrowDeadlineCandidate {
  borrowId: string;
  borrowNo: string;
  borrowerId: string;
  expectedReturnDate: Date;
  assetName: string;
  deadlineEpochMs: string;
}

export interface BorrowDeadlineSweepResult {
  readonly examined: number;
  readonly created: number;
  readonly dueSoon: number;
  readonly overdue: number;
}

const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_BATCH_SIZE = 50;
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class BorrowDeadlineNotificationsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BorrowDeadlineNotificationsService.name);
  private interval: NodeJS.Timeout | null = null;
  private inFlight: Promise<BorrowDeadlineSweepResult> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(BORROW_DEADLINE_CLOCK)
    private readonly clock: BorrowDeadlineClock,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;

    void this.runScheduledSweep('startup');
    this.interval = setInterval(() => {
      void this.runScheduledSweep('interval');
    }, SWEEP_INTERVAL_MS);
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  runSweepOnce(): Promise<BorrowDeadlineSweepResult> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.clearInFlightAfter(this.executeSweep());
    return this.inFlight;
  }

  private async clearInFlightAfter(
    sweep: Promise<BorrowDeadlineSweepResult>,
  ): Promise<BorrowDeadlineSweepResult> {
    try {
      return await sweep;
    } finally {
      this.inFlight = null;
    }
  }

  private async runScheduledSweep(
    source: 'startup' | 'interval',
  ): Promise<void> {
    try {
      await this.runSweepOnce();
    } catch (error) {
      this.logger.error(
        `Borrow deadline ${source} sweep failed (${error instanceof Error ? error.name : 'unknown error'})`,
      );
    }
  }

  private async executeSweep(): Promise<BorrowDeadlineSweepResult> {
    const now = this.clock.now();
    const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_MS);
    const sweep = await this.prisma.$transaction(async (tx) => {
      // Lock current borrow rows and exclude their recorded deadline event in one query.
      const candidates = await tx.$queryRaw<BorrowDeadlineCandidate[]>`
          SELECT
            bt."borrow_transaction_id" AS "borrowId",
            bt."borrow_no" AS "borrowNo",
            bt."borrower_id" AS "borrowerId",
            bt."expected_return_date" AS "expectedReturnDate",
            asset."name" AS "assetName",
            FLOOR(
              EXTRACT(
                EPOCH FROM (bt."expected_return_date" AT TIME ZONE 'UTC')
              ) * 1000
            )::bigint::text AS "deadlineEpochMs"
          FROM "borrow_transaction" AS bt
          INNER JOIN "borrow_status" AS bs
            ON bs."borrow_status_id" = bt."borrow_status_id"
          INNER JOIN "asset" AS asset
            ON asset."asset_id" = bt."asset_id"
          WHERE bs."status_code" = 'BORROWED'
            AND bt."expected_return_date" IS NOT NULL
            AND bt."expected_return_date" <= ${dueSoonCutoff}
            AND (
              EXISTS (
                SELECT 1 FROM "users" AS borrower
                WHERE borrower."id" = bt."borrower_id"
                  AND borrower."deleted_at" IS NULL
                  AND (borrower."banned" = false OR borrower."banned" IS NULL)
              )
              OR (
                bt."expected_return_date" < ${now}
                AND EXISTS (
                  SELECT 1 FROM "users" AS staff
                  WHERE staff."role" = 'ASSET_CENTER_STAFF'
                    AND staff."deleted_at" IS NULL
                    AND (staff."banned" = false OR staff."banned" IS NULL)
                )
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM "notifications" AS notification
              WHERE notification."event_key" = (
                CASE
                  WHEN bt."expected_return_date" < ${now}
                    THEN 'BORROW_OVERDUE'
                  ELSE 'BORROW_DUE_SOON'
                END
                || ':' || bt."borrow_transaction_id" || ':' ||
                FLOOR(
                  EXTRACT(
                    EPOCH FROM (bt."expected_return_date" AT TIME ZONE 'UTC')
                  ) * 1000
                )::bigint::text
              )
            )
          ORDER BY bt."expected_return_date" ASC, bt."borrow_transaction_id" ASC
          LIMIT ${SWEEP_BATCH_SIZE}
          FOR UPDATE OF bt SKIP LOCKED
        `;
      const events = candidates.map((candidate) => ({
        id: candidate.borrowId,
        borrowNo: candidate.borrowNo,
        borrowerId: candidate.borrowerId,
        assetName: candidate.assetName,
        expectedReturnDate: candidate.expectedReturnDate,
        deadlineEpochMs: candidate.deadlineEpochMs,
        type:
          candidate.expectedReturnDate.getTime() < now.getTime()
            ? NotificationType.BORROW_OVERDUE
            : NotificationType.BORROW_DUE_SOON,
      }));
      return {
        examined: candidates.length,
        rows: await this.notifications.createBorrowDeadlineNotifications(
          tx,
          events,
        ),
      };
    });

    this.notifications.publishCommitted(sweep.rows);
    return {
      examined: sweep.examined,
      created: sweep.rows.length,
      dueSoon: sweep.rows.filter(
        ({ type }) => type === NotificationType.BORROW_DUE_SOON,
      ).length,
      overdue: sweep.rows.filter(
        ({ type }) => type === NotificationType.BORROW_OVERDUE,
      ).length,
    };
  }
}
