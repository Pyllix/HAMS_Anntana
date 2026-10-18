import { ImageUploadStatus, UserRole } from '@prisma/client';
import { Readable } from 'node:stream';
import type { PrismaService } from '../prisma.service';
import type { ImageReadService } from './image-read.service';
import type {
  ImageStoragePort,
  LocalImageStoragePort,
  UploadEvidence,
} from './image-storage.port';
import { ImageUploadService } from './image-upload.service';

const uploadId = 'c4c51a2e-3c27-4e68-9954-0c7c03b1564b';
const userId = 'user-1';
const now = new Date('2026-10-18T12:00:00.000Z');
const storageContext = {
  provider: 'local',
  accountId: 'hams-local-image-store-v1',
};

describe('ImageUploadService local byte receipt', () => {
  function createHarness(signatureExpiresAt: Date, intentExpiresAt: Date) {
    const upload = {
      id: uploadId,
      uploaderId: userId,
      purpose: 'ASSET_IMAGE',
      status: ImageUploadStatus.AUTHORIZED,
      publicId: `hams-asset-image-${uploadId}`,
      storageProvider: storageContext.provider,
      storageAccountId: storageContext.accountId,
      signatureExpiresAt,
      intentExpiresAt,
    };
    const findFirst = jest.fn().mockResolvedValue(upload);
    const localUploadCalls: Array<
      Parameters<LocalImageStoragePort['receiveLocalUpload']>[0]
    > = [];
    const receiveLocalUpload = jest.fn(
      (
        input: Parameters<LocalImageStoragePort['receiveLocalUpload']>[0],
      ): Promise<UploadEvidence> => {
        localUploadCalls.push(input);
        return Promise.resolve({
          publicId: upload.publicId,
          version: 1,
          sourceBytes: 10,
        });
      },
    );
    const storage = {
      getProviderContext: jest.fn(() => storageContext),
      receiveLocalUpload,
      openPublicAsset: jest.fn(),
      openPrivateEmployeePhoto: jest.fn(),
    };
    const prisma = { imageUpload: { findFirst } };
    const service = new ImageUploadService(
      prisma as unknown as PrismaService,
      storage as unknown as ImageStoragePort,
      { now: () => now },
      {} as ImageReadService,
    );
    return { service, receiveLocalUpload, localUploadCalls };
  }

  it('rejects a new byte upload after the advertised signature expiry', async () => {
    const { service, receiveLocalUpload } = createHarness(
      new Date(now.getTime() - 1),
      new Date(now.getTime() + 60_000),
    );

    await expect(
      service.receiveLocalUpload(
        { userId, role: UserRole.ADMIN },
        uploadId,
        Readable.from([Buffer.from('image bytes')]),
      ),
    ).rejects.toMatchObject({
      status: 410,
      response: { code: 'UPLOAD_EXPIRED' },
    });
    expect(receiveLocalUpload).not.toHaveBeenCalled();
  });

  it('receives bytes while both the signature and intent are active', async () => {
    const { service, receiveLocalUpload, localUploadCalls } = createHarness(
      new Date(now.getTime() + 60_000),
      new Date(now.getTime() + 120_000),
    );
    const bytes = Buffer.from('image bytes');
    const stream = Readable.from([bytes]);

    await expect(
      service.receiveLocalUpload(
        { userId, role: UserRole.ADMIN },
        uploadId,
        stream,
      ),
    ).resolves.toEqual({
      publicId: `hams-asset-image-${uploadId}`,
      version: 1,
      sourceBytes: 10,
    });
    expect(receiveLocalUpload).toHaveBeenCalledTimes(1);
    expect(localUploadCalls[0].publicId).toBe(`hams-asset-image-${uploadId}`);
    expect(localUploadCalls[0].stream).toBe(stream);
    expect(localUploadCalls[0].policy.maxEdge).toBe(1600);
    expect(localUploadCalls[0].receivedAt).toBe(now);
  });
});
