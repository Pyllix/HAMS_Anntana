import { UserRole } from '@prisma/client';
import type {
  ImageDeliveryType,
  ImagePurpose,
  ImageUploadPolicy,
} from './image-storage.port';

export const ACCEPTED_SOURCE_FORMATS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
] as const;

export const ACCEPTED_SOURCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const POLICY_REVISION = 'image-normalization-v1';
export const DEFAULT_MAX_SOURCE_BYTES = 10_000_000;
export const DEFAULT_MAX_SOURCE_PIXELS = 25_000_000;
export const DEFAULT_ATTACHMENT_WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_SIGNATURE_WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_UPLOAD_SETTLEMENT_HORIZON_MS = 10 * 60 * 1000;
export const MIN_UPLOAD_SETTLEMENT_HORIZON_MS = 60 * 1000;
export const IMAGE_CLEANUP_PROVIDER_REQUESTS_PER_OBJECT = 9;

const IMAGE_PURPOSE_ROLES: Readonly<Record<ImagePurpose, readonly UserRole[]>> =
  {
    ASSET_IMAGE: [
      UserRole.ADMIN,
      UserRole.ASSET_CENTER_STAFF,
      UserRole.PARCEL_STAFF,
    ],
    EMPLOYEE_PHOTO: [UserRole.ADMIN],
  };

export function imageTargetForPurpose(purpose: ImagePurpose): 'asset' | 'user' {
  return purpose === 'ASSET_IMAGE' ? 'asset' : 'user';
}

export function imageDeliveryTypeForPurpose(
  purpose: ImagePurpose,
): ImageDeliveryType {
  return purpose === 'ASSET_IMAGE' ? 'upload' : 'authenticated';
}

export function imagePurposeAllowsRole(
  role: UserRole | undefined,
  purpose: ImagePurpose,
): boolean {
  return role !== undefined && IMAGE_PURPOSE_ROLES[purpose].includes(role);
}

export function imagePublicIdForPurpose(
  purpose: ImagePurpose,
  uploadId: string,
): string {
  const prefix = purpose === 'ASSET_IMAGE' ? 'asset-image' : 'employee-photo';
  return `hams-${prefix}-${uploadId}`;
}

export function imageUploadPolicy(
  purpose: ImagePurpose,
  maxSourceBytes = configuredPositiveInteger(
    'IMAGE_UPLOAD_MAX_SOURCE_BYTES',
    DEFAULT_MAX_SOURCE_BYTES,
    DEFAULT_MAX_SOURCE_BYTES,
  ),
  maxSourcePixels = configuredPositiveInteger(
    'IMAGE_UPLOAD_MAX_SOURCE_PIXELS',
    DEFAULT_MAX_SOURCE_PIXELS,
    DEFAULT_MAX_SOURCE_PIXELS,
  ),
): ImageUploadPolicy {
  return {
    revision: POLICY_REVISION,
    maxSourceBytes,
    maxSourcePixels,
    maxEdge: purpose === 'ASSET_IMAGE' ? 1600 : 512,
    quality: 80,
    acceptedSourceFormats: ACCEPTED_SOURCE_FORMATS,
  };
}

export function uploadBudgets(): {
  readonly perActorPerHour: number;
  readonly perCloudPerHour: number;
  readonly completionAttemptsPerIntent: number;
} {
  return {
    perActorPerHour: configuredPositiveInteger(
      'IMAGE_UPLOAD_MAX_INTENTS_PER_ACTOR_PER_HOUR',
      20,
      1000,
    ),
    perCloudPerHour: configuredPositiveInteger(
      'IMAGE_UPLOAD_MAX_INTENTS_PER_CLOUD_PER_HOUR',
      300,
      10000,
    ),
    completionAttemptsPerIntent: configuredPositiveInteger(
      'IMAGE_UPLOAD_MAX_COMPLETION_ATTEMPTS_PER_INTENT',
      10,
      100,
    ),
  };
}

export function attachmentWindowMs(): number {
  return (
    configuredPositiveInteger(
      'IMAGE_UPLOAD_ATTACHMENT_WINDOW_SECONDS',
      DEFAULT_ATTACHMENT_WINDOW_MS / 1000,
      DEFAULT_ATTACHMENT_WINDOW_MS / 1000,
    ) * 1000
  );
}

export function signatureWindowMs(): number {
  // Cloudinary signatures expire after one hour; do not expose a longer window.
  return Math.min(
    configuredPositiveInteger(
      'IMAGE_UPLOAD_SIGNATURE_WINDOW_SECONDS',
      DEFAULT_SIGNATURE_WINDOW_MS / 1000,
      DEFAULT_SIGNATURE_WINDOW_MS / 1000,
    ) * 1000,
    DEFAULT_SIGNATURE_WINDOW_MS,
  );
}

export function intentWindowMs(): number {
  return (
    configuredPositiveInteger(
      'IMAGE_UPLOAD_INTENT_WINDOW_SECONDS',
      DEFAULT_SIGNATURE_WINDOW_MS / 1000,
      DEFAULT_SIGNATURE_WINDOW_MS / 1000,
    ) * 1000
  );
}

export function uploadSettlementHorizonMs(): number {
  const settlementHorizonMs =
    configuredPositiveInteger(
      'IMAGE_UPLOAD_SETTLEMENT_HORIZON_SECONDS',
      DEFAULT_UPLOAD_SETTLEMENT_HORIZON_MS / 1000,
      60 * 60,
    ) * 1000;
  if (settlementHorizonMs < MIN_UPLOAD_SETTLEMENT_HORIZON_MS) {
    throw new Error(
      'IMAGE_UPLOAD_SETTLEMENT_HORIZON_SECONDS must be at least 60',
    );
  }
  return settlementHorizonMs;
}

export function imageCleanupConfiguration(): {
  readonly intervalMs: number;
  readonly batchSize: number;
  readonly providerRequestBudget: number;
  readonly leaseMs: number;
  readonly providerTimeoutMs: number;
  readonly maxBackoffMs: number;
} {
  const providerRequestBudget = configuredPositiveInteger(
    'IMAGE_CLEANUP_PROVIDER_REQUEST_BUDGET',
    18,
    90,
  );
  if (providerRequestBudget < IMAGE_CLEANUP_PROVIDER_REQUESTS_PER_OBJECT) {
    throw new Error(
      `IMAGE_CLEANUP_PROVIDER_REQUEST_BUDGET must be at least ${IMAGE_CLEANUP_PROVIDER_REQUESTS_PER_OBJECT}`,
    );
  }
  const leaseMs =
    configuredPositiveInteger('IMAGE_CLEANUP_LEASE_SECONDS', 120, 3600) * 1000;
  const providerTimeoutMs = imageCleanupProviderTimeoutMs();
  if (
    leaseMs <
    IMAGE_CLEANUP_PROVIDER_REQUESTS_PER_OBJECT * providerTimeoutMs + 5_000
  ) {
    throw new Error(
      'IMAGE_CLEANUP_LEASE_SECONDS must cover the bounded provider request sequence',
    );
  }
  return {
    intervalMs:
      configuredPositiveInteger('IMAGE_CLEANUP_INTERVAL_SECONDS', 300, 3600) *
      1000,
    batchSize: configuredPositiveInteger('IMAGE_CLEANUP_BATCH_SIZE', 20, 500),
    providerRequestBudget,
    leaseMs,
    providerTimeoutMs,
    maxBackoffMs:
      configuredPositiveInteger(
        'IMAGE_CLEANUP_MAX_BACKOFF_SECONDS',
        24 * 60 * 60,
        7 * 24 * 60 * 60,
      ) * 1000,
  };
}

export function imageCleanupProviderTimeoutMs(): number {
  return configuredPositiveInteger(
    'IMAGE_CLEANUP_PROVIDER_TIMEOUT_MS',
    5_000,
    30_000,
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
