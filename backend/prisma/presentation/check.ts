import type { PrismaClient } from '@prisma/client';
import { presentationId } from './fixtures';
import {
  readPresentationManifest,
  type PresentationManifest,
  type ManifestRow,
} from './seed';

export async function checkPresentation(
  prisma: PrismaClient,
  manifest?: PresentationManifest,
): Promise<string[]> {
  const saved = manifest ?? (await readPresentationManifest(prisma));
  if (!saved) throw new Error('No completed presentation fixture was found');
  const ids = (kind: string) =>
    saved.rows.filter((row) => row.kind === kind).map((row) => row.id);
  const [assets, loans, jobs, parts, users, extensions, transfers, disposals] =
    await Promise.all([
      prisma.asset.findMany({
        where: { id: { in: ids('asset') as string[] } },
        include: { status: true, availabilityStatus: true },
      }),
      prisma.borrowTransaction.findMany({
        where: { asset_id: { in: ids('asset') as string[] } },
        include: { borrowStatus: true },
      }),
      prisma.repairJob.findMany({
        where: { assetId: { in: ids('asset') as string[] } },
        include: {
          jobStatus: true,
          repairJobSteps: { include: { stepMaster: true } },
          mechanicRepairs: true,
        },
      }),
      prisma.sparepart.findMany({
        where: { id: { in: ids('part') as number[] } },
        include: { sparepartAdds: true, sparepartTxns: true },
      }),
      prisma.user.findMany({ where: { id: { in: ids('user') as string[] } } }),
      prisma.borrowExtension.findMany({
        where: { id: { in: ids('extension') as string[] } },
        include: { borrowTransaction: true },
      }),
      prisma.transfer.findMany({
        where: { id: { in: ids('transfer') as string[] } },
      }),
      prisma.disposal.findMany({
        where: { id: { in: ids('disposal') as string[] } },
      }),
    ]);
  const rowsByKind: Record<ManifestRow['kind'], { id: string | number }[]> = {
    asset: assets,
    borrow: loans,
    repair: jobs,
    part: parts,
    user: users,
    extension: extensions,
    transfer: transfers,
    disposal: disposals,
  };
  const errors: string[] = [];
  const center = await prisma.section.findUnique({
    where: { id: presentationId('section:CENTER') },
  });
  if (!center || center.deletedAt || center.code !== 'CENTER')
    errors.push(
      'Presentation center must use code CENTER for the ready-assets UI and borrow API',
    );
  for (const row of saved.rows)
    if (!rowsByKind[row.kind].some((record) => record.id === row.id))
      errors.push(`Missing ${row.kind} scenario: ${row.key}`);
  for (const asset of assets) {
    const activeLoans = loans.filter(
      (loan) =>
        loan.asset_id === asset.id &&
        [
          'PENDING_APPROVE',
          'APPROVED',
          'BORROWED',
          'PENDING_RETURN',
          'IN_PICKUP',
        ].includes(loan.borrowStatus.code),
    );
    const activeJobs = jobs.filter(
      (job) =>
        job.assetId === asset.id &&
        !['COMPLETED', 'CANCELLED'].includes(job.jobStatus.code),
    );
    if (
      activeLoans.length > 1 ||
      activeJobs.length > 1 ||
      (activeLoans.length && activeJobs.length)
    )
      errors.push(`Overlapping active workflows: ${asset.noid}`);
    const availability = activeLoans.length
      ? ['PENDING_APPROVE', 'APPROVED'].includes(
          activeLoans[0].borrowStatus.code,
        )
        ? 'RESERVED'
        : activeLoans[0].borrowStatus.code === 'BORROWED'
          ? 'BORROWED'
          : 'UNAVAILABLE'
      : asset.status.code === 'NORMAL'
        ? 'AVAILABLE'
        : 'UNAVAILABLE';
    if (
      asset.availabilityStatus?.code !== availability ||
      (asset.status.code === 'UNDER_REPAIR') !== Boolean(activeJobs.length)
    )
      errors.push(`Asset state does not match its workflows: ${asset.noid}`);
    if (activeLoans.length && asset.status.code !== 'NORMAL')
      errors.push(`Active loan on non-normal asset: ${asset.noid}`);
  }
  for (const loan of loans) {
    const ordered = [
      loan.createdAt,
      loan.approved_at,
      loan.handover_date,
      loan.return_date,
    ].filter((value): value is Date => value !== null);
    if (ordered.some((value, index) => index > 0 && value < ordered[index - 1]))
      errors.push(`Borrow dates are out of order: ${loan.borrowNo}`);
  }
  for (const job of jobs) {
    const steps = [...job.repairJobSteps].sort(
      (a, b) => a.stepMaster.stepNumber - b.stepMaster.stepNumber,
    );
    if (
      steps.length &&
      !job.mechanicRepairs.some((assignment) => assignment.deleteAt === null)
    )
      errors.push(`Diagnosed repair has no assigned technician: ${job.jobNo}`);
    let incomplete = false;
    for (const step of steps) {
      if (incomplete && step.completeAt)
        errors.push(`Repair steps were skipped: ${job.jobNo}`);
      if (!step.completeAt) incomplete = true;
    }
    if (
      job.jobStatus.code === 'COMPLETED' &&
      (!job.returnDate || !steps.length || incomplete)
    )
      errors.push(`Closed repair is incomplete: ${job.jobNo}`);
  }
  for (const part of parts) {
    for (const receipt of part.sparepartAdds.filter(
      (add) => add.deletedAt === null,
    )) {
      if (
        !Number.isInteger(receipt.qty) ||
        receipt.qty <= 0 ||
        Number(receipt.totalPrice) < 0 ||
        !receipt.sparepartAddDoc.trim() ||
        !receipt.addBy
      )
        errors.push(`Invalid stock receipt: ${part.code}`);
    }
    const received = part.sparepartAdds
      .filter((add) => add.deletedAt === null)
      .reduce((qty, add) => qty + add.qty, 0);
    const balance = part.sparepartTxns
      .filter((txn) => txn.stockType === 'INTERNAL')
      .reduce(
        (qty, txn) =>
          qty +
          (txn.txnType === 'RETURN'
            ? txn.qty
            : txn.txnType === 'WITHDRAW'
              ? -txn.qty
              : 0),
        received,
      );
    if (balance !== part.qtyInStock || balance < 0)
      errors.push(`Stock ledger mismatch: ${part.code}`);
    for (const returned of part.sparepartTxns.filter(
      (txn) => txn.txnType === 'RETURN',
    )) {
      const net = part.sparepartTxns
        .filter(
          (txn) =>
            txn.jobId === returned.jobId &&
            txn.stockType === returned.stockType &&
            txn.txnDate <= returned.txnDate,
        )
        .reduce(
          (qty, txn) =>
            qty +
            (txn.txnType === 'WITHDRAW'
              ? txn.qty
              : txn.txnType === 'RETURN'
                ? -txn.qty
                : 0),
          0,
        );
      if (net < 0)
        errors.push(`Return exceeds previous withdrawal: ${part.code}`);
    }
  }
  for (const extension of extensions) {
    if (extension.requestedReturnDate <= extension.currentReturnDate)
      errors.push(`Invalid extension dates: ${extension.id}`);
    if (
      extension.status === 'APPROVED' &&
      extension.borrowTransaction.expectedReturnDate &&
      extension.borrowTransaction.expectedReturnDate <
        extension.requestedReturnDate
    )
      errors.push(`Approved extension is absent from parent: ${extension.id}`);
  }
  for (const disposal of disposals) {
    const asset = assets.find((row) => row.id === disposal.asset_id);
    if (asset?.status.code !== 'DISPOSAL')
      errors.push(
        `Disposal record disagrees with asset status: ${disposal.disposalDocNo}`,
      );
  }
  for (const asset of assets) {
    // Include transfers added during live demos, not only the original manifest.
    const latest = await prisma.transfer.findFirst({
      where: { asset_id: asset.id, deletedAt: null },
      orderBy: { transferDate: 'desc' },
    });
    if (latest && latest.to_section_id !== asset.section_id)
      errors.push(
        `Transfer history disagrees with asset section: ${asset.noid}`,
      );
  }
  if (errors.length)
    throw new Error(
      `Presentation consistency check failed:\n${errors.join('\n')}`,
    );
  const ready = new Set(
    (
      await prisma.twoFactorAuth.findMany({
        where: {
          userId: { in: users.map((user) => user.id) },
          enrollmentComplete: true,
        },
        select: { userId: true },
      })
    ).map((row) => row.userId),
  );
  const warnings = users
    .filter(
      (user) =>
        !user.deletedAt &&
        ['ADMIN', 'PARCEL_STAFF', 'ASSET_CENTER_STAFF'].includes(user.role) &&
        !ready.has(user.id),
    )
    .map((user) => `2FA enrollment still required: ${user.userName}`);
  if (!assets.some((asset) => asset.imageUrl))
    warnings.push(
      'Sample asset images have not been prepared yet (public sample URLs are sufficient for a visual demo)',
    );
  if (!users.some((user) => user.imageStorageProvider))
    warnings.push(
      'Sample employee photos are not yet attached through the image workflow',
    );
  return warnings;
}
