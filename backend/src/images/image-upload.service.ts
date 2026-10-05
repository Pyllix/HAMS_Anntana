import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ImageCleanupReason,
  ImageUploadStatus,
  Prisma,
  type ImageUpload,
  UserRole,
} from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { IMAGE_CLOCK, type ImageClock } from './image-clock.port';
import {
  ImageStorageError,
  IMAGE_STORAGE,
  type ImageDeliveryType,
  type ImagePurpose,
  type ImageStorageContext,
  type ImageStoragePort,
  type ImageUploadPolicy,
  type UploadInstructions,
  type UploadEvidence,
  type VerifiedImageObject,
} from './image-storage.port';
import {
  ACCEPTED_SOURCE_MIME_TYPES,
  attachmentWindowMs,
  imageUploadPolicy,
  imageDeliveryTypeForPurpose,
  imagePublicIdForPurpose,
  imagePurposeAllowsRole,
  imageTargetForPurpose,
  intentWindowMs,
  signatureWindowMs,
  uploadSettlementHorizonMs,
  uploadBudgets,
} from './image-upload-policy';
import {
  expiredUploadCleanupEligibleAt,
  expiredUploadCleanupPolicy,
  enqueueImageCleanup,
} from './image-cleanup.persistence';
import { CreateImageUploadDto } from './dto/create-image-upload.dto';
import {
  ImageReadService,
  type PendingImagePreview,
} from './image-read.service';

interface UploadActor {
  readonly userId: string;
  readonly role: UserRole;
}

interface UploadStatusResponse {
  readonly uploadId: string;
  readonly purpose: ImagePurpose;
  readonly status: ImageUploadStatus;
  readonly targetId: string | null;
  readonly issuedAt: string;
  readonly signatureExpiresAt: string;
  readonly intentExpiresAt: string;
  readonly reconciliationAfter: string;
  readonly providerCreatedAt: string | null;
  readonly attachmentExpiresAt: string | null;
  readonly claimedTargetId: string | null;
  readonly claimedAt: string | null;
  readonly verifiedImage?: {
    readonly format: string;
    readonly bytes: number;
    readonly width: number;
    readonly height: number;
  };
  readonly rejectionCode?: string;
}

@Injectable()
export class ImageUploadService {
  private readonly logger = new Logger(ImageUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMAGE_STORAGE) private readonly storage: ImageStoragePort,
    @Inject(IMAGE_CLOCK) private readonly clock: ImageClock,
    private readonly imageReadService: ImageReadService,
  ) {}

  async createIntent(
    actor: UploadActor,
    dto: CreateImageUploadDto,
  ): Promise<{
    uploadId: string;
    purpose: ImagePurpose;
    status: ImageUploadStatus;
    targetId: string | null;
    creationContextToken: string | null;
    issuedAt: string;
    signatureExpiresAt: string;
    intentExpiresAt: string;
    attachmentExpiresAt: null;
    attachmentWindowSeconds: number;
    acceptedSourceMimeTypes: readonly string[];
    uploadInstructions: {
      url: string;
      method: 'POST';
      fields: Readonly<Record<string, string>>;
      expiresAt: string;
    };
  }> {
    const purpose = dto.purpose;
    this.assertPurposePermission(actor.role, purpose);
    const now = this.clock.now();
    const policy = this.readPolicy(purpose);
    if (dto.sourceSizeBytes > policy.maxSourceBytes) {
      throw new BadRequestException({
        code: 'SOURCE_SIZE_LIMIT',
        message: 'The selected image exceeds the upload size limit',
      });
    }
    if (
      !(ACCEPTED_SOURCE_MIME_TYPES as readonly string[]).includes(
        dto.sourceContentType,
      )
    ) {
      throw new BadRequestException({
        code: 'SOURCE_TYPE_NOT_ALLOWED',
        message: 'The selected image type is not supported',
      });
    }
    if (dto.targetId) await this.assertTargetExists(purpose, dto.targetId);

    let storageContext: ImageStorageContext;
    try {
      storageContext = this.storage.getProviderContext();
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_STORAGE_NOT_CONFIGURED',
        message: 'Image storage is not configured for this environment',
      });
    }
    if (!storageContext.provider || !storageContext.accountId) {
      throw new ServiceUnavailableException({
        code: 'IMAGE_STORAGE_NOT_CONFIGURED',
        message: 'Image storage is not configured for this environment',
      });
    }

    const uploadId = randomUUID();
    const publicId = imagePublicIdForPurpose(purpose, uploadId);
    const deliveryType: ImageDeliveryType =
      imageDeliveryTypeForPurpose(purpose);
    const signatureExpiresAt = new Date(
      now.getTime() + this.readSignatureWindow(),
    );
    const intentExpiresAt = new Date(now.getTime() + this.readIntentWindow());
    const reconciliationAfter = new Date(
      Math.max(signatureExpiresAt.getTime(), intentExpiresAt.getTime()) +
        this.readSettlementHorizon(),
    );
    const creationContextToken = dto.targetId
      ? null
      : randomBytes(32).toString('base64url');
    const creationContextHash = creationContextToken
      ? createHash('sha256').update(creationContextToken).digest('hex')
      : null;

    let uploadInstructions: UploadInstructions;
    try {
      uploadInstructions = this.storage.createUploadInstructions({
        purpose,
        publicId,
        storageContext,
        deliveryType,
        policy,
        issuedAt: now,
        signatureExpiresAt,
      });
    } catch (error) {
      this.raiseStorageError(error);
    }

    const budgets = this.readBudgets();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const [actorCount, cloudCount] = await Promise.all([
            tx.imageUpload.count({
              where: {
                uploaderId: actor.userId,
                createdAt: { gte: oneHourAgo },
              },
            }),
            tx.imageUpload.count({
              where: {
                storageProvider: storageContext.provider,
                storageAccountId: storageContext.accountId,
                createdAt: { gte: oneHourAgo },
              },
            }),
          ]);
          if (
            actorCount >= budgets.perActorPerHour ||
            cloudCount >= budgets.perCloudPerHour
          ) {
            throw this.rateLimitException();
          }
          await tx.imageUpload.create({
            data: {
              id: uploadId,
              uploaderId: actor.userId,
              purpose,
              targetId: dto.targetId ?? null,
              creationContextHash,
              storageProvider: storageContext.provider,
              storageAccountId: storageContext.accountId,
              publicId,
              resourceType: 'image',
              deliveryType,
              policyRevision: policy.revision,
              sourceContentType: dto.sourceContentType,
              declaredSizeBytes: dto.sourceSizeBytes,
              status: ImageUploadStatus.AUTHORIZED,
              issuedAt: now,
              signatureExpiresAt,
              intentExpiresAt,
              reconciliationAfter,
              createdAt: now,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === Number(HttpStatus.TOO_MANY_REQUESTS)
      ) {
        throw error;
      }
      if (this.isSerializationConflict(error)) {
        throw this.rateLimitException();
      }
      throw error;
    }

    return {
      uploadId,
      purpose,
      status: ImageUploadStatus.AUTHORIZED,
      targetId: dto.targetId ?? null,
      creationContextToken,
      issuedAt: now.toISOString(),
      signatureExpiresAt: signatureExpiresAt.toISOString(),
      intentExpiresAt: intentExpiresAt.toISOString(),
      attachmentExpiresAt: null,
      attachmentWindowSeconds: Math.floor(this.readAttachmentWindow() / 1000),
      acceptedSourceMimeTypes: ACCEPTED_SOURCE_MIME_TYPES,
      uploadInstructions: {
        url: uploadInstructions.url,
        method: uploadInstructions.method,
        fields: uploadInstructions.fields,
        expiresAt: uploadInstructions.expiresAt.toISOString(),
      },
    };
  }

  async complete(
    actor: UploadActor,
    uploadId: string,
    evidence: UploadEvidence,
  ): Promise<UploadStatusResponse> {
    const upload = await this.findOwnedUpload(actor, uploadId);
    this.assertPurposePermission(actor.role, upload.purpose);
    if (evidence.publicId !== upload.publicId) {
      throw new BadRequestException({
        code: 'UPLOAD_EVIDENCE_INVALID',
        message: 'The upload evidence does not match the allocated image',
      });
    }

    const evidenceHash = createHash('sha256')
      .update(
        `${evidence.publicId}\n${evidence.version}\n${evidence.signature}`,
      )
      .digest('hex');
    if (upload.status === ImageUploadStatus.VERIFIED_PENDING) {
      if (upload.verifiedEvidenceHash !== evidenceHash) {
        throw new ConflictException({
          code: 'UPLOAD_ALREADY_VERIFIED',
          message: 'This upload was verified with different provider evidence',
        });
      }
      if (
        !upload.attachmentExpiresAt ||
        upload.attachmentExpiresAt <= this.clock.now()
      ) {
        await this.markExpired(upload.id);
        throw this.expiredException();
      }
      return this.toStatus(upload);
    }
    if (upload.status === ImageUploadStatus.EXPIRED)
      throw this.expiredException();
    if (upload.status !== ImageUploadStatus.AUTHORIZED) {
      throw new ConflictException({
        code: 'UPLOAD_NOT_COMPLETABLE',
        message: 'This upload is not available for completion',
      });
    }
    const verificationStartedAt = this.clock.now();
    if (upload.intentExpiresAt <= verificationStartedAt) {
      await this.markExpired(upload.id);
      throw this.expiredException();
    }

    const attemptLimit = this.readBudgets().completionAttemptsPerIntent;
    const reservedAttempt = await this.prisma.imageUpload.updateMany({
      where: {
        id: upload.id,
        status: ImageUploadStatus.AUTHORIZED,
        intentExpiresAt: { gt: verificationStartedAt },
        verificationAttempts: { lt: attemptLimit },
      },
      data: {
        verificationAttempts: { increment: 1 },
        updatedAt: verificationStartedAt,
      },
    });
    if (reservedAttempt.count !== 1) {
      const current = await this.findOwnedUpload(actor, uploadId);
      if (
        current.status === ImageUploadStatus.AUTHORIZED &&
        current.verificationAttempts >= attemptLimit
      ) {
        throw this.rateLimitException();
      }
      if (
        current.status === ImageUploadStatus.AUTHORIZED &&
        current.intentExpiresAt <= this.clock.now()
      ) {
        await this.markExpired(upload.id);
        throw this.expiredException();
      }
      throw new ConflictException({
        code: 'UPLOAD_STATE_CHANGED',
        message: 'The upload state changed while it was being verified',
      });
    }

    let verified: VerifiedImageObject;
    try {
      verified = await this.storage.verifyUploadedObject({
        publicId: upload.publicId,
        storageContext: {
          provider: upload.storageProvider,
          accountId: upload.storageAccountId,
        },
        deliveryType: upload.deliveryType as ImageDeliveryType,
        evidence,
        policy: this.readPolicy(upload.purpose),
      });
    } catch (error) {
      if (
        error instanceof ImageStorageError &&
        error.code === 'OBJECT_POLICY_REJECTED'
      ) {
        await this.markRejected(upload.id, 'UPLOAD_OBJECT_POLICY_REJECTED');
      }
      this.raiseStorageError(error);
    }
    try {
      this.assertVerifiedImage(upload, verified);
    } catch (error) {
      if (error instanceof ConflictException) {
        await this.markRejected(upload.id, 'UPLOAD_OBJECT_POLICY_REJECTED');
      }
      throw error;
    }

    const now = this.clock.now();
    if (upload.intentExpiresAt <= now) {
      await this.markExpired(upload.id);
      throw this.expiredException();
    }
    const attachmentExpiresAt = new Date(
      verified.createdAt.getTime() + this.readAttachmentWindow(),
    );
    if (attachmentExpiresAt <= now) {
      await this.markExpired(upload.id);
      throw this.expiredException();
    }

    const updated = await this.prisma.imageUpload.updateMany({
      where: { id: upload.id, status: ImageUploadStatus.AUTHORIZED },
      data: {
        status: ImageUploadStatus.VERIFIED_PENDING,
        providerCreatedAt: verified.createdAt,
        attachmentExpiresAt,
        verifiedVersion: verified.version,
        verifiedFormat: verified.format,
        verifiedBytes: verified.bytes,
        verifiedWidth: verified.width,
        verifiedHeight: verified.height,
        verifiedPages: verified.pages,
        verifiedEvidenceHash: evidenceHash,
        updatedAt: now,
      },
    });
    if (updated.count !== 1) {
      const current = await this.findOwnedUpload(actor, uploadId);
      if (
        current.status === ImageUploadStatus.VERIFIED_PENDING &&
        current.verifiedEvidenceHash === evidenceHash &&
        current.attachmentExpiresAt &&
        current.attachmentExpiresAt > now
      ) {
        return this.toStatus(current);
      }
      if (
        current.status === ImageUploadStatus.EXPIRED ||
        (current.status === ImageUploadStatus.AUTHORIZED &&
          current.intentExpiresAt <= now)
      ) {
        await this.markExpired(current.id);
        throw this.expiredException();
      }
      throw new ConflictException({
        code: 'UPLOAD_STATE_CHANGED',
        message: 'The upload state changed while it was being verified',
      });
    }

    const persisted = await this.findOwnedUpload(actor, uploadId);
    return this.toStatus(persisted);
  }

  async getStatus(
    actor: UploadActor,
    uploadId: string,
  ): Promise<UploadStatusResponse> {
    const upload = await this.findOwnedUpload(actor, uploadId);
    this.assertPurposePermission(actor.role, upload.purpose);
    const now = this.clock.now();
    if (
      (upload.status === ImageUploadStatus.AUTHORIZED &&
        upload.intentExpiresAt <= now) ||
      (upload.status === ImageUploadStatus.VERIFIED_PENDING &&
        upload.attachmentExpiresAt !== null &&
        upload.attachmentExpiresAt <= now)
    ) {
      await this.markExpired(upload.id);
      return this.toStatus(await this.findOwnedUpload(actor, uploadId));
    }
    return this.toStatus(upload);
  }

  async getPreview(
    actor: UploadActor,
    uploadId: string,
  ): Promise<PendingImagePreview> {
    const upload = await this.findOwnedUpload(actor, uploadId);
    const currentActor = await this.prisma.user.findFirst({
      where: { id: actor.userId, deletedAt: null },
      select: { role: true, banned: true },
    });
    if (!currentActor || currentActor.banned === true) {
      throw new ForbiddenException({
        code: 'IMAGE_PURPOSE_FORBIDDEN',
        message: 'The current account cannot preview this image',
      });
    }
    this.assertPurposePermission(currentActor.role, upload.purpose);

    if (upload.status === ImageUploadStatus.EXPIRED) {
      throw this.expiredException();
    }
    if (upload.status !== ImageUploadStatus.VERIFIED_PENDING) {
      throw new ConflictException({
        code: 'UPLOAD_PREVIEW_NOT_AVAILABLE',
        message: 'Only a verified pending image can be previewed',
      });
    }
    if (
      !upload.attachmentExpiresAt ||
      upload.attachmentExpiresAt <= this.clock.now()
    ) {
      await this.markExpired(upload.id);
      throw this.expiredException();
    }

    const policy = this.readPolicy(upload.purpose);
    const storageContext = this.safeCurrentStorageContext();
    if (
      upload.storageProvider !== storageContext.provider ||
      upload.storageAccountId !== storageContext.accountId
    ) {
      throw new ServiceUnavailableException({
        code: 'IMAGE_READ_UNAVAILABLE',
        message: 'The image is temporarily unavailable',
      });
    }
    if (
      upload.publicId !== imagePublicIdForPurpose(upload.purpose, upload.id) ||
      upload.resourceType !== 'image' ||
      upload.deliveryType !== imageDeliveryTypeForPurpose(upload.purpose) ||
      upload.policyRevision !== policy.revision ||
      upload.verifiedVersion === null ||
      upload.verifiedFormat !== 'jpg' ||
      upload.verifiedPages !== 1 ||
      upload.verifiedBytes === null ||
      upload.verifiedBytes < 1 ||
      upload.verifiedWidth === null ||
      upload.verifiedHeight === null ||
      upload.verifiedWidth < 1 ||
      upload.verifiedHeight < 1 ||
      upload.verifiedWidth > policy.maxEdge ||
      upload.verifiedHeight > policy.maxEdge
    ) {
      throw new ConflictException({
        code: 'UPLOAD_PREVIEW_METADATA_INVALID',
        message: 'The pending image metadata is inconsistent',
      });
    }

    return this.imageReadService.createPendingPreview(upload.purpose, {
      publicId: upload.publicId,
      storageContext: {
        provider: upload.storageProvider,
        accountId: upload.storageAccountId,
      },
      resourceType: 'image',
      deliveryType: imageDeliveryTypeForPurpose(upload.purpose),
      version: upload.verifiedVersion,
    });
  }

  private safeCurrentStorageContext(): ImageStorageContext {
    try {
      const context = this.storage.getProviderContext();
      if (!context.provider || !context.accountId) throw new Error();
      return context;
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_READ_UNAVAILABLE',
        message: 'The image is temporarily unavailable',
      });
    }
  }

  private async findOwnedUpload(
    actor: UploadActor,
    uploadId: string,
  ): Promise<ImageUpload> {
    const upload = await this.prisma.imageUpload.findFirst({
      where: { id: uploadId, uploaderId: actor.userId },
    });
    if (!upload) throw new NotFoundException({ code: 'UPLOAD_NOT_FOUND' });
    return upload;
  }

  private async assertTargetExists(
    purpose: ImagePurpose,
    targetId: string,
  ): Promise<void> {
    const targetExists =
      imageTargetForPurpose(purpose) === 'asset'
        ? await this.prisma.asset.findUnique({
            where: { id: targetId },
            select: { id: true },
          })
        : await this.prisma.user.findFirst({
            where: { id: targetId, deletedAt: null },
            select: { id: true },
          });
    if (!targetExists) {
      throw new NotFoundException({
        code: 'IMAGE_TARGET_NOT_FOUND',
        message: 'The requested image target was not found',
      });
    }
  }

  private assertPurposePermission(role: UserRole, purpose: ImagePurpose): void {
    if (imagePurposeAllowsRole(role, purpose)) return;
    if (purpose === 'EMPLOYEE_PHOTO') {
      throw new ForbiddenException({
        code: 'IMAGE_PURPOSE_FORBIDDEN',
        message: 'Only an administrator can manage Employee Photos',
      });
    }
    throw new ForbiddenException({
      code: 'IMAGE_PURPOSE_FORBIDDEN',
      message: 'The current role cannot manage Asset Images',
    });
  }

  private assertVerifiedImage(
    upload: Awaited<ReturnType<ImageUploadService['findOwnedUpload']>>,
    verified: VerifiedImageObject,
  ): void {
    const policy = this.readPolicy(upload.purpose);
    const uploadWindowContainsProviderTime =
      verified.createdAt.getTime() >=
        upload.issuedAt.getTime() - 5 * 60 * 1000 &&
      verified.createdAt.getTime() <= upload.signatureExpiresAt.getTime();
    if (
      verified.publicId !== upload.publicId ||
      verified.resourceType !== 'image' ||
      verified.deliveryType !== upload.deliveryType ||
      verified.sourcePolicyRevision !== upload.policyRevision ||
      !uploadWindowContainsProviderTime ||
      verified.format !== 'jpg' ||
      verified.pages !== 1 ||
      verified.bytes < 1 ||
      verified.width < 1 ||
      verified.height < 1 ||
      verified.width > policy.maxEdge ||
      verified.height > policy.maxEdge
    ) {
      throw new ConflictException({
        code: 'UPLOAD_OBJECT_POLICY_REJECTED',
        message: 'The uploaded image does not meet the approved image policy',
      });
    }
  }

  private toStatus(
    upload: Awaited<ReturnType<ImageUploadService['findOwnedUpload']>>,
  ): UploadStatusResponse {
    const verifiedImage =
      upload.verifiedFormat &&
      upload.verifiedBytes !== null &&
      upload.verifiedWidth !== null &&
      upload.verifiedHeight !== null
        ? {
            format: upload.verifiedFormat,
            bytes: upload.verifiedBytes,
            width: upload.verifiedWidth,
            height: upload.verifiedHeight,
          }
        : undefined;
    return {
      uploadId: upload.id,
      purpose: upload.purpose,
      status: upload.status,
      targetId: upload.targetId,
      issuedAt: upload.issuedAt.toISOString(),
      signatureExpiresAt: upload.signatureExpiresAt.toISOString(),
      intentExpiresAt: upload.intentExpiresAt.toISOString(),
      reconciliationAfter: upload.reconciliationAfter.toISOString(),
      providerCreatedAt: upload.providerCreatedAt?.toISOString() ?? null,
      attachmentExpiresAt: upload.attachmentExpiresAt?.toISOString() ?? null,
      claimedTargetId: upload.claimedTargetId,
      claimedAt: upload.claimedAt?.toISOString() ?? null,
      ...(verifiedImage ? { verifiedImage } : {}),
      ...(upload.rejectionCode ? { rejectionCode: upload.rejectionCode } : {}),
    };
  }

  private readPolicy(purpose: ImagePurpose): ImageUploadPolicy {
    return this.readConfiguration(() => imageUploadPolicy(purpose));
  }

  private readBudgets(): ReturnType<typeof uploadBudgets> {
    return this.readConfiguration(uploadBudgets);
  }

  private readAttachmentWindow(): number {
    return this.readConfiguration(attachmentWindowMs);
  }

  private readSignatureWindow(): number {
    return this.readConfiguration(signatureWindowMs);
  }

  private readIntentWindow(): number {
    return this.readConfiguration(intentWindowMs);
  }

  private readSettlementHorizon(): number {
    return this.readConfiguration(uploadSettlementHorizonMs);
  }

  private readConfiguration<T>(load: () => T): T {
    try {
      return load();
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_UPLOAD_CONFIGURATION_INVALID',
        message: 'Image upload policy is not configured correctly',
      });
    }
  }

  private raiseStorageError(error: unknown): never {
    if (!(error instanceof ImageStorageError)) {
      this.logger.error(
        'Image storage operation failed without provider details',
      );
      throw new ServiceUnavailableException({
        code: 'IMAGE_STORAGE_UNAVAILABLE',
        message: 'Image storage is temporarily unavailable',
      });
    }
    switch (error.code) {
      case 'EVIDENCE_INVALID':
        throw new BadRequestException({
          code: 'UPLOAD_EVIDENCE_INVALID',
          message: 'The provider upload evidence could not be verified',
        });
      case 'OBJECT_NOT_FOUND':
        throw new ConflictException({
          code: 'UPLOAD_OBJECT_NOT_FOUND',
          message: 'The allocated image has not been uploaded',
        });
      case 'OBJECT_POLICY_REJECTED':
        throw new ConflictException({
          code: 'UPLOAD_OBJECT_POLICY_REJECTED',
          message: 'The uploaded image does not meet the approved image policy',
        });
      case 'UNAVAILABLE':
        throw new ServiceUnavailableException({
          code: 'IMAGE_STORAGE_UNAVAILABLE',
          message: 'Image storage is temporarily unavailable',
        });
    }
  }

  private expiredException(): GoneException {
    return new GoneException({
      code: 'UPLOAD_EXPIRED',
      message: 'The image upload window has expired',
    });
  }

  private rateLimitException(): HttpException {
    return new HttpException(
      {
        code: 'UPLOAD_RATE_LIMITED',
        message: 'The image upload request limit has been reached',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async markExpired(uploadId: string): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const upload = await tx.imageUpload.findUnique({
        where: { id: uploadId },
      });
      if (
        !upload ||
        (upload.status !== ImageUploadStatus.VERIFIED_PENDING &&
          upload.status !== ImageUploadStatus.AUTHORIZED)
      ) {
        return;
      }
      const cleanupPolicy = expiredUploadCleanupPolicy(upload, now);
      if (!cleanupPolicy) return;
      const updated = await tx.imageUpload.updateMany({
        where: {
          id: upload.id,
          status: upload.status,
          ...cleanupPolicy.deadlineFilter,
        },
        data: {
          status: ImageUploadStatus.EXPIRED,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) return;
      await enqueueImageCleanup(
        tx,
        upload,
        cleanupPolicy.reason,
        expiredUploadCleanupEligibleAt(upload, now),
        upload.verifiedVersion,
      );
    });
  }

  private async markRejected(
    uploadId: string,
    rejectionCode: string,
  ): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const upload = await tx.imageUpload.findUnique({
        where: { id: uploadId },
      });
      if (!upload || upload.status !== ImageUploadStatus.AUTHORIZED) return;
      const updated = await tx.imageUpload.updateMany({
        where: { id: uploadId, status: ImageUploadStatus.AUTHORIZED },
        data: {
          status: ImageUploadStatus.REJECTED,
          rejectionCode,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) return;
      await enqueueImageCleanup(
        tx,
        upload,
        ImageCleanupReason.REJECTED_UPLOAD,
        upload.reconciliationAfter,
        null,
      );
    });
  }

  private isSerializationConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
