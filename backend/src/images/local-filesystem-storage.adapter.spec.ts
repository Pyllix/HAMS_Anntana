import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { LocalFilesystemStorageAdapter } from './local-filesystem-storage.adapter';
import { imageUploadPolicy } from './image-upload-policy';
import type {
  ImageStorageContext,
  VerifyUploadedObjectInput,
} from './image-storage.port';

const fixtureDirectory = join(
  __dirname,
  '../../test/fixtures/cloudinary-contract',
);
const uploadId = 'c4c51a2e-3c27-4e68-9954-0c7c03b1564b';
const employeePhotoReadGrantSecret = 'test-employee-photo-read-grant-secret';

describe('LocalFilesystemStorageAdapter', () => {
  let root: string;
  let storage: LocalFilesystemStorageAdapter;
  let context: ImageStorageContext;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'hams-local-image-store-'));
    storage = new LocalFilesystemStorageAdapter(
      {
        provider: 'local',
        storageRoot: join(root, 'images'),
        tempRoot: join(root, 'temp'),
      },
      undefined,
      employeePhotoReadGrantSecret,
    );
    context = storage.getProviderContext();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('uses a stable local identity and issues a same-origin upload transport without Cloudinary credentials', () => {
    const instructions = storage.createUploadInstructions({
      purpose: 'ASSET_IMAGE',
      publicId: `hams-asset-image-${uploadId}`,
      storageContext: context,
      deliveryType: 'upload',
      policy: imageUploadPolicy('ASSET_IMAGE'),
      issuedAt: new Date('2026-10-18T00:00:00.000Z'),
      signatureExpiresAt: new Date('2026-10-18T01:00:00.000Z'),
    });

    expect(context).toEqual({
      provider: 'local',
      accountId: 'hams-local-image-store-v1',
    });
    expect(instructions.transport).toEqual({
      kind: 'hams-binary-v1',
      endpoint: `/images/uploads/${uploadId}/file`,
      method: 'POST',
      fields: {},
      expiresAt: new Date('2026-10-18T01:00:00.000Z'),
    });
  });

  it('issues a local upload transport for an authenticated Employee Photo', () => {
    const instructions = storage.createUploadInstructions({
      purpose: 'EMPLOYEE_PHOTO',
      publicId: 'hams-employee-photo-' + uploadId,
      storageContext: context,
      deliveryType: 'authenticated',
      policy: imageUploadPolicy('EMPLOYEE_PHOTO'),
      issuedAt: new Date('2026-10-18T00:00:00.000Z'),
      signatureExpiresAt: new Date('2026-10-18T01:00:00.000Z'),
    });

    expect(instructions.transport).toEqual({
      kind: 'hams-binary-v1',
      endpoint: `/images/uploads/${uploadId}/file`,
      method: 'POST',
      fields: {},
      expiresAt: new Date('2026-10-18T01:00:00.000Z'),
    });
  });

  it('issues a short-lived same-origin grant for a private Employee Photo', () => {
    const expiresAt = new Date('2026-10-18T00:05:00.000Z');
    const reference = {
      publicId: 'hams-employee-photo-' + uploadId,
      storageContext: context,
      resourceType: 'image' as const,
      deliveryType: 'authenticated' as const,
      version: 1,
    };

    const grant = storage.createShortLivedReadGrant(reference, expiresAt);

    expect(grant.url).toMatch(
      new RegExp(
        '^/api/images/employees/hams-employee-photo-' +
          uploadId +
          '/v1\\.jpg\\?expiresAt=1792281900&signature=[A-Za-z0-9_-]+$',
      ),
    );
    expect(grant.expiresAt).toEqual(expiresAt);
    expect(() =>
      storage.validateShortLivedReadGrant(reference, grant),
    ).not.toThrow();
  });

  it.each([
    'jpeg.jpg',
    'transparent.png',
    'static.webp',
    'portrait.heic',
    'portrait.heif',
  ])(
    'normalizes and serves a real %s Employee Photo only with a valid, live grant',
    async (fileName) => {
      const publicId = 'hams-employee-photo-' + uploadId;
      const source = await readFile(join(fixtureDirectory, fileName));
      const policy = imageUploadPolicy('EMPLOYEE_PHOTO');
      const evidence = await storage.receiveLocalUpload({
        publicId,
        stream: Readable.from([source]),
        policy,
        receivedAt: new Date(),
      });
      const verified = await storage.verifyUploadedObject({
        publicId,
        storageContext: context,
        deliveryType: 'authenticated',
        evidence,
        policy,
      });
      const reference = {
        publicId,
        storageContext: context,
        resourceType: 'image' as const,
        deliveryType: 'authenticated' as const,
        version: verified.version,
      };
      const grant = storage.createShortLivedReadGrant(
        reference,
        new Date(Date.now() + 5 * 60 * 1000),
      );

      const image = await storage.openPrivateEmployeePhoto(reference, grant);
      const chunks: Buffer[] = [];
      for await (const chunk of image.stream) {
        if (!(chunk instanceof Uint8Array)) {
          throw new Error(
            'The Employee Photo stream returned non-binary content',
          );
        }
        chunks.push(
          Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength),
        );
      }
      const output = Buffer.concat(chunks);
      const metadata = await sharp(output).metadata();

      expect(image.bytes).toBe(output.length);
      expect(metadata.format).toBe('jpeg');
      expect(metadata.width).toBeLessThanOrEqual(512);
      expect(metadata.height).toBeLessThanOrEqual(512);
      await expect(storage.openPublicAsset(reference)).rejects.toMatchObject({
        code: 'OBJECT_POLICY_REJECTED',
      });
      expect(() => storage.publicUrl(reference)).toThrow();

      const tamperedGrant = {
        ...grant,
        url: grant.url.replace(/signature=./, 'signature=x'),
      };
      await expect(
        storage.openPrivateEmployeePhoto(reference, tamperedGrant),
      ).rejects.toMatchObject({ code: 'OBJECT_POLICY_REJECTED' });

      const expiredGrant = storage.createShortLivedReadGrant(
        reference,
        new Date(Date.now() - 1000),
      );
      await expect(
        storage.openPrivateEmployeePhoto(reference, expiredGrant),
      ).rejects.toMatchObject({ code: 'OBJECT_POLICY_REJECTED' });
    },
    30_000,
  );

  it.each([
    'jpeg.jpg',
    'transparent.png',
    'static.webp',
    'portrait.heic',
    'portrait.heif',
  ])(
    'receives, verifies, stores, and serves a real %s Asset Image',
    async (name) => {
      const publicId = `hams-asset-image-${uploadId}`;
      const source = await readFile(join(fixtureDirectory, name));
      const policy = imageUploadPolicy('ASSET_IMAGE');
      const evidence = await storage.receiveLocalUpload({
        publicId,
        stream: Readable.from([source]),
        policy,
        receivedAt: new Date(),
      });
      const verified = await storage.verifyUploadedObject({
        publicId,
        storageContext: context,
        deliveryType: 'upload',
        evidence,
        policy,
      });
      const reference = {
        publicId,
        storageContext: context,
        resourceType: 'image' as const,
        deliveryType: 'upload' as const,
        version: verified.version,
      };
      const stored = await storage.openPublicAsset(reference);
      const chunks: Buffer[] = [];
      for await (const chunk of stored.stream) {
        if (!(chunk instanceof Uint8Array)) {
          throw new Error('The image stream returned a non-binary chunk');
        }
        chunks.push(
          Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength),
        );
      }
      const output = Buffer.concat(chunks);
      const metadata = await sharp(output).metadata();

      expect(verified).toMatchObject({
        publicId,
        version: 1,
        resourceType: 'image',
        deliveryType: 'upload',
        format: 'jpg',
        pages: 1,
      });
      expect(stored.bytes).toBe(output.length);
      expect(metadata.format).toBe('jpeg');
      expect(storage.publicUrl(reference)).toBe(
        `/api/images/assets/${publicId}/v1.jpg`,
      );
      await expect(
        stat(join(root, 'temp', publicId, 'source.upload')),
      ).rejects.toMatchObject({
        code: 'ENOENT',
      });
    },
    30_000,
  );

  it.each(['ASSET_IMAGE', 'EMPLOYEE_PHOTO'] as const)(
    'returns the same receipt after a lost %s upload response and retry',
    async (purpose) => {
      const prefix =
        purpose === 'ASSET_IMAGE' ? 'asset-image' : 'employee-photo';
      const publicId = `hams-${prefix}-${uploadId}`;
      const source = await readFile(join(fixtureDirectory, 'jpeg.jpg'));
      const input = {
        publicId,
        policy: imageUploadPolicy(purpose),
        receivedAt: new Date(),
      };
      const first = await storage.receiveLocalUpload({
        ...input,
        stream: Readable.from([source]),
      });
      const retry = await storage.receiveLocalUpload({
        ...input,
        stream: Readable.from([source]),
      });

      expect(retry).toEqual(first);
    },
  );

  it('uses the original receipt time when verification resumes from an existing output', async () => {
    const publicId = `hams-asset-image-${uploadId}`;
    const receivedAt = new Date('2026-10-18T12:00:00.000Z');
    const signatureExpiresAt = new Date(receivedAt.getTime() + 60_000);
    const source = await readFile(join(fixtureDirectory, 'jpeg.jpg'));
    const policy = imageUploadPolicy('ASSET_IMAGE');
    const evidence = await storage.receiveLocalUpload({
      publicId,
      stream: Readable.from([source]),
      policy,
      receivedAt,
    });
    const objectDirectory = join(root, 'images', publicId);
    const outputPath = join(objectDirectory, 'v1.jpg');
    await mkdir(objectDirectory, { recursive: true });
    await sharp(source).jpeg({ quality: 80 }).toFile(outputPath);
    const lateOutputTime = new Date(receivedAt.getTime() + 120_000);
    await utimes(outputPath, lateOutputTime, lateOutputTime);

    const verified = await storage.verifyUploadedObject({
      publicId,
      storageContext: context,
      deliveryType: 'upload',
      evidence,
      policy,
    });

    expect(verified.createdAt.getTime()).toBeLessThanOrEqual(
      signatureExpiresAt.getTime(),
    );
    expect(verified.createdAt.getTime()).toBe(
      (await stat(outputPath)).mtime.getTime(),
    );
  }, 30_000);

  it('rejects unsupported or oversized real content before making a public object', async () => {
    const policy = imageUploadPolicy('ASSET_IMAGE');
    const corruptPublicId = `hams-asset-image-${uploadId}`;
    const corrupt = await readFile(join(fixtureDirectory, 'corrupt.jpg'));
    const corruptEvidence = await storage.receiveLocalUpload({
      publicId: corruptPublicId,
      stream: Readable.from([corrupt]),
      policy,
      receivedAt: new Date(),
    });
    await expect(
      storage.verifyUploadedObject({
        publicId: corruptPublicId,
        storageContext: context,
        deliveryType: 'upload',
        evidence: corruptEvidence,
        policy,
      }),
    ).rejects.toMatchObject({ code: 'OBJECT_POLICY_REJECTED' });
    await expect(
      readdir(join(root, 'images', corruptPublicId)),
    ).resolves.toEqual([]);

    const oversizedPublicId =
      'hams-asset-image-7c2d6c4b-3b59-4c0a-9c67-7c011e6ed232';
    const oversized = await readFile(join(fixtureDirectory, 'oversized.jpg'));
    await expect(
      storage.receiveLocalUpload({
        publicId: oversizedPublicId,
        stream: Readable.from([oversized]),
        policy,
        receivedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'OBJECT_POLICY_REJECTED' });
  });

  it('keeps cleanup within one allocated image identity', async () => {
    const firstPublicId = `hams-asset-image-${uploadId}`;
    const secondPublicId =
      'hams-asset-image-7c2d6c4b-3b59-4c0a-9c67-7c011e6ed232';
    const policy = imageUploadPolicy('ASSET_IMAGE');
    const source = await readFile(join(fixtureDirectory, 'jpeg.jpg'));
    const firstEvidence = await storage.receiveLocalUpload({
      publicId: firstPublicId,
      stream: Readable.from([source]),
      policy,
      receivedAt: new Date(),
    });
    const secondEvidence = await storage.receiveLocalUpload({
      publicId: secondPublicId,
      stream: Readable.from([source]),
      policy,
      receivedAt: new Date(),
    });
    await storage.verifyUploadedObject({
      publicId: firstPublicId,
      storageContext: context,
      deliveryType: 'upload',
      evidence: firstEvidence,
      policy,
    });
    await storage.verifyUploadedObject({
      publicId: secondPublicId,
      storageContext: context,
      deliveryType: 'upload',
      evidence: secondEvidence,
      policy,
    });

    await storage.deleteAllocatedImageVariants({
      publicId: firstPublicId,
      storageContext: context,
    });

    await expect(
      storage.openPublicAsset({
        publicId: firstPublicId,
        storageContext: context,
        resourceType: 'image',
        deliveryType: 'upload',
        version: 1,
      }),
    ).rejects.toMatchObject({ code: 'OBJECT_NOT_FOUND' });
    const secondImage = await storage.openPublicAsset({
      publicId: secondPublicId,
      storageContext: context,
      resourceType: 'image',
      deliveryType: 'upload',
      version: 1,
    });
    expect(secondImage.bytes).toBeGreaterThan(0);
  }, 30_000);

  it('does not accept untrusted public identifiers as filesystem paths', async () => {
    await expect(
      storage.receiveLocalUpload({
        publicId: '../outside',
        stream: Readable.from([Buffer.from('not an image')]),
        policy: imageUploadPolicy('ASSET_IMAGE'),
        receivedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'OBJECT_POLICY_REJECTED' });

    const evidence: VerifyUploadedObjectInput['evidence'] = {
      publicId: `hams-asset-image-${uploadId}`,
      version: 1,
    };
    expect(() =>
      storage.fingerprintUploadEvidence('../outside', context, evidence),
    ).toThrow();
  });
});
