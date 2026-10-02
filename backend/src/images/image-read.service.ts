import { createHash } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { IMAGE_CLOCK, type ImageClock } from './image-clock.port';
import {
  IMAGE_STORAGE,
  type ImageObjectReference,
  type ImageStoragePort,
} from './image-storage.port';
import {
  managedImageLocator,
  type ManagedImageLocator,
  type ManagedImageRecord,
} from './image-attachment.service';

export type EmployeePhotoDescriptor =
  | { readonly hasEmployeePhoto: false; readonly photoRevision: null }
  | { readonly hasEmployeePhoto: true; readonly photoRevision: string };

export interface EmployeePhotoReadResponse {
  readonly hasEmployeePhoto: boolean;
  readonly photoRevision: string | null;
  readonly url: string | null;
  readonly expiresAt: string | null;
}

export interface PendingImagePreview {
  readonly purpose: 'ASSET_IMAGE' | 'EMPLOYEE_PHOTO';
  readonly status: 'VERIFIED_PENDING';
  readonly revision: string;
  readonly url: string;
  readonly expiresAt: string | null;
}

export const PRIVATE_USER_IMAGE_FIELDS: ReadonlySet<string> = new Set([
  'imageUrl',
  'imageStorageProvider',
  'imageStorageAccountId',
  'imagePublicId',
  'imageResourceType',
  'imageDeliveryType',
  'imageVersion',
]);

@Injectable()
export class ImageReadService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMAGE_STORAGE) private readonly storage: ImageStoragePort,
    @Inject(IMAGE_CLOCK) private readonly clock: ImageClock,
  ) {}

  describeEmployeePhoto(record: ManagedImageRecord): EmployeePhotoDescriptor {
    const locator = managedImageLocator(record);
    if (!locator) return { hasEmployeePhoto: false, photoRevision: null };
    if (locator.deliveryType !== 'authenticated') {
      throw this.invalidPhotoMetadata();
    }
    return {
      hasEmployeePhoto: true,
      photoRevision: this.revision(this.toReference(locator)),
    };
  }

  projectUser<T extends ManagedImageRecord>(record: T) {
    const photo = this.describeEmployeePhoto(record);
    const publicFields = Object.fromEntries(
      Object.entries(record).filter(
        ([key]) => !PRIVATE_USER_IMAGE_FIELDS.has(key),
      ),
    );
    return {
      ...publicFields,
      imageUrl: null,
      ...photo,
    } as Omit<T, keyof ManagedImageRecord> &
      EmployeePhotoDescriptor & { readonly imageUrl: null };
  }

  async describeEmployeePhotoByUserId(
    userId: string,
  ): Promise<EmployeePhotoDescriptor> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        imageUrl: true,
        imageStorageProvider: true,
        imageStorageAccountId: true,
        imagePublicId: true,
        imageResourceType: true,
        imageDeliveryType: true,
        imageVersion: true,
      },
    });
    if (!user) return { hasEmployeePhoto: false, photoRevision: null };
    return this.describeEmployeePhoto(user);
  }

  async readEmployeePhoto(
    idOrEmployeeId: string,
  ): Promise<EmployeePhotoReadResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: idOrEmployeeId }, { employeeId: idOrEmployeeId }],
      },
      select: {
        imageUrl: true,
        imageStorageProvider: true,
        imageStorageAccountId: true,
        imagePublicId: true,
        imageResourceType: true,
        imageDeliveryType: true,
        imageVersion: true,
      },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'The requested user was not found',
      });
    }

    const photo = this.describeEmployeePhoto(user);
    if (!photo.hasEmployeePhoto) {
      return { ...photo, url: null, expiresAt: null };
    }
    const locator = this.requireEmployeePhotoLocator(user);
    const grant = this.createReadGrant(this.toReference(locator));
    return {
      ...photo,
      url: grant.url,
      expiresAt: grant.expiresAt.toISOString(),
    };
  }

  createPendingPreview(
    purpose: 'ASSET_IMAGE' | 'EMPLOYEE_PHOTO',
    reference: ImageObjectReference,
  ): PendingImagePreview {
    if (
      (purpose === 'ASSET_IMAGE' && reference.deliveryType !== 'upload') ||
      (purpose === 'EMPLOYEE_PHOTO' &&
        reference.deliveryType !== 'authenticated')
    ) {
      throw this.invalidPhotoMetadata();
    }
    const revision = this.revision(reference);
    if (purpose === 'EMPLOYEE_PHOTO') {
      const grant = this.createReadGrant(reference);
      return {
        purpose,
        status: 'VERIFIED_PENDING',
        revision,
        url: grant.url,
        expiresAt: grant.expiresAt.toISOString(),
      };
    }

    try {
      const url = this.storage.publicUrl(reference);
      const parsedUrl = new URL(url);
      if (
        parsedUrl.protocol !== 'https:' ||
        !reference.version ||
        !parsedUrl.pathname.split('/').includes(`v${reference.version}`)
      ) {
        throw new Error('Invalid public image URL');
      }
      return {
        purpose,
        status: 'VERIFIED_PENDING',
        revision,
        url,
        expiresAt: null,
      };
    } catch {
      throw this.readUnavailable();
    }
  }

  private createReadGrant(reference: ImageObjectReference) {
    const now = this.clock.now();
    let requestedExpiry: Date;
    try {
      requestedExpiry = new Date(
        now.getTime() + employeePhotoReadGrantWindowMs(),
      );
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_READ_CONFIGURATION_INVALID',
        message: 'Employee photo access is not configured correctly',
      });
    }

    try {
      const context = this.storage.getProviderContext();
      if (
        context.provider !== reference.storageContext.provider ||
        context.accountId !== reference.storageContext.accountId
      ) {
        throw new Error('The image provider environment has changed');
      }
      const grant = this.storage.createShortLivedReadGrant(
        reference,
        requestedExpiry,
      );
      const parsedUrl = new URL(grant.url);
      const isCloudinaryDownloadGrant =
        context.provider !== 'cloudinary' ||
        (parsedUrl.hostname === 'api.cloudinary.com' &&
          parsedUrl.pathname === `/v1_1/${context.accountId}/image/download` &&
          parsedUrl.searchParams.get('public_id') === reference.publicId &&
          parsedUrl.searchParams.get('type') === 'authenticated' &&
          parsedUrl.searchParams.get('format') === 'jpg' &&
          parsedUrl.searchParams.get('signature') !== null &&
          Number(parsedUrl.searchParams.get('expires_at')) ===
            Math.floor(grant.expiresAt.getTime() / 1000));
      if (
        parsedUrl.protocol !== 'https:' ||
        !Number.isFinite(grant.expiresAt.getTime()) ||
        grant.expiresAt <= now ||
        grant.expiresAt.getTime() > requestedExpiry.getTime() + 1000 ||
        !isCloudinaryDownloadGrant
      ) {
        throw new Error('The provider returned an invalid read grant');
      }
      return grant;
    } catch {
      throw this.readUnavailable();
    }
  }

  private requireEmployeePhotoLocator(
    record: ManagedImageRecord,
  ): ManagedImageLocator {
    const locator = managedImageLocator(record);
    if (!locator || locator.deliveryType !== 'authenticated') {
      throw this.invalidPhotoMetadata();
    }
    return locator;
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

  private revision(reference: ImageObjectReference): string {
    return createHash('sha256')
      .update(
        [
          reference.storageContext.provider,
          reference.storageContext.accountId,
          reference.publicId,
          reference.resourceType,
          reference.deliveryType,
          reference.version ?? '',
        ].join('\n'),
      )
      .digest('base64url');
  }

  private invalidPhotoMetadata(): ConflictException {
    return new ConflictException({
      code: 'IMAGE_ATTACHMENT_METADATA_INVALID',
      message: 'The current image attachment metadata is inconsistent',
    });
  }

  private readUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'IMAGE_READ_UNAVAILABLE',
      message: 'The image is temporarily unavailable',
    });
  }
}

export function employeePhotoReadGrantWindowMs(): number {
  return (
    configuredPositiveInteger(
      'IMAGE_EMPLOYEE_PHOTO_READ_GRANT_SECONDS',
      300,
      60 * 60,
    ) * 1000
  );
}

function configuredPositiveInteger(
  name: string,
  fallback: number,
  maximum: number,
): number {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === '') return fallback;
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} is outside the supported range`);
  }
  return value;
}
