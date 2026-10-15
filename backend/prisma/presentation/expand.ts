import type { PrismaClient } from '@prisma/client';
import {
  presentationId,
  validateFixture,
  type PresentationFixture,
} from './fixtures';
import { isExpandedScenario } from './scenarios';
import {
  readPresentationManifest,
  type PresentationManifest,
  type ManifestRow,
} from './seed';
import { writePresentationRecords } from './records';
import { assetLabels, partLabels } from './labels';

export function presentationExpansionDelta(
  fixture: PresentationFixture,
  manifest: PresentationManifest,
): PresentationFixture {
  const missing = (kind: ManifestRow['kind'], key: string) =>
    isExpandedScenario(key) &&
    !manifest.rows.some((row) => row.kind === kind && row.key === key);
  const repairs = fixture.repairs.filter((row) => missing('repair', row.key));
  return {
    ...fixture,
    assets: fixture.assets.filter((row) => missing('asset', row.key)),
    borrows: fixture.borrows.filter((row) => missing('borrow', row.key)),
    extensions: fixture.extensions.filter((row) =>
      missing('extension', row.key),
    ),
    repairs,
    parts: fixture.parts.filter((row) => missing('part', row.key)),
    txns: fixture.txns.filter((row) =>
      repairs.some((job) => job.key === row.job),
    ),
    transfers: fixture.transfers.filter((row) => missing('transfer', row.key)),
    disposals: fixture.disposals.filter((row) => missing('disposal', row.key)),
    notifications: fixture.notifications.filter((row) =>
      missing('notification', row.key),
    ),
  };
}

/** Append missing scenarios atomically. Existing workflows, credentials and stock are untouched. */
export async function extendPresentationScenarios(
  prisma: PrismaClient,
  fixture: PresentationFixture,
): Promise<{ manifest: PresentationManifest; added: Record<string, number> }> {
  validateFixture(fixture);
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(90261009)`;
      const manifest = await readPresentationManifest(tx);
      if (!manifest)
        throw new Error(
          'Seed the presentation data before expanding scenarios',
        );
      const delta = presentationExpansionDelta(fixture, manifest);
      const kinds = [
        'assets',
        'borrows',
        'extensions',
        'repairs',
        'parts',
        'txns',
        'transfers',
        'disposals',
        'notifications',
      ] as const;
      const added = Object.fromEntries(
        kinds.map((kind) => [kind, delta[kind].length]),
      );
      if (!Object.values(added).some(Boolean)) return { manifest, added };
      const referenced = new Set([
        'admin',
        'head',
        'center',
        'parcel',
        'tech-a',
        ...delta.repairs.flatMap((job) => [job.reporter, ...job.technicians]),
        ...delta.borrows.map((loan) => loan.borrower),
        ...delta.notifications.map((row) => row.user),
      ]);
      const requiredUsers = fixture.users.filter((user) =>
        referenced.has(user.key),
      );
      for (const user of requiredUsers)
        if (
          !manifest.rows.some(
            (row) => row.kind === 'user' && row.key === user.key,
          )
        )
          throw new Error(`Missing presentation user: ${user.key}`);
      const assetCodes = delta.assets.map((asset, index) =>
        assetLabels(asset, asset.labelIndex ?? index),
      );
      const conflicts = await Promise.all([
        tx.asset.count({
          where: {
            OR: [
              {
                id: {
                  in: delta.assets.map((row) =>
                    presentationId(`asset:${row.key}`),
                  ),
                },
              },
              { serialNo: { in: assetCodes.map((row) => row.serialNo) } },
              { noid: { in: assetCodes.map((row) => row.noid) } },
            ],
          },
        }),
        tx.repairJob.count({
          where: {
            id: {
              in: delta.repairs.map((row) =>
                presentationId(`repair:${row.key}`),
              ),
            },
          },
        }),
        tx.borrowTransaction.count({
          where: {
            id: {
              in: delta.borrows.map((row) =>
                presentationId(`borrow:${row.key}`),
              ),
            },
          },
        }),
        tx.borrowExtension.count({
          where: {
            id: {
              in: delta.extensions.map((row) =>
                presentationId(`extension:${row.key}`),
              ),
            },
          },
        }),
        tx.sparepart.count({
          where: {
            code: { in: delta.parts.map((row) => partLabels[row.key].code) },
          },
        }),
        tx.notification.count({
          where: {
            id: {
              in: delta.notifications.map((row) =>
                presentationId(`notification:${row.key}`),
              ),
            },
          },
        }),
      ]);
      if (conflicts.some(Boolean))
        throw new Error(
          'New scenario identity conflicts with an existing record; no data was changed',
        );
      await writePresentationRecords(tx, delta, manifest);
      manifest.expansionDate ??= fixture.date.toISOString().slice(0, 10);
      await tx.company.update({
        where: { id: presentationId('marker') },
        data: { remark: JSON.stringify(manifest) },
      });
      return { manifest, added };
    },
    { isolationLevel: 'Serializable', maxWait: 10000, timeout: 300000 },
  );
}
