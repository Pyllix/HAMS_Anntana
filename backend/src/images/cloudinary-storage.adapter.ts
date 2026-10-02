import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ImageStorageError,
  type ImageStorageContext,
  type ImageObjectReference,
  type ImageStoragePort,
  type ShortLivedImageGrant,
  type UploadInstructions,
  type UploadInstructionsInput,
  type VerifiedImageObject,
  type VerifyUploadedObjectInput,
} from './image-storage.port';

interface CloudinaryCredentials {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

interface CloudinaryResourceResponse {
  public_id?: unknown;
  version?: unknown;
  resource_type?: unknown;
  type?: unknown;
  created_at?: unknown;
  format?: unknown;
  bytes?: unknown;
  width?: unknown;
  height?: unknown;
  pages?: unknown;
  context?: {
    custom?: Record<string, unknown>;
  };
}

export class CloudinaryStorageAdapter implements ImageStoragePort {
  getProviderContext(): ImageStorageContext {
    const credentials = this.credentials();
    return { provider: 'cloudinary', accountId: credentials.cloudName };
  }

  createUploadInstructions(input: UploadInstructionsInput): UploadInstructions {
    const credentials = this.credentials(input.storageContext);
    const timestamp = Math.floor(input.issuedAt.getTime() / 1000);
    const transformation = [
      [
        'a_exif',
        'c_limit',
        `w_${input.policy.maxEdge}`,
        `h_${input.policy.maxEdge}`,
      ].join(','),
      'b_white,c_pad,w_1.0',
      [`f_jpg`, `q_${input.policy.quality}`, 'fl_force_strip'].join(','),
    ].join('/');
    const evalPolicy = this.sourcePolicyEval(input);
    const signedFields: Record<string, string> = {
      allowed_formats: input.policy.acceptedSourceFormats.join(','),
      backup: 'false',
      eval: evalPolicy,
      overwrite: 'false',
      public_id: input.publicId,
      timestamp: String(timestamp),
      transformation,
      type: input.deliveryType,
    };
    const signature = this.apiSignature(signedFields, credentials.apiSecret);

    return {
      url: `https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`,
      method: 'POST',
      fields: {
        ...signedFields,
        api_key: credentials.apiKey,
        signature,
      },
      expiresAt: input.signatureExpiresAt,
    };
  }

  async verifyUploadedObject(
    input: VerifyUploadedObjectInput,
  ): Promise<VerifiedImageObject> {
    const credentials = this.credentials(input.storageContext);
    if (
      input.evidence.publicId !== input.publicId ||
      !Number.isSafeInteger(input.evidence.version) ||
      input.evidence.version < 1 ||
      !/^[a-f\d]{40}$/i.test(input.evidence.signature)
    ) {
      throw new ImageStorageError(
        'EVIDENCE_INVALID',
        'The provider upload evidence is invalid',
      );
    }

    const responseSignature = this.apiSignature(
      {
        public_id: input.evidence.publicId,
        version: String(input.evidence.version),
      },
      credentials.apiSecret,
    );
    if (!this.constantTimeEqual(responseSignature, input.evidence.signature)) {
      throw new ImageStorageError(
        'EVIDENCE_INVALID',
        'The provider upload evidence is invalid',
      );
    }

    const lookupUrl = new URL(
      `https://api.cloudinary.com/v1_1/${credentials.cloudName}/resources/image/${input.deliveryType}/${encodeURIComponent(input.publicId)}`,
    );
    const result = await this.fetchResource(lookupUrl, credentials);
    if (
      result.public_id !== input.publicId ||
      result.version !== input.evidence.version ||
      result.resource_type !== 'image' ||
      result.type !== input.deliveryType
    ) {
      throw new ImageStorageError(
        'OBJECT_POLICY_REJECTED',
        'The uploaded object does not match its issued image policy',
      );
    }

    const createdAt = this.parseProviderDate(result.created_at);
    const contextRevision = result.context?.custom?.hams_policy_rev;
    const width = this.positiveInteger(result.width);
    const height = this.positiveInteger(result.height);
    const bytes = this.positiveInteger(result.bytes);
    const pages = result.pages === undefined ? 1 : result.pages;
    if (
      !createdAt ||
      contextRevision !== input.policy.revision ||
      result.format !== 'jpg' ||
      width === null ||
      height === null ||
      bytes === null ||
      pages !== 1 ||
      width > input.policy.maxEdge ||
      height > input.policy.maxEdge
    ) {
      throw new ImageStorageError(
        'OBJECT_POLICY_REJECTED',
        'The uploaded object does not match its issued image policy',
      );
    }

    return {
      publicId: input.publicId,
      version: input.evidence.version,
      resourceType: 'image',
      deliveryType: input.deliveryType,
      createdAt,
      format: 'jpg',
      bytes,
      width,
      height,
      pages: 1,
      sourcePolicyRevision: input.policy.revision,
    };
  }

  publicUrl(reference: ImageObjectReference): string {
    if (
      reference.resourceType !== 'image' ||
      reference.deliveryType !== 'upload' ||
      !reference.version
    ) {
      throw new ImageStorageError(
        'OBJECT_POLICY_REJECTED',
        'Only versioned public image references can produce a public URL',
      );
    }
    const credentials = this.credentials(reference.storageContext);
    return `https://res.cloudinary.com/${credentials.cloudName}/image/upload/v${reference.version}/${this.encodePublicId(reference.publicId)}.jpg`;
  }

  createShortLivedReadGrant(
    reference: ImageObjectReference,
    expiresAt: Date,
  ): ShortLivedImageGrant {
    if (
      reference.resourceType !== 'image' ||
      reference.deliveryType !== 'authenticated'
    ) {
      throw new ImageStorageError(
        'OBJECT_POLICY_REJECTED',
        'Temporary read grants are only available for authenticated images',
      );
    }
    const credentials = this.credentials(reference.storageContext);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expirySeconds = Math.floor(expiresAt.getTime() / 1000);
    if (expirySeconds <= nowSeconds || expirySeconds - nowSeconds > 3600) {
      throw new ImageStorageError(
        'OBJECT_POLICY_REJECTED',
        'The requested image grant expiry is outside the allowed window',
      );
    }

    const signedFields: Record<string, string> = {
      attachment: 'false',
      expires_at: String(expirySeconds),
      format: 'jpg',
      public_id: reference.publicId,
      timestamp: String(nowSeconds),
      type: reference.deliveryType,
    };
    const signature = this.apiSignature(signedFields, credentials.apiSecret);
    const query = new URLSearchParams({
      ...signedFields,
      api_key: credentials.apiKey,
      signature,
    });
    return {
      url: `https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/download?${query.toString()}`,
      expiresAt: new Date(expirySeconds * 1000),
    };
  }

  async deleteObject(reference: ImageObjectReference): Promise<void> {
    const credentials = this.credentials(reference.storageContext);
    const body = new URLSearchParams();
    body.append('public_ids[]', reference.publicId);
    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${credentials.cloudName}/resources/${reference.resourceType}/${reference.deliveryType}`,
        {
          method: 'DELETE',
          headers: {
            authorization: `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body,
          signal: AbortSignal.timeout(5000),
        },
      );
    } catch {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Image storage is temporarily unavailable',
      );
    }
    if (!response.ok) {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Image storage is temporarily unavailable',
      );
    }
    const payload = await this.responsePayload(response);
    const deleted = isRecord(payload) ? payload.deleted : null;
    if (
      !isRecord(deleted) ||
      !['deleted', 'not_found', 'not found'].includes(
        String(deleted[reference.publicId]),
      )
    ) {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Image storage did not confirm object deletion',
      );
    }
  }

  private async fetchResource(
    url: URL,
    credentials: CloudinaryCredentials,
  ): Promise<CloudinaryResourceResponse> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          authorization: `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64')}`,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Image storage is temporarily unavailable',
      );
    }
    if (response.status === 404) {
      throw new ImageStorageError(
        'OBJECT_NOT_FOUND',
        'The allocated image has not been uploaded',
      );
    }
    if (!response.ok) {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Image storage is temporarily unavailable',
      );
    }
    const payload = await this.responsePayload(response);
    if (!isRecord(payload)) {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Image storage returned an invalid response',
      );
    }
    return payload;
  }

  private sourcePolicyEval(input: UploadInstructionsInput): string {
    const formats = JSON.stringify(input.policy.acceptedSourceFormats);
    const invalidFormat = JSON.stringify('__hams_invalid_source__');
    const fail = `upload_options.allowed_formats = ${invalidFormat};`;
    const accept = `upload_options.context = "hams_policy_rev=${input.policy.revision}";`;
    return `if (${formats}.indexOf((resource_info.format || "").toLowerCase()) < 0 || resource_info.bytes > ${input.policy.maxSourceBytes} || !resource_info.width || !resource_info.height || (resource_info.pages && resource_info.pages !== 1) || resource_info.nb_frames > 1 || resource_info.width * resource_info.height > ${input.policy.maxSourcePixels}) { ${fail} } else { ${accept} }`;
  }

  private credentials(context?: ImageStorageContext): CloudinaryCredentials {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (
      !cloudName ||
      !/^[a-z\d_-]+$/i.test(cloudName) ||
      !apiKey ||
      !apiSecret ||
      (context !== undefined &&
        (context.provider !== 'cloudinary' || cloudName !== context.accountId))
    ) {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Cloudinary image storage is not configured for this environment',
      );
    }
    return { cloudName, apiKey, apiSecret };
  }

  private async responsePayload(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private apiSignature(
    fields: Readonly<Record<string, string>>,
    apiSecret: string,
  ): string {
    const payload = Object.entries(fields)
      .filter(([, value]) => value !== '')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }

  private constantTimeEqual(left: string, right: string): boolean {
    const leftBytes = Buffer.from(left.toLowerCase());
    const rightBytes = Buffer.from(right.toLowerCase());
    return (
      leftBytes.length === rightBytes.length &&
      timingSafeEqual(leftBytes, rightBytes)
    );
  }

  private parseProviderDate(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private positiveInteger(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
      ? value
      : null;
  }

  private encodePublicId(publicId: string): string {
    return publicId.split('/').map(encodeURIComponent).join('/');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
