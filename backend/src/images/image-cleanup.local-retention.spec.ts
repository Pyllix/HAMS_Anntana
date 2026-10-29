import { ImageCleanupService } from './image-cleanup.service';
import type { PrismaService } from '../prisma.service';
import type { ImageStoragePort } from './image-storage.port';

describe('ImageCleanupService with local storage', () => {
  it('retains a local file when an Asset still references its storage identity', async () => {
    const cleanup = {
      id: 'cleanup-1',
      uploadId: null,
      storageProvider: 'local',
      storageAccountId: 'hams-local-image-store-v1',
      publicId: 'hams-asset-image-c4c51a2e-3c27-4e68-9954-0c7c03b1564b',
      resourceType: 'image',
      deliveryType: 'upload',
      version: 1,
      attemptCount: 0,
    };
    const transactionQueryRaw = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: cleanup.id }]);
    type CleanupUpdate = {
      where: { id: string };
      data: { status: string; lastErrorCode: string; leaseToken?: null };
    };
    const cleanupUpdate = jest.fn<void, [CleanupUpdate]>();
    const transaction = {
      $queryRaw: transactionQueryRaw,
      imageCleanup: {
        findUnique: jest.fn().mockResolvedValue(cleanup),
        update: cleanupUpdate,
      },
      asset: { findFirst: jest.fn().mockResolvedValue({ id: 'active-asset' }) },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      imageUpload: { findUnique: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(transaction),
      ),
      $queryRaw: jest.fn().mockResolvedValue([{ id: cleanup.id }]),
      imageCleanup: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const deleteAllocatedImageVariants = jest.fn();
    const storage = {
      getProviderContext: jest.fn(() => ({
        provider: 'local',
        accountId: 'hams-local-image-store-v1',
      })),
      deleteAllocatedImageVariants,
    };
    const service = new ImageCleanupService(
      prisma as unknown as PrismaService,
      storage as unknown as ImageStoragePort,
      { now: () => new Date('2026-10-18T12:00:00.000Z') },
    );

    const result = await service.runSweepOnce();

    expect(result.retained).toBe(1);
    expect(result.attemptedObjects).toBe(0);
    expect(deleteAllocatedImageVariants).not.toHaveBeenCalled();
    expect(cleanupUpdate).toHaveBeenCalledTimes(1);
    const update = cleanupUpdate.mock.calls[0]?.[0];
    expect(update?.where).toEqual({ id: cleanup.id });
    expect(update?.data.status).toBe('RETAINED');
    expect(update?.data.lastErrorCode).toBe('RETAINED_REFERENCE');
  });
});
