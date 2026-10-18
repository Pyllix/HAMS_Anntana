import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { Readable } from 'node:stream';
import { imageUploadPolicy } from './image-upload-policy';
import { IMAGE_STORAGE } from './image-storage.port';
import { LocalFilesystemStorageAdapter } from './local-filesystem-storage.adapter';
import { EmployeePhotoImagesController } from './employee-photo-images.controller';

const fixtureDirectory = join(
  __dirname,
  '../../test/fixtures/cloudinary-contract',
);
const uploadId = '8ec777e7-357b-4f1b-bc6b-343eeaa76903';
const readGrantSecret = 'employee-photo-controller-test-secret-0123456789';

function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

describe('EmployeePhotoImagesController', () => {
  let root: string;
  let app: INestApplication;
  let storage: LocalFilesystemStorageAdapter;
  let grant: ReturnType<
    LocalFilesystemStorageAdapter['createShortLivedReadGrant']
  >;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'hams-employee-photo-http-'));
    storage = new LocalFilesystemStorageAdapter(
      {
        provider: 'local',
        storageRoot: join(root, 'images'),
        tempRoot: join(root, 'temp'),
      },
      undefined,
      readGrantSecret,
    );
    const context = storage.getProviderContext();
    const publicId = 'hams-employee-photo-' + uploadId;
    const policy = imageUploadPolicy('EMPLOYEE_PHOTO');
    const source = await readFile(join(fixtureDirectory, 'jpeg.jpg'));
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
    grant = storage.createShortLivedReadGrant(
      reference,
      new Date(Date.now() + 5 * 60 * 1000),
    );

    const moduleFixture = await Test.createTestingModule({
      controllers: [EmployeePhotoImagesController],
      providers: [{ provide: IMAGE_STORAGE, useValue: storage }],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('serves normalized photo bytes over a no-store same-origin HTTP route', async () => {
    const response = await request(httpServer(app)).get(grant.url);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    const imageBytes: unknown = response.body;
    expect(Buffer.isBuffer(imageBytes)).toBe(true);
    if (!Buffer.isBuffer(imageBytes)) {
      throw new Error('Employee Photo response did not contain binary bytes');
    }
    expect(imageBytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  });

  it.each(['signature', 'expiry'])(
    'rejects an Employee Photo grant with a changed %s',
    async (part) => {
      let url = grant.url;
      if (part === 'signature') {
        url = url.replace(/signature=./, 'signature=x');
      } else {
        url = url.replace(
          /expiresAt=\d+/,
          `expiresAt=${Math.floor(Date.now() / 1000) - 1}`,
        );
      }

      const response = await request(httpServer(app)).get(url);

      expect(response.status).toBe(404);
      expect(response.headers['cache-control']).toBe('private, no-store');
    },
  );
});
