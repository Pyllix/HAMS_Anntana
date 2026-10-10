import type { PrismaClient } from '@prisma/client';
import { originalSections } from '../demo-identities';
import { PRESENTATION_MARKER, presentationId } from './fixtures';
import { sectionLabels } from './labels';

export function presentationSectionData(key: string) {
  return {
    id: presentationId(`section:${key}`),
    ...sectionLabels(key),
  };
}

/** Keep the existing section ID so asset/user/history foreign keys stay intact. */
export async function repairPresentationCenterSection(prisma: PrismaClient) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(90261009)`;
      const marker = await tx.company.findUnique({
        where: { code: PRESENTATION_MARKER },
      });
      if (marker?.id !== presentationId('marker'))
        throw new Error(
          'A completed presentation fixture is required before repairing its center section',
        );
      const id = presentationId('section:CENTER');
      const center = await tx.section.findUnique({ where: { id } });
      if (!center || center.deletedAt)
        throw new Error('Presentation center section is missing or deleted');
      const existingCenter = await tx.section.findUnique({
        where: { code: 'CENTER' },
      });
      if (existingCenter && existingCenter.id !== id)
        throw new Error(
          'CENTER belongs to another section; inspect it before changing presentation data',
        );
      if (center.code === 'CENTER') return { updated: false, id };
      if (center.code !== 'PRESENT-CENTER')
        throw new Error(
          'Presentation center has an unexpected code; no section was changed',
        );
      await tx.section.update({
        where: { id },
        data: {
          code: 'CENTER',
          name: originalSections.find((section) => section.code === 'CENTER')!
            .name,
        },
      });
      return { updated: true, id };
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
