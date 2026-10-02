import { CloudinaryStorageAdapter } from './cloudinary-storage.adapter';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import {
  ImageStorageError,
  type UploadInstructionsInput,
} from './image-storage.port';
import { imageUploadPolicy } from './image-upload-policy';

const adapter = new CloudinaryStorageAdapter();

function uploadInput(
  purpose: UploadInstructionsInput['purpose'],
): UploadInstructionsInput {
  const issuedAt = new Date('2026-10-01T00:00:00.000Z');
  return {
    purpose,
    publicId: `hams-test-${purpose.toLowerCase()}-fixture`,
    storageContext: { provider: 'cloudinary', accountId: 'hams-test-cloud' },
    deliveryType: purpose === 'ASSET_IMAGE' ? 'upload' : 'authenticated',
    policy: imageUploadPolicy(purpose),
    issuedAt,
    signatureExpiresAt: new Date(issuedAt.getTime() + 60 * 60 * 1000),
  };
}

const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
const originalApiKey = process.env.CLOUDINARY_API_KEY;
const originalApiSecret = process.env.CLOUDINARY_API_SECRET;

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = 'hams-test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-api-key';
  process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
});

afterAll(() => {
  restoreEnvironment('CLOUDINARY_CLOUD_NAME', originalCloudName);
  restoreEnvironment('CLOUDINARY_API_KEY', originalApiKey);
  restoreEnvironment('CLOUDINARY_API_SECRET', originalApiSecret);
});

describe('Cloudinary storage adapter contract', () => {
  it('issues fixed, purpose-specific signed upload instructions without the API secret', () => {
    const asset = adapter.createUploadInstructions(uploadInput('ASSET_IMAGE'));
    const employee = adapter.createUploadInstructions(
      uploadInput('EMPLOYEE_PHOTO'),
    );

    expect(asset.url).toBe(
      'https://api.cloudinary.com/v1_1/hams-test-cloud/image/upload',
    );
    expect(asset.method).toBe('POST');
    expect(asset.fields).toMatchObject({
      api_key: 'test-api-key',
      overwrite: 'false',
      backup: 'false',
      allowed_formats: 'jpg,jpeg,png,webp,heic,heif',
    });
    expect(asset.fields.type).toBe('upload');
    expect(asset.fields.transformation).toContain('c_limit');
    expect(asset.fields.transformation).toContain('w_1600');
    expect(asset.fields.transformation).toContain('b_white,c_pad,w_1.0');
    expect(asset.fields.transformation).toContain('q_80');
    expect(asset.fields.transformation).toContain('fl_force_strip');
    expect(asset.fields.signature).toMatch(/^[a-f\d]{40}$/i);
    expect(JSON.stringify(asset)).not.toContain('test-api-secret');

    expect(employee.url).toBe(
      'https://api.cloudinary.com/v1_1/hams-test-cloud/image/upload',
    );
    expect(employee.fields.type).toBe('authenticated');
    expect(employee.fields.transformation).toContain('w_512');
    const signedParameters = Object.entries(employee.fields)
      .filter(([name]) => name !== 'api_key' && name !== 'signature')
      .sort(([left], [right]) => left.localeCompare(right));
    const signature = (parameters: [string, string][]) =>
      createHash('sha1')
        .update(
          parameters.map(([name, value]) => `${name}=${value}`).join('&') +
            'test-api-secret',
        )
        .digest('hex');
    expect(employee.fields.signature).toBe(signature(signedParameters));
    expect(employee.fields.signature).not.toBe(
      signature(
        signedParameters.map(([name, value]) => [
          name,
          name === 'type' ? 'upload' : value,
        ]),
      ),
    );
  });

  it('rejects animated WebP at the source-policy step even when pages is absent', () => {
    const instructions = adapter.createUploadInstructions(
      uploadInput('ASSET_IMAGE'),
    );
    const animatedOptions: Record<string, unknown> = {};
    runInNewContext(instructions.fields.eval, {
      resource_info: {
        format: 'webp',
        bytes: 1024,
        width: 100,
        height: 100,
        nb_frames: 3,
      },
      upload_options: animatedOptions,
    });
    expect(animatedOptions.allowed_formats).toBe('__hams_invalid_source__');

    const stillOptions: Record<string, unknown> = {};
    runInNewContext(instructions.fields.eval, {
      resource_info: {
        format: 'webp',
        bytes: 1024,
        width: 100,
        height: 100,
        nb_frames: 1,
      },
      upload_options: stillOptions,
    });
    expect(stillOptions.context).toBe('hams_policy_rev=image-normalization-v1');
  });

  it('deletes only the known public ID under its resource and delivery type', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ deleted: { 'hams-employee-photo-2': 'deleted' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    try {
      await adapter.deleteObject({
        publicId: 'hams-employee-photo-2',
        storageContext: {
          provider: 'cloudinary',
          accountId: 'hams-test-cloud',
        },
        resourceType: 'image',
        deliveryType: 'authenticated',
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        'https://api.cloudinary.com/v1_1/hams-test-cloud/resources/image/authenticated',
      );
      expect(options?.method).toBe('DELETE');
      expect(options?.body).toBeInstanceOf(URLSearchParams);
      expect((options?.body as URLSearchParams).getAll('public_ids[]')).toEqual(
        ['hams-employee-photo-2'],
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('creates public references and short-lived authenticated download grants only for matching delivery types', () => {
    const assetReference = {
      publicId: 'hams-asset-image-1',
      storageContext: { provider: 'cloudinary', accountId: 'hams-test-cloud' },
      resourceType: 'image' as const,
      deliveryType: 'upload' as const,
      version: 7,
    };
    const employeeReference = {
      publicId: 'hams-employee-photo-2',
      storageContext: { provider: 'cloudinary', accountId: 'hams-test-cloud' },
      resourceType: 'image' as const,
      deliveryType: 'authenticated' as const,
      version: 8,
    };

    expect(adapter.publicUrl(assetReference)).toBe(
      'https://res.cloudinary.com/hams-test-cloud/image/upload/v7/hams-asset-image-1.jpg',
    );
    expect(() => adapter.publicUrl(employeeReference)).toThrow(
      ImageStorageError,
    );

    const grant = adapter.createShortLivedReadGrant(
      employeeReference,
      new Date(Date.now() + 5 * 60 * 1000),
    );
    const grantUrl = new URL(grant.url);
    expect(grantUrl.origin).toBe('https://api.cloudinary.com');
    expect(grantUrl.pathname).toContain('/image/download');
    expect(grantUrl.searchParams.get('type')).toBe('authenticated');
    expect(grantUrl.searchParams.get('public_id')).toBe(
      employeeReference.publicId,
    );
    expect(grantUrl.searchParams.get('expires_at')).toBeTruthy();
    expect(grant.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 5 * 60 * 1000,
    );
    expect(grantUrl.search).not.toContain('test-api-secret');
    expect(() =>
      adapter.createShortLivedReadGrant(
        { ...assetReference },
        new Date(Date.now() + 5 * 60 * 1000),
      ),
    ).toThrow(ImageStorageError);
  });

  it('rejects provider evidence that does not identify the allocated object', async () => {
    const input = uploadInput('ASSET_IMAGE');
    await expect(
      adapter.verifyUploadedObject({
        publicId: input.publicId,
        storageContext: input.storageContext,
        deliveryType: input.deliveryType,
        policy: input.policy,
        evidence: {
          publicId: 'another-object',
          version: 1,
          signature: 'a'.repeat(40),
        },
      }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
  });

  it('fails closed when provider credentials are absent', () => {
    process.env.CLOUDINARY_API_SECRET = '';
    expect(() =>
      adapter.createUploadInstructions(uploadInput('ASSET_IMAGE')),
    ).toThrow(ImageStorageError);
  });
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
