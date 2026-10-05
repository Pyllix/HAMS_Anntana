import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ImageCleanupReason,
  ImageUploadPurpose,
  ImageUploadStatus,
  Prisma,
  type ImageUpload,
  UserRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { IMAGE_CLOCK, type ImageClock } from './image-clock.port';
import {
  IMAGE_STORAGE,
  type ImageDeliveryType,
  type ImageObjectReference,
  type ImagePurpose,
  type ImageStorageContext,
  type ImageStoragePort,
} from './image-storage.port';
import {
  imageDeliveryTypeForPurpose,
  imagePublicIdForPurpose,
  imagePurposeAllowsRole,
  imageTargetForPurpose,
  imageUploadPolicy,
} from './image-upload-policy';
import { enqueueImageCleanup } from './image-cleanup.persistence';

export type ImageClaimOperation = 'CREATE' | 'UPDATE';

export interface ImageClaimRequest {
  readonly actorUserId: string;
  readonly purpose: ImagePurpose;
  readonly uploadId: string;
  readonly operation: ImageClaimOperation;
  readonly targetId: string;
  readonly creationContextToken?: string | null;
  readonly fingerprint: string;
}

export interface ImageAttachmentPayloadFields {
  readonly purpose: ImagePurpose;
  readonly uploadId?: string | null;
  readonly creationContextToken?: string | null;
  readonly imageUrl?: string | null;
}

export interface ManagedImageLocator {
  readonly storageProvider: string;
  readonly storageAccountId: string;
  readonly publicId: string;
  readonly resourceType: 'image';
  readonly deliveryType: ImageDeliveryType;
  readonly version: number;
}

export interface ManagedImageRecord {
  readonly imageUrl?: string | null;
  readonly imageStorageProvider?: string | null;
  readonly imageStorageAccountId?: string | null;
  readonly imagePublicId?: string | null;
  readonly imageResourceType?: string | null;
  readonly imageDeliveryType?: string | null;
  readonly imageVersion?: number | null;
}

export interface AssetImageFields extends ManagedImageLocator {
  readonly purpose: 'ASSET_IMAGE';
  readonly imageUrl: string;
}

export interface EmployeePhotoFields extends ManagedImageLocator {
  readonly purpose: 'EMPLOYEE_PHOTO';
  readonly imageUrl: null;
}

export type ImageAttachmentFields = AssetImageFields | EmployeePhotoFields;

export type ImageClaimResult =
  | { readonly kind: 'CLAIMED'; readonly attachment: ImageAttachmentFields }
  | { readonly kind: 'REPLAY'; readonly targetId: string };

type ImageDatabaseClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ImageAttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMAGE_STORAGE) private readonly storage: ImageStoragePort,
    @Inject(IMAGE_CLOCK) private readonly clock: ImageClock,
  ) {}

  assertAttachmentPayload(input: ImageAttachmentPayloadFields): void {
    if (!input.uploadId && input.creationContextToken != null) {
      throw new BadRequestException({
        code: 'IMAGE_CREATION_CONTEXT_WITHOUT_UPLOAD',
        message: 'A creation context requires an image upload reference',
      });
    }
    if (input.uploadId && input.imageUrl != null && input.imageUrl !== '') {
      throw new BadRequestException({
        code: 'IMAGE_URL_NOT_ACCEPTED_WITH_UPLOAD',
        message:
          input.purpose === 'ASSET_IMAGE'
            ? 'The image URL is derived from the verified upload'
            : 'The Employee Photo is derived from the verified upload',
      });
    }
  }

  async preflightClaim(request: ImageClaimRequest): Promise<void> {
    const actor = await this.prisma.user.findFirst({
      where: { id: request.actorUserId, deletedAt: null },
      select: { role: true, banned: true },
    });
    this.assertCurrentPermission(actor?.role, actor?.banned, request.purpose);
    const upload = await this.findOwnedUpload(
      this.prisma,
      request.actorUserId,
      request.uploadId,
    );
    this.assertPurpose(upload.purpose, request.purpose);
    this.assertTargetContext(upload, request);
    this.assertCurrentEnvironment(upload);
    this.assertVerifiedPending(upload);
  }

  async committedTargetForRetry(
    request: ImageClaimRequest,
  ): Promise<string | null> {
    const actor = await this.prisma.user.findFirst({
      where: { id: request.actorUserId, deletedAt: null },
      select: { role: true, banned: true },
    });
    this.assertCurrentPermission(actor?.role, actor?.banned, request.purpose);
    const upload = await this.prisma.imageUpload.findFirst({
      where: { id: request.uploadId, uploaderId: request.actorUserId },
    });
    if (!upload) return null;
    this.assertPurpose(upload.purpose, request.purpose);

    if (
      upload.status !== ImageUploadStatus.CLAIMED &&
      upload.status !== ImageUploadStatus.SUPERSEDED
    ) {
      return null;
    }
    this.assertTargetContext(upload, request);
    if (
      !upload.claimedTargetId ||
      !upload.claimFingerprint ||
      upload.claimFingerprint !== request.fingerprint
    ) {
      throw this.claimConflict();
    }
    if (
      request.operation === 'UPDATE' &&
      upload.claimedTargetId !== request.targetId
    ) {
      throw this.claimConflict();
    }
    return upload.claimedTargetId;
  }

  async lockTargetRow(
    tx: Prisma.TransactionClient,
    purpose: ImagePurpose,
    targetId: string,
  ): Promise<void> {
    const rows =
      imageTargetForPurpose(purpose) === 'asset'
        ? await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "asset_id" AS id FROM "asset" WHERE "asset_id" = ${targetId} FOR UPDATE`,
          )
        : await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "id" AS id FROM "users" WHERE "id" = ${targetId} FOR UPDATE`,
          );
    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'IMAGE_TARGET_NOT_FOUND',
        message: 'The requested image target was not found',
      });
    }
  }

  async claimInTransaction(
    tx: Prisma.TransactionClient,
    request: ImageClaimRequest,
    previous: ManagedImageLocator | null,
    previousImageUrl?: string | null,
  ): Promise<ImageClaimResult> {
    const actor = await tx.user.findFirst({
      where: { id: request.actorUserId, deletedAt: null },
      select: { role: true, banned: true },
    });
    this.assertCurrentPermission(actor?.role, actor?.banned, request.purpose);
    const upload = await this.findOwnedUpload(
      tx,
      request.actorUserId,
      request.uploadId,
    );
    this.assertPurpose(upload.purpose, request.purpose);
    this.assertTargetContext(upload, request);

    if (
      upload.status === ImageUploadStatus.CLAIMED ||
      upload.status === ImageUploadStatus.SUPERSEDED
    ) {
      if (
        !upload.claimedTargetId ||
        !upload.claimFingerprint ||
        upload.claimFingerprint !== request.fingerprint ||
        (request.operation === 'UPDATE' &&
          upload.claimedTargetId !== request.targetId)
      ) {
        throw this.claimConflict();
      }
      return { kind: 'REPLAY', targetId: upload.claimedTargetId };
    }

    this.assertCurrentEnvironment(upload);
    this.assertVerifiedPending(upload);
    this.assertPreviousRecord(request.purpose, previous, previousImageUrl);
    const now = this.clock.now();
    const claimed = await tx.imageUpload.updateMany({
      where: {
        id: upload.id,
        uploaderId: request.actorUserId,
        purpose: request.purpose,
        status: ImageUploadStatus.VERIFIED_PENDING,
        targetId: request.operation === 'UPDATE' ? request.targetId : null,
        creationContextHash:
          request.operation === 'CREATE'
            ? this.creationContextHash(request.creationContextToken)
            : null,
        storageProvider: upload.storageProvider,
        storageAccountId: upload.storageAccountId,
        verifiedVersion: upload.verifiedVersion,
        verifiedEvidenceHash: upload.verifiedEvidenceHash,
        attachmentExpiresAt: { gt: now },
      },
      data: {
        status: ImageUploadStatus.CLAIMED,
        claimedTargetId: request.targetId,
        claimedAt: now,
        claimFingerprint: request.fingerprint,
        updatedAt: now,
      },
    });
    if (claimed.count !== 1) {
      const latest = await tx.imageUpload.findUnique({
        where: { id: upload.id },
      });
      if (
        latest &&
        (latest.status === ImageUploadStatus.CLAIMED ||
          latest.status === ImageUploadStatus.SUPERSEDED) &&
        latest.claimedTargetId &&
        latest.claimFingerprint === request.fingerprint &&
        (request.operation === 'CREATE' ||
          latest.claimedTargetId === request.targetId)
      ) {
        return { kind: 'REPLAY', targetId: latest.claimedTargetId };
      }
      throw this.claimConflict();
    }

    const attachment = this.toAttachmentFields(upload, request.purpose);
    if (previous) {
      await this.markSupersededInTransaction(
        tx,
        previous,
        request.targetId,
        now,
      );
    }
    return { kind: 'CLAIMED', attachment };
  }

  private async findOwnedUpload(
    client: ImageDatabaseClient,
    actorUserId: string,
    uploadId: string,
  ): Promise<ImageUpload> {
    const upload = await client.imageUpload.findFirst({
      where: { id: uploadId, uploaderId: actorUserId },
    });
    if (!upload) throw new NotFoundException({ code: 'UPLOAD_NOT_FOUND' });
    return upload;
  }

  private assertCurrentPermission(
    role: UserRole | undefined,
    banned: boolean | null | undefined,
    purpose: ImagePurpose,
  ): void {
    if (!role || banned === true) {
      throw new ForbiddenException({ code: 'IMAGE_PURPOSE_FORBIDDEN' });
    }
    if (!imagePurposeAllowsRole(role, purpose)) {
      throw new ForbiddenException({ code: 'IMAGE_PURPOSE_FORBIDDEN' });
    }
  }

  private assertPurpose(
    actualPurpose: ImageUploadPurpose,
    expectedPurpose: ImagePurpose,
  ): void {
    if (actualPurpose !== expectedPurpose) throw this.claimConflict();
  }

  private assertTargetContext(
    upload: Awaited<ReturnType<ImageAttachmentService['findOwnedUpload']>>,
    request: ImageClaimRequest,
  ): void {
    if (request.operation === 'CREATE') {
      const expectedContextHash = this.creationContextHash(
        request.creationContextToken,
      );
      if (
        upload.targetId !== null ||
        !expectedContextHash ||
        upload.creationContextHash !== expectedContextHash
      ) {
        throw this.claimConflict();
      }
      return;
    }
    if (
      request.creationContextToken != null ||
      upload.targetId !== request.targetId ||
      upload.creationContextHash !== null
    ) {
      throw this.claimConflict();
    }
  }

  private assertCurrentEnvironment(
    upload: Awaited<ReturnType<ImageAttachmentService['findOwnedUpload']>>,
  ): void {
    let context: ImageStorageContext;
    try {
      context = this.storage.getProviderContext();
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_STORAGE_NOT_CONFIGURED',
        message: 'Image storage is not configured for this environment',
      });
    }
    const expectedDeliveryType = imageDeliveryTypeForPurpose(upload.purpose);
    const expectedPublicId = imagePublicIdForPurpose(upload.purpose, upload.id);
    let policyRevision: string;
    try {
      policyRevision = imageUploadPolicy(upload.purpose).revision;
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_UPLOAD_CONFIGURATION_INVALID',
        message: 'Image upload policy is not configured correctly',
      });
    }
    if (
      !context.provider ||
      !context.accountId ||
      context.provider !== upload.storageProvider ||
      context.accountId !== upload.storageAccountId ||
      upload.resourceType !== 'image' ||
      upload.deliveryType !== expectedDeliveryType ||
      upload.publicId !== expectedPublicId ||
      upload.policyRevision !== policyRevision
    ) {
      throw this.claimConflict();
    }
  }

  private assertVerifiedPending(
    upload: Awaited<ReturnType<ImageAttachmentService['findOwnedUpload']>>,
  ): void {
    const now = this.clock.now();
    if (
      upload.status === ImageUploadStatus.EXPIRED ||
      (upload.status === ImageUploadStatus.VERIFIED_PENDING &&
        (!upload.attachmentExpiresAt || upload.attachmentExpiresAt <= now))
    ) {
      throw new GoneException({
        code: 'UPLOAD_EXPIRED',
        message: 'The image upload window has expired',
      });
    }
    if (
      upload.status !== ImageUploadStatus.VERIFIED_PENDING ||
      !upload.attachmentExpiresAt ||
      upload.attachmentExpiresAt <= now ||
      !upload.verifiedVersion ||
      upload.verifiedFormat !== 'jpg' ||
      !upload.verifiedEvidenceHash ||
      !upload.verifiedBytes ||
      !upload.verifiedWidth ||
      !upload.verifiedHeight ||
      upload.verifiedPages !== 1
    ) {
      throw this.claimConflict();
    }
    const policy = imageUploadPolicy(upload.purpose);
    if (
      upload.verifiedBytes < 1 ||
      upload.verifiedWidth < 1 ||
      upload.verifiedHeight < 1 ||
      upload.verifiedWidth > policy.maxEdge ||
      upload.verifiedHeight > policy.maxEdge
    ) {
      throw this.claimConflict();
    }
  }

  private assertPreviousRecord(
    purpose: ImagePurpose,
    locator: ManagedImageLocator | null,
    imageUrl?: string | null,
  ): void {
    if (!locator) return;
    if (
      locator.resourceType !== 'image' ||
      locator.deliveryType !== imageDeliveryTypeForPurpose(purpose)
    ) {
      throw this.claimConflict();
    }
    if (purpose === 'EMPLOYEE_PHOTO' && imageUrl != null) {
      throw this.claimConflict();
    }
    if (purpose === 'ASSET_IMAGE') {
      let expectedUrl: string;
      try {
        expectedUrl = this.storage.publicUrl(this.toReference(locator));
      } catch {
        throw this.claimConflict();
      }
      if (imageUrl !== expectedUrl) throw this.claimConflict();
    }
  }

  private toAttachmentFields(
    upload: Awaited<ReturnType<ImageAttachmentService['findOwnedUpload']>>,
    purpose: ImagePurpose,
  ): ImageAttachmentFields {
    const locator: ManagedImageLocator = {
      storageProvider: upload.storageProvider,
      storageAccountId: upload.storageAccountId,
      publicId: upload.publicId,
      resourceType: 'image',
      deliveryType: imageDeliveryTypeForPurpose(purpose),
      version: upload.verifiedVersion as number,
    };
    if (purpose === 'EMPLOYEE_PHOTO') {
      return { purpose, imageUrl: null, ...locator };
    }
    let imageUrl: string;
    try {
      imageUrl = this.storage.publicUrl(this.toReference(locator));
      const parsedUrl = new URL(imageUrl);
      if (
        parsedUrl.protocol !== 'https:' ||
        !parsedUrl.pathname.split('/').includes(`v${locator.version}`)
      ) {
        throw new Error('Asset image URL is not HTTPS and versioned');
      }
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_STORAGE_CONFIGURATION_INVALID',
        message: 'Image storage returned an invalid public image reference',
      });
    }
    return { purpose, imageUrl, ...locator };
  }

  private toReference(locator: ManagedImageLocator): ImageObjectReference {
    return {
      publicId: locator.publicId,
      storageContext: {
        provider: locator.storageProvider,
        accountId: locator.storageAccountId,
      },
      resourceType: locator.resourceType,
      deliveryType: locator.deliveryType,
      version: locator.version,
    };
  }

  private async markSupersededInTransaction(
    tx: Prisma.TransactionClient,
    locator: ManagedImageLocator,
    targetId: string,
    now: Date,
  ): Promise<void> {
    const previousUpload = await tx.imageUpload.findFirst({
      where: {
        storageProvider: locator.storageProvider,
        storageAccountId: locator.storageAccountId,
        publicId: locator.publicId,
        resourceType: locator.resourceType,
        deliveryType: locator.deliveryType,
        verifiedVersion: locator.version,
        status: ImageUploadStatus.CLAIMED,
        claimedTargetId: targetId,
      },
    });
    if (!previousUpload) throw this.claimConflict();
    const superseded = await tx.imageUpload.updateMany({
      where: {
        id: previousUpload.id,
        status: ImageUploadStatus.CLAIMED,
        claimedTargetId: targetId,
      },
      data: {
        status: ImageUploadStatus.SUPERSEDED,
        updatedAt: now,
      },
    });
    if (superseded.count !== 1) throw this.claimConflict();

    await enqueueImageCleanup(
      tx,
      previousUpload,
      ImageCleanupReason.SUPERSEDED_ATTACHMENT,
      new Date(
        Math.max(now.getTime(), previousUpload.reconciliationAfter.getTime()),
      ),
      locator.version,
    );
  }

  private creationContextHash(token?: string | null): string | null {
    if (!token) return null;
    return createHash('sha256').update(token).digest('hex');
  }

  private claimConflict(): ConflictException {
    return new ConflictException({
      code: 'IMAGE_UPLOAD_NOT_CLAIMABLE',
      message:
        'The verified image upload cannot be attached to this record or save',
    });
  }
}

export function managedImageLocator(
  record: ManagedImageRecord,
): ManagedImageLocator | null {
  const rawValues = [
    record.imageStorageProvider,
    record.imageStorageAccountId,
    record.imagePublicId,
    record.imageResourceType,
    record.imageDeliveryType,
    record.imageVersion,
  ];
  if (rawValues.every((value) => value === null || value === undefined)) {
    return null;
  }
  if (
    rawValues.some((value) => value === null || value === undefined) ||
    typeof record.imageStorageProvider !== 'string' ||
    typeof record.imageStorageAccountId !== 'string' ||
    typeof record.imagePublicId !== 'string' ||
    record.imageResourceType !== 'image' ||
    (record.imageDeliveryType !== 'upload' &&
      record.imageDeliveryType !== 'authenticated') ||
    typeof record.imageVersion !== 'number' ||
    record.imageVersion < 1
  ) {
    throw new ConflictException({
      code: 'IMAGE_ATTACHMENT_METADATA_INVALID',
      message: 'The current image attachment metadata is inconsistent',
    });
  }
  return {
    storageProvider: record.imageStorageProvider,
    storageAccountId: record.imageStorageAccountId,
    publicId: record.imagePublicId,
    resourceType: 'image',
    deliveryType: record.imageDeliveryType,
    version: record.imageVersion,
  };
}

export function imageClaimFingerprint(input: {
  readonly actorUserId: string;
  readonly purpose: ImagePurpose;
  readonly operation: ImageClaimOperation;
  readonly targetId: string | null;
  readonly fields: object;
}): string {
  const ignoredFields = new Set([
    'imageUploadId',
    'imageCreationContextToken',
    'createdBy',
    'updatedBy',
  ]);
  const normalized = normalizeValue(input.fields);
  const operationFields =
    typeof normalized === 'object' &&
    normalized !== null &&
    !Array.isArray(normalized)
      ? Object.fromEntries(
          Object.entries(normalized).filter(
            ([key, value]) =>
              !ignoredFields.has(key) &&
              !(key === 'imageUrl' && (value === null || value === '')) &&
              key !== 'password',
          ),
        )
      : normalized;
  return createHash('sha256')
    .update(
      JSON.stringify({
        actorUserId: input.actorUserId,
        purpose: input.purpose,
        operation: input.operation,
        targetId: input.targetId,
        fields: operationFields,
      }),
    )
    .digest('hex');
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeValue(item)]),
    );
  }
  return value;
}
