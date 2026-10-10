import { Prisma, type PrismaClient } from '@prisma/client';
import { documentLabel, partLabels } from './labels';
import {
  presentationId,
  type DemoPart,
  type PresentationFixture,
} from './fixtures';
import { readPresentationManifest, type PresentationManifest } from './seed';

/** Two receipt lots; the existing repair fixtures retain their older opening dates. */
export function partReceiptPlan(part: DemoPart, index: number, date: Date) {
  const first = Math.max(1, Math.floor(part.opening * 0.8));
  return [first, part.opening - first]
    .map((qty, lot) => {
      const when = new Date(
        date.getTime() -
          (index < 5 ? 650 - lot * 20 : 45 - lot * 38) * 86_400_000,
      );
      return {
        qty,
        date: when,
        totalPrice: qty * part.price,
        document: documentLabel('STK', when, index * 2 + lot),
      };
    })
    .filter((receipt) => receipt.qty > 0 && part.opening > 0);
}

/** Same stock-in writes as the application: zero stock, receipt history, then increment. */
export async function createPartWithReceipts(
  tx: Prisma.TransactionClient,
  part: DemoPart,
  index: number,
  date: Date,
  groupId: number,
  actorId: string,
) {
  const receipts = partReceiptPlan(part, index, date);
  const createdAt = receipts[0]?.date ?? date;
  const result = await tx.sparepart.create({
    data: {
      ...partLabels[part.key],
      unit: part.unit ?? 'ชิ้น',
      price: part.price,
      minStock: part.minStock,
      qtyInStock: 0,
      groupId,
      createdAt,
      updatedAt: createdAt,
    },
  });
  for (const receipt of receipts) {
    await tx.sparepartAdd.create({
      data: {
        sparepartId: result.id,
        qty: receipt.qty,
        totalPrice: receipt.totalPrice,
        sparepartAddDoc: receipt.document,
        addBy: actorId,
        createdAt: receipt.date,
        updatedAt: receipt.date,
      },
    });
    await tx.sparepart.update({
      where: { id: result.id },
      data: {
        qtyInStock: { increment: receipt.qty },
        updatedAt: receipt.date,
      },
    });
  }
  return { ...result, qtyInStock: part.opening };
}

/** Extend old presentation sets without rewinding an existing part or repair. */
export async function extendPresentationParts(
  prisma: PrismaClient,
  fixture: PresentationFixture,
): Promise<{ manifest: PresentationManifest; added: number }> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(90261009)`;
      const manifest = await readPresentationManifest(tx);
      if (!manifest)
        throw new Error('Seed presentation data before extending spare parts');
      const missing = fixture.parts
        .map((part, index) => ({ part, index }))
        .filter(
          ({ part }) =>
            !manifest.rows.some(
              (row) => row.kind === 'part' && row.key === part.key,
            ),
        );
      if (!missing.length) return { manifest, added: 0 };
      // This extension only adds receipt-backed catalog items, never rewrites repair history.
      if (
        missing.some(({ part }) =>
          fixture.txns.some((txn) => txn.part === part.key),
        )
      )
        throw new Error(
          'A missing repair-linked part needs inspection before extending stock',
        );
      const actorId = manifest.rows.find(
        (row) => row.kind === 'user' && row.key === 'parcel',
      )?.id;
      if (typeof actorId !== 'string')
        throw new Error('Presentation parcel user is missing');
      const actor = await tx.user.findUnique({ where: { id: actorId } });
      if (!actor || actor.deletedAt || actor.role !== 'PARCEL_STAFF')
        throw new Error(
          'An active presentation parcel user is required for stock receipts',
        );
      const baseId = manifest.rows.find(
        (row) => row.kind === 'part' && row.key === 'filter',
      )?.id;
      if (typeof baseId !== 'number')
        throw new Error('Existing presentation spare-part group is missing');
      const base = await tx.sparepart.findUniqueOrThrow({
        where: { id: baseId },
      });
      const group = await tx.sparepartGroup.findUniqueOrThrow({
        where: { id: base.groupId },
      });
      if (group.deletedAt)
        throw new Error('Presentation spare-part group is deleted');
      const conflict = await tx.sparepart.count({
        where: {
          code: { in: missing.map(({ part }) => partLabels[part.key].code) },
        },
      });
      if (conflict)
        throw new Error(
          'An added spare-part code already belongs to another record',
        );
      for (const { part, index } of missing) {
        const result = await createPartWithReceipts(
          tx,
          part,
          index,
          fixture.date,
          group.id,
          actorId,
        );
        manifest.rows.push({
          kind: 'part',
          key: part.key,
          id: result.id,
          document: result.code,
          state: `stock=${result.qtyInStock}`,
        });
      }
      await tx.company.update({
        where: { id: presentationId('marker') },
        data: { remark: JSON.stringify(manifest) },
      });
      return { manifest, added: missing.length };
    },
    {
      maxWait: 10000,
      timeout: 120000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
