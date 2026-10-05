import {
  Injectable,
  Inject,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ImageCleanupStatus, ImageUploadStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { IMAGE_CLOCK, type ImageClock } from './image-clock.port';
import {
  IMAGE_STORAGE,
  ImageStorageError,
  type ImageStoragePort,
} from './image-storage.port';
import {
  IMAGE_CLEANUP_PROVIDER_REQUESTS_PER_OBJECT,
  imageCleanupConfiguration,
  imagePublicIdForPurpose,
} from './image-upload-policy';
import {
  expiredUploadCleanupEligibleAt,
  expiredUploadCleanupPolicy,
  enqueueImageCleanup,
} from './image-cleanup.persistence';

interface LeasedCleanup {
  readonly id: string;
  readonly uploadId: string | null;
  readonly storageProvider: string;
  readonly storageAccountId: string;
  readonly publicId: string;
  readonly version: number | null;
  readonly resourceType: string;
  readonly deliveryType: string;
  readonly attemptCount: number;
  readonly leaseToken: string;
}

interface CleanupBacklog {
  readonly PENDING: number;
  readonly LEASED: number;
  readonly RETRY: number;
  readonly COMPLETED: number;
  readonly RETAINED: number;
}

export interface ImageCleanupSweepResult {
  readonly expiredUploads: number;
  readonly attemptedObjects: number;
  readonly providerRequestBudget: number;
  readonly deletedOrAbsent: number;
  readonly retained: number;
  readonly deferred: number;
  readonly backlog: CleanupBacklog;
}

@Injectable()
export class ImageCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ImageCleanupService.name);
  private interval: NodeJS.Timeout | null = null;
  private inFlight: Promise<ImageCleanupSweepResult> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMAGE_STORAGE) private readonly storage: ImageStoragePort,
    @Inject(IMAGE_CLOCK) private readonly clock: ImageClock,
  ) {}

  onApplicationBootstrap(): void {
    // Jest and local acceptance apps invoke runSweepOnce explicitly. Production
    // remains startup + interval driven without making app startup await I/O.
    if (process.env.NODE_ENV === 'test') return;
    let intervalMs: number;
    try {
      intervalMs = imageCleanupConfiguration().intervalMs;
    } catch {
      this.logger.error('Image cleanup scheduler configuration is invalid');
      return;
    }
    void this.runScheduledSweep('startup');
    this.interval = setInterval(() => {
      void this.runScheduledSweep('interval');
    }, intervalMs);
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  runSweepOnce(): Promise<ImageCleanupSweepResult> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.clearInFlightAfter(this.executeSweep());
    return this.inFlight;
  }

  private async clearInFlightAfter(
    sweep: Promise<ImageCleanupSweepResult>,
  ): Promise<ImageCleanupSweepResult> {
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
    } catch {
      this.logger.error(
        `Image cleanup ${source} sweep failed; work remains durable`,
      );
    }
  }

  private async executeSweep(): Promise<ImageCleanupSweepResult> {
    let config: ReturnType<typeof imageCleanupConfiguration>;
    try {
      config = imageCleanupConfiguration();
    } catch {
      this.logger.error('Image cleanup sweep skipped: configuration invalid');
      return this.emptyResult(0);
    }

    const now = this.clock.now();
    let expiredUploads = 0;
    try {
      expiredUploads = await this.expireDueUploads(now, config.batchSize);
    } catch {
      this.logger.error('Image cleanup sweep could not record expired uploads');
    }

    const objectLimit = Math.min(
      config.batchSize,
      Math.floor(
        config.providerRequestBudget /
          IMAGE_CLEANUP_PROVIDER_REQUESTS_PER_OBJECT,
      ),
    );
    const candidateIds = await this.findEligibleCleanupIds(now, objectLimit);
    let attemptedObjects = 0;
    let deletedOrAbsent = 0;
    let retained = 0;
    let deferred = 0;

    for (const cleanupId of candidateIds) {
      const lease = await this.acquireLease(cleanupId, now, config.leaseMs);
      if (!lease) continue;
      if (lease.kind === 'retained') {
        retained += 1;
        continue;
      }
      if (lease.kind === 'deferred') {
        deferred += 1;
        continue;
      }

      attemptedObjects += 1;
      try {
        await this.deleteAllocatedObject(lease.job);
        await this.markCompleted(lease.job, now);
        deletedOrAbsent += 1;
      } catch (error) {
        await this.scheduleRetry(lease.job, error, now, config.maxBackoffMs);
        deferred += 1;
      }
    }

    const backlog = await this.readBacklog();
    const result: ImageCleanupSweepResult = {
      expiredUploads,
      attemptedObjects,
      providerRequestBudget: config.providerRequestBudget,
      deletedOrAbsent,
      retained,
      deferred,
      backlog,
    };
    this.logger.log(
      `Image cleanup sweep: expired=${expiredUploads} attempted=${attemptedObjects} deleted_or_absent=${deletedOrAbsent} retained=${retained} deferred=${deferred} backlog_pending=${backlog.PENDING} backlog_retry=${backlog.RETRY} backlog_leased=${backlog.LEASED} backlog_retained=${backlog.RETAINED}`,
    );
    return result;
  }

  private async expireDueUploads(
    now: Date,
    batchSize: number,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const dueUploads = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id"
          FROM "image_upload"
          WHERE ("status" = 'AUTHORIZED' AND "intent_expires_at" <= ${now})
             OR ("status" = 'VERIFIED_PENDING' AND "attachment_expires_at" <= ${now})
          ORDER BY COALESCE("attachment_expires_at", "intent_expires_at"), "id"
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `,
      );
      let expired = 0;
      for (const { id } of dueUploads) {
        const upload = await tx.imageUpload.findUnique({ where: { id } });
        if (!upload) continue;
        const cleanupPolicy = expiredUploadCleanupPolicy(upload, now);
        if (!cleanupPolicy) continue;
        const changed = await tx.imageUpload.updateMany({
          where: {
            id,
            status: upload.status,
            ...cleanupPolicy.deadlineFilter,
          },
          data: { status: ImageUploadStatus.EXPIRED, updatedAt: now },
        });
        if (changed.count !== 1) continue;
        await enqueueImageCleanup(
          tx,
          upload,
          cleanupPolicy.reason,
          expiredUploadCleanupEligibleAt(upload, now),
          upload.verifiedVersion,
        );
        expired += 1;
      }
      return expired;
    });
  }

  private async findEligibleCleanupIds(
    now: Date,
    limit: number,
  ): Promise<string[]> {
    if (limit < 1) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "image_cleanup"
        WHERE ("status" = 'PENDING' AND "eligible_at" <= ${now})
           OR ("status" = 'RETRY' AND "next_attempt_at" <= ${now})
           OR ("status" = 'LEASED' AND "lease_expires_at" <= ${now})
        ORDER BY COALESCE("next_attempt_at", "eligible_at"), "created_at", "id"
        LIMIT ${limit}
      `,
    );
    return rows.map(({ id }) => id);
  }

  private async acquireLease(
    cleanupId: string,
    now: Date,
    leaseMs: number,
  ): Promise<
    | { readonly kind: 'leased'; readonly job: LeasedCleanup }
    | { readonly kind: 'retained' }
    | { readonly kind: 'deferred' }
    | null
  > {
    return this.prisma.$transaction(async (tx) => {
      const locks = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id"
          FROM "image_cleanup"
          WHERE "id" = ${cleanupId}::uuid
            AND (("status" = 'PENDING' AND "eligible_at" <= ${now})
              OR ("status" = 'RETRY' AND "next_attempt_at" <= ${now})
              OR ("status" = 'LEASED' AND "lease_expires_at" <= ${now}))
          FOR UPDATE SKIP LOCKED
        `,
      );
      if (locks.length === 0) return null;

      const cleanup = await tx.imageCleanup.findUnique({
        where: { id: cleanupId },
      });
      if (!cleanup) return null;

      const locatorWhere = {
        imageStorageProvider: cleanup.storageProvider,
        imageStorageAccountId: cleanup.storageAccountId,
        imagePublicId: cleanup.publicId,
        imageResourceType: cleanup.resourceType,
        imageDeliveryType: cleanup.deliveryType,
      };
      const assetReference = await tx.asset.findFirst({
        where: locatorWhere,
        select: { id: true },
      });
      const userReference = await tx.user.findFirst({
        where: locatorWhere,
        select: { id: true },
      });
      if (assetReference || userReference) {
        await tx.imageCleanup.update({
          where: { id: cleanup.id },
          data: {
            status: ImageCleanupStatus.RETAINED,
            completedAt: now,
            lastErrorCode: 'RETAINED_REFERENCE',
            leaseToken: null,
            leaseExpiresAt: null,
            nextAttemptAt: null,
            updatedAt: now,
          },
        });
        return { kind: 'retained' };
      }

      const upload = cleanup.uploadId
        ? await tx.imageUpload.findUnique({
            where: { id: cleanup.uploadId },
          })
        : null;
      if (
        upload &&
        upload.status !== ImageUploadStatus.EXPIRED &&
        upload.status !== ImageUploadStatus.REJECTED &&
        upload.status !== ImageUploadStatus.SUPERSEDED
      ) {
        await tx.imageCleanup.update({
          where: { id: cleanup.id },
          data: {
            status: ImageCleanupStatus.RETRY,
            nextAttemptAt: new Date(now.getTime() + 60_000),
            lastErrorCode: 'UPLOAD_NOT_TERMINAL',
            leaseToken: null,
            leaseExpiresAt: null,
            updatedAt: now,
          },
        });
        return { kind: 'deferred' };
      }

      const leaseToken = randomUUID();
      const leaseExpiresAt = new Date(now.getTime() + leaseMs);
      await tx.imageCleanup.update({
        where: { id: cleanup.id },
        data: {
          status: ImageCleanupStatus.LEASED,
          leaseToken,
          leaseExpiresAt,
          nextAttemptAt: null,
          lastErrorCode: null,
          updatedAt: now,
        },
      });
      return {
        kind: 'leased',
        job: {
          id: cleanup.id,
          uploadId: cleanup.uploadId,
          storageProvider: cleanup.storageProvider,
          storageAccountId: cleanup.storageAccountId,
          publicId: cleanup.publicId,
          version: cleanup.version,
          resourceType: cleanup.resourceType,
          deliveryType: cleanup.deliveryType,
          attemptCount: cleanup.attemptCount,
          leaseToken,
        },
      };
    });
  }

  private async deleteAllocatedObject(job: LeasedCleanup): Promise<void> {
    if (job.uploadId) {
      const upload = await this.prisma.imageUpload.findUnique({
        where: { id: job.uploadId },
      });
      if (
        !upload ||
        job.publicId !== imagePublicIdForPurpose(upload.purpose, upload.id) ||
        job.resourceType !== 'image' ||
        job.deliveryType !== upload.deliveryType ||
        job.storageProvider !== upload.storageProvider ||
        job.storageAccountId !== upload.storageAccountId
      ) {
        throw new ImageStorageError(
          'OBJECT_POLICY_REJECTED',
          'Cleanup identity did not match the allocated upload',
        );
      }
    }
    const context = this.storage.getProviderContext();
    if (
      job.storageProvider !== context.provider ||
      job.storageAccountId !== context.accountId
    ) {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Cleanup provider environment does not match the allocated object',
      );
    }
    await this.storage.deleteAllocatedImageVariants({
      publicId: job.publicId,
      storageContext: {
        provider: job.storageProvider,
        accountId: job.storageAccountId,
      },
    });
  }

  private async markCompleted(job: LeasedCleanup, now: Date): Promise<void> {
    await this.prisma.imageCleanup.updateMany({
      where: {
        id: job.id,
        status: ImageCleanupStatus.LEASED,
        leaseToken: job.leaseToken,
      },
      data: {
        status: ImageCleanupStatus.COMPLETED,
        attemptCount: { increment: 1 },
        completedAt: now,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        lastErrorCode: null,
        updatedAt: now,
      },
    });
  }

  private async scheduleRetry(
    job: LeasedCleanup,
    error: unknown,
    now: Date,
    maxBackoffMs: number,
  ): Promise<void> {
    const nextAttemptCount = job.attemptCount + 1;
    const exponent = Math.min(nextAttemptCount - 1, 20);
    const base = Math.min(1_000 * 2 ** exponent, maxBackoffMs);
    const jitterSeed = createHash('sha256')
      .update(`${job.id}:${nextAttemptCount}`)
      .digest()
      .readUInt16BE(0);
    const jitter = 0.8 + (jitterSeed % 401) / 1000;
    const delayMs = Math.min(maxBackoffMs, Math.round(base * jitter));
    const lastErrorCode =
      error instanceof ImageStorageError
        ? error.code === 'OBJECT_POLICY_REJECTED'
          ? 'CLEANUP_IDENTITY_INVALID'
          : error.code === 'OBJECT_NOT_FOUND'
            ? 'PROVIDER_NOT_FOUND'
            : 'PROVIDER_UNAVAILABLE'
        : 'PROVIDER_FAILURE';
    await this.prisma.imageCleanup.updateMany({
      where: {
        id: job.id,
        status: ImageCleanupStatus.LEASED,
        leaseToken: job.leaseToken,
      },
      data: {
        status: ImageCleanupStatus.RETRY,
        attemptCount: { increment: 1 },
        nextAttemptAt: new Date(now.getTime() + delayMs),
        completedAt: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode,
        updatedAt: now,
      },
    });
  }

  private async readBacklog(): Promise<CleanupBacklog> {
    const grouped = await this.prisma.imageCleanup.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const backlog: Record<ImageCleanupStatus, number> = {
      [ImageCleanupStatus.PENDING]: 0,
      [ImageCleanupStatus.LEASED]: 0,
      [ImageCleanupStatus.RETRY]: 0,
      [ImageCleanupStatus.COMPLETED]: 0,
      [ImageCleanupStatus.RETAINED]: 0,
    };
    for (const row of grouped) backlog[row.status] = row._count._all;
    return backlog;
  }

  private emptyResult(providerRequestBudget: number): ImageCleanupSweepResult {
    return {
      expiredUploads: 0,
      attemptedObjects: 0,
      providerRequestBudget,
      deletedOrAbsent: 0,
      retained: 0,
      deferred: 0,
      backlog: {
        PENDING: 0,
        LEASED: 0,
        RETRY: 0,
        COMPLETED: 0,
        RETAINED: 0,
      },
    };
  }
}
