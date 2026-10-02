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
  readonly url: string;
  readonly method: 'POST';
  readonly fields: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export interface UploadEvidence {
  readonly publicId: string;
  readonly version: number;
  readonly signature: string;
}

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
  verifyUploadedObject(
    input: VerifyUploadedObjectInput,
  ): Promise<VerifiedImageObject>;
  publicUrl(reference: ImageObjectReference): string;
  createShortLivedReadGrant(
    reference: ImageObjectReference,
    expiresAt: Date,
  ): ShortLivedImageGrant;
  deleteObject(reference: ImageObjectReference): Promise<void>;
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
