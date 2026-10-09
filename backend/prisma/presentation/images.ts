import type { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  PRESENTATION_MARKER,
  presentationId,
  type DemoAsset,
} from './fixtures';

// Public sample URLs already used by the original demo seed; no storage API calls.
const medicalPhotos = [
  'photo-1516549655169-df83a0774514',
  'photo-1584515979956-d9f6e5d09982',
  'photo-1576091160550-2173dba999ef',
  'photo-1530497610245-94d3c16cda28',
];
export function presentationAssetImageUrl(
  asset: Pick<DemoAsset, 'type' | 'model'>,
): string {
  const sample =
    asset.type === 'คอมพิวเตอร์และอุปกรณ์'
      ? 'photo-1517336714731-489689fd1ca8'
      : asset.type === 'เฟอร์นิเจอร์'
        ? 'photo-1519494026892-80bbd2d6fd0d'
        : asset.type === 'ยานพาหนะ'
          ? 'photo-1587745416684-47953f16f02f'
          : medicalPhotos[
              createHash('sha256').update(asset.model).digest()[0] %
                medicalPhotos.length
            ];
  return `https://images.unsplash.com/${sample}?auto=format&fit=crop&w=640&q=70`;
}

/** Fill blank presentation images only; preserve existing URLs and managed uploads. */
export async function attachPresentationSampleImages(
  prisma: PrismaClient,
  assets: DemoAsset[],
): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(90261009)`;
      const marker = await tx.company.findUnique({
        where: { code: PRESENTATION_MARKER },
      });
      if (marker?.id !== presentationId('marker'))
        throw new Error(
          'A completed presentation fixture is required before adding sample images',
        );
      let updated = 0;
      for (const asset of assets) {
        const result = await tx.asset.updateMany({
          where: {
            id: presentationId(`asset:${asset.key}`),
            imageUrl: '',
            imageStorageProvider: null,
            imageStorageAccountId: null,
            imagePublicId: null,
            imageResourceType: null,
            imageDeliveryType: null,
            imageVersion: null,
          },
          data: { imageUrl: presentationAssetImageUrl(asset) },
        });
        updated += result.count;
      }
      return updated;
    },
    { maxWait: 10000, timeout: 60000 },
  );
}
