import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { CloudinaryStorageAdapter } from '../src/images/cloudinary-storage.adapter';
import {
  type ImageObjectReference,
  type ImagePurpose,
  type UploadInstructionsInput,
  type UploadEvidence,
  type VerifiedImageObject,
} from '../src/images/image-storage.port';
import { imageUploadPolicy } from '../src/images/image-upload-policy';

const runContract = process.env.RUN_CLOUDINARY_CONTRACTS === 'true';
const cloudinaryDescribe = runContract ? describe : describe.skip;
const adapter = new CloudinaryStorageAdapter();
const fixtureSpecs = [
  { name: 'jpeg.jpg', mime: 'image/jpeg', purpose: 'ASSET_IMAGE' },
  { name: 'jpeg.jpg', mime: 'image/jpeg', purpose: 'EMPLOYEE_PHOTO' },
  { name: 'transparent.png', mime: 'image/png', purpose: 'ASSET_IMAGE' },
  { name: 'static.webp', mime: 'image/webp', purpose: 'ASSET_IMAGE' },
  { name: 'portrait.heic', mime: 'image/heic', purpose: 'EMPLOYEE_PHOTO' },
  { name: 'portrait.heif', mime: 'image/heif', purpose: 'EMPLOYEE_PHOTO' },
] as const satisfies ReadonlyArray<{
  name: string;
  mime: string;
  purpose: ImagePurpose;
}>;
const rejectedFixtureNames = [
  'animated.webp',
  'corrupt.jpg',
  'unsupported.gif',
  'oversized.jpg',
  'large-pixel.png',
] as const;
const normalizationFixtures = [
  { name: 'rotated.jpg', mime: 'image/jpeg' },
  { name: 'mirrored.jpg', mime: 'image/jpeg' },
  { name: 'camera-gps-metadata.jpg', mime: 'image/jpeg' },
  { name: 'semi-transparent.png', mime: 'image/png' },
  { name: 'color-profile.jpg', mime: 'image/jpeg' },
  { name: 'small.jpg', mime: 'image/jpeg' },
  { name: 'large-landscape.jpg', mime: 'image/jpeg' },
  { name: 'large-portrait.jpg', mime: 'image/jpeg' },
] as const;

cloudinaryDescribe(
  'Cloudinary image storage contract (explicit opt-in)',
  () => {
    const createdObjects: ImageObjectReference[] = [];
    const savedEnvironment = new Map<string, string | undefined>();
    let fixtureDirectory: string;
    let cloudName: string;
    let storageContext: ReturnType<
      CloudinaryStorageAdapter['getProviderContext']
    >;

    beforeAll(async () => {
      for (const name of [
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
      ]) {
        savedEnvironment.set(name, process.env[name]);
      }
      for (const name of [
        'CLOUDINARY_CONTRACT_CLOUD_NAME',
        'CLOUDINARY_CONTRACT_API_KEY',
        'CLOUDINARY_CONTRACT_API_SECRET',
        'CLOUDINARY_CONTRACT_FIXTURE_DIR',
      ]) {
        const value = process.env[name];
        if (!value)
          throw new Error(`${name} is required when real tests are enabled`);
        savedEnvironment.set(name, value);
      }
      fixtureDirectory = resolve(
        process.env.CLOUDINARY_CONTRACT_FIXTURE_DIR as string,
      );
      cloudName = process.env.CLOUDINARY_CONTRACT_CLOUD_NAME as string;
      if (
        savedEnvironment.get('CLOUDINARY_CLOUD_NAME')?.trim() ===
        cloudName.trim()
      ) {
        throw new Error(
          'Real Cloudinary contract tests require a separate test-only cloud account',
        );
      }
      process.env.CLOUDINARY_CLOUD_NAME = cloudName;
      process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_CONTRACT_API_KEY;
      process.env.CLOUDINARY_API_SECRET =
        process.env.CLOUDINARY_CONTRACT_API_SECRET;
      storageContext = adapter.getProviderContext();

      const requiredFiles = [
        ...fixtureSpecs.map((fixture) => fixture.name),
        ...rejectedFixtureNames,
        ...normalizationFixtures.map((fixture) => fixture.name),
      ];
      const missingFiles: string[] = [];
      for (const name of requiredFiles) {
        try {
          await stat(join(fixtureDirectory, name));
        } catch {
          missingFiles.push(name);
        }
      }
      if (missingFiles.length) {
        throw new Error(
          `The synthetic Cloudinary fixture set is incomplete (${missingFiles.length} files missing)`,
        );
      }
    }, 30_000);

    afterAll(async () => {
      const failures: ImageObjectReference[] = [];
      // Keep test teardown bounded without bursting the provider Admin API.
      for (const reference of createdObjects) {
        let deleted = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await adapter.deleteObject(reference);
            deleted = true;
            break;
          } catch {
            if (attempt < 2) await new Promise((done) => setTimeout(done, 500));
          }
        }
        if (!deleted) failures.push(reference);
      }
      for (const name of [
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
        'CLOUDINARY_CONTRACT_CLOUD_NAME',
        'CLOUDINARY_CONTRACT_API_KEY',
        'CLOUDINARY_CONTRACT_API_SECRET',
        'CLOUDINARY_CONTRACT_FIXTURE_DIR',
      ]) {
        const saved = savedEnvironment.get(name);
        if (saved === undefined) delete process.env[name];
        else process.env[name] = saved;
      }
      if (failures.length) {
        throw new Error(
          `Cloudinary cleanup failed for ${failures.length} test-scoped object(s); inspect only the recorded test prefix`,
        );
      }
    }, 120_000);

    it.each(fixtureSpecs)(
      'accepts $name only after provider-side normalization and trusted verification',
      async (fixture) => {
        const uploaded = await uploadFixture(
          fixture.name,
          fixture.mime,
          fixture.purpose,
        );
        const verified = await verifyUploaded(uploaded);
        expect(verified).toMatchObject({
          publicId: uploaded.publicId,
          resourceType: 'image',
          deliveryType:
            fixture.purpose === 'ASSET_IMAGE' ? 'upload' : 'authenticated',
          format: 'jpg',
          pages: 1,
        });
        expect(Math.max(verified.width, verified.height)).toBeLessThanOrEqual(
          fixture.purpose === 'ASSET_IMAGE' ? 1600 : 512,
        );

        if (fixture.purpose === 'ASSET_IMAGE') {
          const imageResponse = await fetch(
            adapter.publicUrl({
              publicId: verified.publicId,
              storageContext,
              resourceType: 'image',
              deliveryType: 'upload',
              version: verified.version,
            }),
            { cache: 'no-store' },
          );
          expect(imageResponse.status).toBe(200);
          expect(imageResponse.headers.get('content-type')).toMatch(
            /image\/jpeg/i,
          );
          const bytes = new Uint8Array(await imageResponse.arrayBuffer());
          expect(bytes[0]).toBe(0xff);
          expect(bytes[1]).toBe(0xd8);
          await expectNormalizedOutput(
            fixture.name,
            Buffer.from(bytes),
            verified,
          );
        } else {
          const unsignedUrl = `https://res.cloudinary.com/${cloudName}/image/authenticated/v${verified.version}/${verified.publicId}.jpg`;
          const anonymous = await fetch(unsignedUrl, { cache: 'no-store' });
          expect(anonymous.ok).toBe(false);
          const publicAlias = `https://res.cloudinary.com/${cloudName}/image/upload/v${verified.version}/${verified.publicId}.jpg`;
          const publicResponse = await fetch(publicAlias, {
            cache: 'no-store',
          });
          expect(publicResponse.ok).toBe(false);
          const grant = adapter.createShortLivedReadGrant(
            {
              publicId: verified.publicId,
              storageContext,
              resourceType: 'image',
              deliveryType: 'authenticated',
              version: verified.version,
            },
            new Date(Date.now() + 5 * 60 * 1000),
          );
          const granted = await fetch(grant.url, { cache: 'no-store' });
          expect(granted.status).toBe(200);
          expect(granted.headers.get('content-type')).toMatch(/image\/jpeg/i);
          const output = Buffer.from(await granted.arrayBuffer());
          const metadata = await sharp(output).metadata();
          expect(metadata.format).toBe('jpeg');
          expect(metadata.hasAlpha).toBe(false);
          expect(metadata.exif).toBeUndefined();
        }
      },
      60_000,
    );

    it.each(normalizationFixtures)(
      'preserves normalized pixels and strips capture metadata for $name',
      async (fixture) => {
        const uploaded = await uploadFixture(
          fixture.name,
          fixture.mime,
          'ASSET_IMAGE',
        );
        const verified = await verifyUploaded(uploaded);
        const response = await fetch(
          adapter.publicUrl({
            publicId: verified.publicId,
            storageContext,
            resourceType: 'image',
            deliveryType: 'upload',
            version: verified.version,
          }),
          { cache: 'no-store' },
        );
        expect(response.status).toBe(200);
        await expectNormalizedOutput(
          fixture.name,
          Buffer.from(await response.arrayBuffer()),
          verified,
        );
      },
      60_000,
    );

    it.each(rejectedFixtureNames)(
      'rejects disallowed source fixture %s before it becomes an image object',
      async (fixtureName) => {
        const mime = fixtureName.endsWith('.webp')
          ? 'image/webp'
          : fixtureName.endsWith('.gif')
            ? 'image/gif'
            : fixtureName.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';
        const allocated = allocateInstructions('ASSET_IMAGE');
        const bytes = await readFile(join(fixtureDirectory, fixtureName));
        if (fixtureName === 'oversized.jpg') {
          expect(bytes.length).toBeGreaterThan(
            imageUploadPolicy('ASSET_IMAGE').maxSourceBytes,
          );
          expect(bytes.length).toBeLessThan(10_485_760);
        }
        if (fixtureName === 'large-pixel.png') {
          const metadata = await sharp(bytes).metadata();
          expect(
            (metadata.width ?? 0) * (metadata.height ?? 0),
          ).toBeGreaterThan(imageUploadPolicy('ASSET_IMAGE').maxSourcePixels);
        }
        const body = new FormData();
        for (const [key, value] of Object.entries(
          allocated.instructions.fields,
        )) {
          body.append(key, value);
        }
        body.append('file', new Blob([bytes], { type: mime }), fixtureName);
        const response = await fetch(allocated.instructions.url, {
          method: allocated.instructions.method,
          body,
          signal: AbortSignal.timeout(90_000),
        });
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      },
      120_000,
    );

    it.each(['jpeg.jpg', 'jpeg'])(
      'never verifies a raw-only upload with filename %s',
      async (filename) => {
        const allocated = allocateInstructions('ASSET_IMAGE');
        const bytes = await readFile(join(fixtureDirectory, 'jpeg.jpg'));
        const body = new FormData();
        for (const [key, value] of Object.entries(
          allocated.instructions.fields,
        )) {
          body.append(key, value);
        }
        body.append(
          'file',
          new Blob([bytes], { type: 'image/jpeg' }),
          filename,
        );
        const rawUrl = allocated.instructions.url.replace(
          '/image/upload',
          '/raw/upload',
        );
        const response = await fetch(rawUrl, { method: 'POST', body });
        // Cloudinary excludes resource_type from upload signatures. HAMS must
        // verify the allocated image namespace, never trust the upload response alone.
        expect(response.status).toBe(200);
        const evidence = await responseEvidence(response);
        await expect(
          adapter.verifyUploadedObject({
            publicId: allocated.publicId,
            storageContext,
            deliveryType: 'upload',
            policy: imageUploadPolicy('ASSET_IMAGE'),
            evidence,
          }),
        ).rejects.toMatchObject({
          code: filename === 'jpeg' ? 'OBJECT_NOT_FOUND' : 'EVIDENCE_INVALID',
        });
      },
      60_000,
    );

    it('rejects changing the signed employee delivery type to public', async () => {
      const allocated = allocateInstructions('EMPLOYEE_PHOTO');
      const bytes = await readFile(join(fixtureDirectory, 'jpeg.jpg'));
      const body = new FormData();
      for (const [key, value] of Object.entries(
        allocated.instructions.fields,
      )) {
        body.append(key, key === 'type' ? 'upload' : value);
      }
      body.append(
        'file',
        new Blob([bytes], { type: 'image/jpeg' }),
        'jpeg.jpg',
      );
      const response = await fetch(allocated.instructions.url, {
        method: 'POST',
        body,
      });
      if (response.ok) await responseEvidence(response);
      expect(response.status).toBe(401);
    }, 60_000);

    it('checks the source MIME is not treated as authoritative', async () => {
      const allocated = allocateInstructions('ASSET_IMAGE');
      const bytes = await readFile(join(fixtureDirectory, 'transparent.png'));
      const body = new FormData();
      for (const [key, value] of Object.entries(
        allocated.instructions.fields,
      )) {
        body.append(key, value);
      }
      body.append(
        'file',
        new Blob([bytes], { type: 'image/jpeg' }),
        'lied.jpg',
      );
      const response = await fetch(allocated.instructions.url, {
        method: 'POST',
        body,
      });
      expect(response.ok).toBe(true);
      const evidence = await responseEvidence(response);
      const verified = await adapter.verifyUploadedObject({
        publicId: allocated.publicId,
        storageContext,
        deliveryType: 'upload',
        evidence,
        policy: imageUploadPolicy('ASSET_IMAGE'),
      });
      expect(verified.format).toBe('jpg');
    }, 60_000);

    async function expectNormalizedOutput(
      fixtureName: string,
      output: Buffer,
      verified: VerifiedImageObject,
    ): Promise<void> {
      const source = await readFile(join(fixtureDirectory, fixtureName));
      const sourceMetadata = await sharp(source).metadata();
      const outputMetadata = await sharp(output).metadata();
      expect(outputMetadata.format).toBe('jpeg');
      expect(outputMetadata.hasAlpha).toBe(false);
      expect(outputMetadata.exif).toBeUndefined();
      expect(outputMetadata.iptc).toBeUndefined();
      expect(outputMetadata.xmp).toBeUndefined();
      expect(outputMetadata.width).toBe(verified.width);
      expect(outputMetadata.height).toBe(verified.height);
      expect(Math.max(verified.width, verified.height)).toBeLessThanOrEqual(
        imageUploadPolicy('ASSET_IMAGE').maxEdge,
      );

      if (fixtureName === 'rotated.jpg') {
        expect([5, 6, 7, 8]).toContain(sourceMetadata.orientation);
      }
      if (fixtureName === 'mirrored.jpg') {
        expect([2, 4, 5, 7]).toContain(sourceMetadata.orientation);
      }
      if (fixtureName === 'camera-gps-metadata.jpg') {
        expect(sourceMetadata.exif?.length).toBeGreaterThan(0);
      }
      if (fixtureName === 'color-profile.jpg') {
        expect(sourceMetadata.icc?.length).toBeGreaterThan(0);
      }
      if (fixtureName === 'semi-transparent.png') {
        expect(sourceMetadata.hasAlpha).toBe(true);
        const alphaPixels = await sharp(source)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const alphaChannel = alphaPixels.info.channels - 1;
        let hasPartialAlpha = false;
        for (
          let pixel = alphaChannel;
          pixel < alphaPixels.data.length;
          pixel += alphaPixels.info.channels
        ) {
          if (alphaPixels.data[pixel] > 0 && alphaPixels.data[pixel] < 255) {
            hasPartialAlpha = true;
            break;
          }
        }
        expect(hasPartialAlpha).toBe(true);
      }
      if (fixtureName === 'small.jpg') {
        expect(
          Math.max(sourceMetadata.width ?? 0, sourceMetadata.height ?? 0),
        ).toBeLessThan(1600);
      }
      if (fixtureName === 'large-landscape.jpg') {
        expect(sourceMetadata.width).toBeGreaterThan(
          sourceMetadata.height ?? 0,
        );
        expect(sourceMetadata.width).toBeGreaterThan(1600);
      }
      if (fixtureName === 'large-portrait.jpg') {
        expect(sourceMetadata.height).toBeGreaterThan(
          sourceMetadata.width ?? 0,
        );
        expect(sourceMetadata.height).toBeGreaterThan(1600);
      }

      const expected = await sharp(source)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .toColourspace('srgb')
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const observed = await sharp(output)
        .toColourspace('srgb')
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(observed.info.width).toBe(expected.info.width);
      expect(observed.info.height).toBe(expected.info.height);
      expect(observed.info.channels).toBe(3);
      expect(expected.info.channels).toBe(3);
      let absoluteDifference = 0;
      for (let index = 0; index < observed.data.length; index += 1) {
        absoluteDifference += Math.abs(
          observed.data[index] - expected.data[index],
        );
      }
      // Synthetic fixtures use broad, asymmetric color regions so JPEG quality
      // differences do not mask orientation, mirroring, alpha, or color errors.
      expect(absoluteDifference / observed.data.length).toBeLessThan(20);
    }

    async function uploadFixture(
      fixtureName: string,
      mime: string,
      purpose: ImagePurpose,
    ): Promise<{
      publicId: string;
      purpose: ImagePurpose;
      deliveryType: 'upload' | 'authenticated';
      policy: ReturnType<typeof imageUploadPolicy>;
      evidence: UploadEvidence;
    }> {
      const allocated = allocateInstructions(purpose);
      const bytes = await readFile(join(fixtureDirectory, fixtureName));
      const body = new FormData();
      for (const [key, value] of Object.entries(
        allocated.instructions.fields,
      )) {
        body.append(key, value);
      }
      body.append('file', new Blob([bytes], { type: mime }), fixtureName);
      const response = await fetch(allocated.instructions.url, {
        method: allocated.instructions.method,
        body,
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        throw new Error(
          `Cloudinary rejected accepted fixture ${fixtureName}: HTTP ${response.status}`,
        );
      }
      const evidence = await responseEvidence(response);
      return {
        publicId: allocated.publicId,
        purpose,
        deliveryType: purpose === 'ASSET_IMAGE' ? 'upload' : 'authenticated',
        policy: imageUploadPolicy(purpose),
        evidence,
      };
    }

    function allocateInstructions(purpose: ImagePurpose): {
      publicId: string;
      instructions: Awaited<
        ReturnType<CloudinaryStorageAdapter['createUploadInstructions']>
      >;
    } {
      const now = new Date();
      const publicId = `hams-contract-${randomUUID()}`;
      const reference: ImageObjectReference = {
        publicId,
        storageContext,
        resourceType: 'image',
        deliveryType: purpose === 'ASSET_IMAGE' ? 'upload' : 'authenticated',
      };
      createdObjects.push(reference);
      const policy = imageUploadPolicy(purpose);
      const instructionsInput: UploadInstructionsInput = {
        purpose,
        publicId,
        storageContext,
        deliveryType: reference.deliveryType,
        policy,
        issuedAt: now,
        signatureExpiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      };
      return {
        publicId,
        instructions: adapter.createUploadInstructions(instructionsInput),
      };
    }

    async function verifyUploaded(uploaded: {
      publicId: string;
      deliveryType: 'upload' | 'authenticated';
      evidence: UploadEvidence;
      policy: ReturnType<typeof imageUploadPolicy>;
    }): Promise<VerifiedImageObject> {
      return adapter.verifyUploadedObject({
        publicId: uploaded.publicId,
        storageContext,
        deliveryType: uploaded.deliveryType,
        evidence: uploaded.evidence,
        policy: uploaded.policy,
      });
    }

    async function responseEvidence(
      response: Response,
    ): Promise<UploadEvidence> {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (
        !isRecord(payload) ||
        typeof payload.public_id !== 'string' ||
        typeof payload.version !== 'number' ||
        typeof payload.signature !== 'string'
      ) {
        throw new Error(
          'Cloudinary upload response did not contain verifiable evidence',
        );
      }
      expect(payload.public_id).toMatch(/^hams-contract-/);
      if (
        ['image', 'raw', 'video'].includes(String(payload.resource_type)) &&
        ['upload', 'authenticated'].includes(String(payload.type)) &&
        !createdObjects.some(
          (reference) =>
            reference.publicId === payload.public_id &&
            reference.resourceType === payload.resource_type &&
            reference.deliveryType === payload.type,
        )
      ) {
        createdObjects.push({
          publicId: payload.public_id,
          storageContext,
          resourceType: payload.resource_type as 'image' | 'raw' | 'video',
          deliveryType: payload.type as 'upload' | 'authenticated',
        });
      }
      return {
        publicId: payload.public_id,
        version: payload.version,
        signature: payload.signature,
      };
    }
  },
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
