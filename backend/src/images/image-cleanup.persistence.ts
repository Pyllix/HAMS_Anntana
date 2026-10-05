import {
  ImageCleanupReason,
  ImageCleanupStatus,
  ImageUploadStatus,
  type ImageUpload,
  Prisma,
} from '@prisma/client';
import { imageDeliveryTypeForPurpose } from './image-upload-policy';

type CleanupTransaction = Prisma.TransactionClient;

export function expiredUploadCleanupPolicy(
  upload: Pick<
    ImageUpload,
    'status' | 'intentExpiresAt' | 'attachmentExpiresAt'
  >,
  now: Date,
): {
  readonly reason: ImageCleanupReason;
  readonly deadlineFilter: Prisma.ImageUploadWhereInput;
} | null {
  if (upload.status === ImageUploadStatus.AUTHORIZED) {
    if (upload.intentExpiresAt > now) return null;
    return {
      reason: ImageCleanupReason.UNREPORTED_UPLOAD,
      deadlineFilter: { intentExpiresAt: { lte: now } },
    };
  }
  if (upload.status === ImageUploadStatus.VERIFIED_PENDING) {
    if (!upload.attachmentExpiresAt || upload.attachmentExpiresAt > now) {
      return null;
    }
    return {
      reason: ImageCleanupReason.EXPIRED_UPLOAD,
      deadlineFilter: { attachmentExpiresAt: { lte: now } },
    };
  }
  return null;
}

export function expiredUploadCleanupEligibleAt(
  upload: Pick<ImageUpload, 'reconciliationAfter' | 'attachmentExpiresAt'>,
  now: Date,
): Date {
  return new Date(
    Math.max(
      upload.reconciliationAfter.getTime(),
      upload.attachmentExpiresAt?.getTime() ?? now.getTime(),
    ),
  );
}

export async function enqueueImageCleanup(
  tx: CleanupTransaction,
  upload: ImageUpload,
  reason: ImageCleanupReason,
  eligibleAt: Date,
  version: number | null = upload.verifiedVersion,
): Promise<void> {
  const identity = {
    storageProvider: upload.storageProvider,
    storageAccountId: upload.storageAccountId,
    publicId: upload.publicId,
    resourceType: 'image',
    deliveryType: imageDeliveryTypeForPurpose(upload.purpose),
  } as const;

  await tx.imageCleanup.createMany({
    data: [
      {
        ...identity,
        uploadId: upload.id,
        version,
        reason,
        status: ImageCleanupStatus.PENDING,
        eligibleAt,
      },
    ],
    skipDuplicates: true,
  });

  await tx.imageCleanup.updateMany({
    where: { ...identity, status: ImageCleanupStatus.RETAINED },
    data: {
      uploadId: upload.id,
      version,
      reason,
      status: ImageCleanupStatus.PENDING,
      eligibleAt,
      attemptCount: 0,
      nextAttemptAt: null,
      leaseToken: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      completedAt: null,
    },
  });
}
