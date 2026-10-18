import type { Readable } from 'node:stream';

export const IMAGE_STORAGE = Symbol('IMAGE_STORAGE');

export type ImagePurpose = 'ASSET_IMAGE' | 'EMPLOYEE_PHOTO';
export type ImageDeliveryType = 'upload' | 'authenticated';

export interface ImageStorageContext {
  readonly provider: string;
  readonly accountId: string;
}

export interface ImageUploadPolicy {
  readonly revision: string;
  readonly maxSourceBytes: number;
  readonly maxSourcePixels: number;
  readonly maxEdge: number;
  readonly quality: number;
  readonly acceptedSourceFormats: readonly string[];
}

export interface UploadInstructionsInput {
  readonly purpose: ImagePurpose;
  readonly publicId: string;
  readonly storageContext: ImageStorageContext;
  readonly deliveryType: ImageDeliveryType;
  readonly policy: ImageUploadPolicy;
  readonly issuedAt: Date;
  readonly signatureExpiresAt: Date;
}

export interface UploadInstructions {
  readonly transport: ImageUploadTransport;
  /** Temporary compatibility fields for callers being migrated to transport. */
  readonly url: string;
  readonly method: 'POST';
  readonly fields: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export type ImageUploadTransport =
  | {
      readonly kind: 'multipart-form-v1';
      readonly endpoint: string;
      readonly method: 'POST';
      readonly fields: Readonly<Record<string, string>>;
      readonly expiresAt: Date;
    }
  | {
      readonly kind: 'hams-binary-v1';
      readonly endpoint: string;
      readonly method: 'POST';
      readonly fields: Readonly<Record<string, string>>;
      readonly expiresAt: Date;
    };

export type UploadEvidence = Readonly<Record<string, unknown>>;

export interface VerifyUploadedObjectInput {
  readonly publicId: string;
  readonly storageContext: ImageStorageContext;
  readonly deliveryType: ImageDeliveryType;
  readonly evidence: UploadEvidence;
  readonly policy: ImageUploadPolicy;
}

export interface VerifiedImageObject {
  readonly publicId: string;
  readonly version: number;
  readonly resourceType: 'image';
  readonly deliveryType: ImageDeliveryType;
  readonly createdAt: Date;
  readonly format: 'jpg';
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly pages: 1;
  readonly sourcePolicyRevision: string;
}

export interface ImageObjectReference {
  readonly publicId: string;
  readonly storageContext: ImageStorageContext;
  readonly resourceType: 'image' | 'video' | 'raw';
  readonly deliveryType: ImageDeliveryType;
  readonly version?: number;
}

export interface ShortLivedImageGrant {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface ImageStoragePort {
  getProviderContext(): ImageStorageContext;
  createUploadInstructions(input: UploadInstructionsInput): UploadInstructions;
  fingerprintUploadEvidence(
    publicId: string,
    storageContext: ImageStorageContext,
    evidence: UploadEvidence,
  ): string;
  verifyUploadedObject(
    input: VerifyUploadedObjectInput,
  ): Promise<VerifiedImageObject>;
  publicUrl(reference: ImageObjectReference): string;
  createShortLivedReadGrant(
    reference: ImageObjectReference,
    expiresAt: Date,
  ): ShortLivedImageGrant;
  validateShortLivedReadGrant(
    reference: ImageObjectReference,
    grant: ShortLivedImageGrant,
  ): void;
  deleteObject(reference: ImageObjectReference): Promise<void>;
  deleteAllocatedImageVariants(input: {
    readonly publicId: string;
    readonly storageContext: ImageStorageContext;
  }): Promise<void>;
}

export interface LocalImageStoragePort extends ImageStoragePort {
  receiveLocalUpload(input: {
    readonly publicId: string;
    readonly stream: Readable;
    readonly policy: ImageUploadPolicy;
    readonly receivedAt: Date;
  }): Promise<UploadEvidence>;
  openPublicAsset(reference: ImageObjectReference): Promise<{
    readonly stream: Readable;
    readonly bytes: number;
  }>;
  openPrivateEmployeePhoto(
    reference: ImageObjectReference,
    grant: ShortLivedImageGrant,
  ): Promise<{
    readonly stream: Readable;
    readonly bytes: number;
  }>;
}

export function isLocalImageStoragePort(
  storage: ImageStoragePort,
): storage is LocalImageStoragePort {
  const hasLocalOperations =
    'receiveLocalUpload' in storage &&
    typeof storage.receiveLocalUpload === 'function' &&
    'openPublicAsset' in storage &&
    typeof storage.openPublicAsset === 'function' &&
    'openPrivateEmployeePhoto' in storage &&
    typeof storage.openPrivateEmployeePhoto === 'function';
  if (!hasLocalOperations) return false;
  try {
    return storage.getProviderContext().provider === 'local';
  } catch {
    return false;
  }
}

export function isVersionedAssetImageUrl(
  url: string,
  reference: ImageObjectReference,
): boolean {
  if (
    reference.resourceType !== 'image' ||
    reference.deliveryType !== 'upload' ||
    !reference.version ||
    !Number.isSafeInteger(reference.version)
  ) {
    return false;
  }
  if (reference.storageContext.provider === 'local') {
    return (
      url ===
      `/api/images/assets/${encodeURIComponent(reference.publicId)}/v${reference.version}.jpg`
    );
  }
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname.split('/').includes(`v${reference.version}`)
    );
  } catch {
    return false;
  }
}

export type ImageStorageErrorCode =
  | 'EVIDENCE_INVALID'
  | 'OBJECT_NOT_FOUND'
  | 'OBJECT_POLICY_REJECTED'
  | 'UNAVAILABLE';

export class ImageStorageError extends Error {
  constructor(
    readonly code: ImageStorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImageStorageError';
  }
}
