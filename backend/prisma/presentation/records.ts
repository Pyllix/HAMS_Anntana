import { Prisma, StepActionType } from '@prisma/client';
import {
  presentationId,
  stockBalance,
  type PresentationFixture,
} from './fixtures';
import { nextDocument, type PresentationManifest } from './seed';
import {
  assetLabels,
  documentLabel,
  inventoryLabels,
  repairLabels,
  sectionLabels,
} from './labels';
import { presentationAssetImageUrl } from './images';
import { createPartWithReceipts } from './parts';
const documentMonth = (date: Date) =>
  date.toISOString().slice(0, 7).replace('-', '');

/** Write only the supplied new records; existing maps resolve cross-record references. */
export async function writePresentationRecords(
  tx: Prisma.TransactionClient,
  fixture: PresentationFixture,
  manifest: PresentationManifest,
): Promise<void> {
  const disposalRows: Prisma.DisposalCreateManyInput[] = [];
  const transferRows: Prisma.TransferCreateManyInput[] = [];
  const repairJobRows: Prisma.RepairJobCreateManyInput[] = [];
  const borrowExtensionRows: Prisma.BorrowExtensionCreateManyInput[] = [];
  const borrowTransactionRows: Prisma.BorrowTransactionCreateManyInput[] = [];
  const assetRows: Prisma.AssetCreateManyInput[] = [];
  const users = new Map(
    manifest.rows
      .filter((row) => row.kind === 'user')
      .map((row) => [row.key, String(row.id)]),
  );
  const sections = new Map(
    fixture.sections.map((key) => [key, presentationId(`section:${key}`)]),
  );
  const vendor = await tx.company.findUniqueOrThrow({
    where: { id: presentationId('vendor') },
  });
  const assetStatuses = new Map(
    (await tx.assetStatus.findMany()).map((row) => [row.code, row.id]),
  );
  const availabilities = new Map(
    (await tx.availabilityStatus.findMany()).map((row) => [row.code, row.id]),
  );
  const borrowStatuses = new Map(
    (await tx.borrowStatus.findMany()).map((row) => [row.code, row.id]),
  );
  const jobStatuses = new Map(
    (await tx.jobStatus.findMany()).map((row) => [row.code, row.id]),
  );
  const assetTypes = new Map(
    (
      await tx.assetType.findMany({
        where: { deletedAt: null },
        orderBy: { id: 'asc' },
      })
    ).map((row) => [row.name, row.id]),
  );
  const equipment = await tx.equipmentType.findFirstOrThrow({
    orderBy: { id: 'asc' },
  });
  const category = await tx.techCategory.findFirstOrThrow({
    where: { isActive: true, deleteAt: null },
    orderBy: { id: 'asc' },
  });
  const cause = await tx.cause.findFirstOrThrow({
    where: { deleteAt: null },
    orderBy: { id: 'asc' },
  });
  const jobType = await tx.jobType.findFirstOrThrow({
    where: { deletedAt: null },
    orderBy: { id: 'asc' },
  });
  const stepMasters = await tx.stepMaster.findMany({
    orderBy: { id: 'asc' },
  });
  const required = (map: Map<string, number>, code: string): number => {
    const value = map.get(code);
    if (value === undefined)
      throw new Error(`Missing reference record: ${code}`);
    return value;
  };
  const actor = users.get('admin')!;
  const assets = new Map(
    manifest.rows
      .filter((row) => row.kind === 'asset')
      .map((row) => [row.key, String(row.id)]),
  );
  for (const [fallbackIndex, machine] of fixture.assets.entries()) {
    const index = machine.labelIndex ?? fallbackIndex;
    const labels = assetLabels(machine, index);
    const result = {
      id: presentationId(`asset:${machine.key}`),
      noid: labels.noid,
      serialNo: labels.serialNo,
      name: machine.name,
      model: machine.model,
      price: machine.price,
      type_id: required(assetTypes, machine.type),
      equipment_type_id:
        machine.type === 'เครื่องมือแพทย์' ? equipment.id : null,
      section_id: sections.get(machine.section)!,
      company_id: vendor.id,
      owner_id: users.get(
        machine.section === 'ER'
          ? 'er'
          : machine.section === 'ICU'
            ? 'icu'
            : 'center',
      )!,
      asset_status_id: required(assetStatuses, machine.status),
      availability_status_id: required(availabilities, machine.availability),
      receivedDate: machine.receivedDate,
      warrantyDate: machine.warrantyDate,
      budgetType: inventoryLabels.budget,
      acqType: machine.price === 0 ? 'บริจาค' : 'เฉพาะเจาะจง',
      acqDoc: labels.acqDoc,
      pmType: index % 2 ? 'EM' : 'IM',
      pmIntervalMonth: 6,
      calType: index % 2 ? 'EC' : 'IC',
      calIntervalMonth: 12,
      riskLevel: index % 3 === 0 ? 'HIGH' : index % 3 === 1 ? 'MEDIUM' : 'LOW',
      isSpecial: machine.special,
      isBackup: machine.backup,
      remark: labels.remark,
      imageUrl: presentationAssetImageUrl(machine),
      createdBy: actor,
      updatedBy: actor,
      createdAt: machine.receivedDate,
      updatedAt: fixture.date,
    } satisfies Prisma.AssetCreateManyInput;
    assetRows.push(result);
    assets.set(machine.key, result.id);
    manifest.rows.push({
      kind: 'asset',
      key: machine.key,
      id: result.id,
      document: result.noid!,
      state: `${machine.status}/${machine.availability}`,
    });
  }
  if (assetRows.length) await tx.asset.createMany({ data: assetRows });
  const docLists = {
    BR: (
      await tx.borrowTransaction.findMany({ select: { borrowNo: true } })
    ).map((row) => row.borrowNo),
    REP: (await tx.repairJob.findMany({ select: { jobNo: true } })).map(
      (row) => row.jobNo,
    ),
  };
  const allocate = (kind: keyof typeof docLists, date: Date): string => {
    const result = nextDocument(
      `${kind}-${documentMonth(date)}-`,
      docLists[kind],
    );
    docLists[kind].push(result);
    return result;
  };
  const borrows = new Map(
    manifest.rows
      .filter((row) => row.kind === 'borrow')
      .map((row) => [row.key, String(row.id)]),
  );
  for (const loan of fixture.borrows) {
    const approvedExtensions = fixture.extensions.filter(
      (extension) =>
        extension.borrow === loan.key && extension.status === 'APPROVED',
    );
    const cancelled = loan.status === 'CANCELLED';
    const result = {
      id: presentationId(`borrow:${loan.key}`),
      borrowNo: allocate('BR', loan.createdAt),
      asset_id: assets.get(loan.asset)!,
      borrower_id: users.get(loan.borrower)!,
      borrow_status_id: required(borrowStatuses, loan.status),
      created_by_user_id: users.get(
        loan.source === 'CENTER_SERVICE' ? 'center' : loan.borrower,
      ),
      approved_by_user_id: loan.approvedAt ? users.get('center') : null,
      approved_at: loan.approvedAt,
      handover_by_user_id: loan.handoverAt ? users.get('center') : null,
      handover_date: loan.handoverAt,
      returned_by_user_id: loan.returnAt ? users.get(loan.borrower) : null,
      received_by_user_id:
        loan.status === 'RETURNED' || loan.status === 'IN_PICKUP'
          ? users.get('center')
          : null,
      return_date: loan.returnAt,
      return_condition: loan.condition,
      return_method: loan.returnMethod,
      return_remark:
        loan.condition === 'Damage'
          ? 'พบความผิดปกติขณะตรวจรับคืน ส่งตรวจสอบโดยช่าง'
          : 'ตรวจรับคืนตามรายการส่งมอบ',
      rejected_by_user_id:
        loan.status === 'REJECTED' ? users.get('center') : null,
      rejected_at: loan.status === 'REJECTED' ? fixture.date : null,
      reject_remark: loan.status === 'REJECTED' ? loan.reason : null,
      cancelled_by_user_id: cancelled ? users.get(loan.borrower) : null,
      cancelled_at: cancelled ? fixture.date : null,
      cancel_reason: cancelled ? loan.reason : null,
      expectedReturnDate: loan.expectedReturn,
      extensionCount: approvedExtensions.length,
      request_source: loan.source,
      delivery_method: loan.delivery,
      createdAt: loan.createdAt,
    } satisfies Prisma.BorrowTransactionCreateManyInput;
    borrowTransactionRows.push(result);
    borrows.set(loan.key, result.id);
    manifest.rows.push({
      kind: 'borrow',
      key: loan.key,
      id: result.id,
      document: result.borrowNo,
      state: loan.status,
    });
  }
  if (borrowTransactionRows.length)
    await tx.borrowTransaction.createMany({ data: borrowTransactionRows });
  for (const extension of fixture.extensions) {
    const parent = fixture.borrows.find(
      (loan) => loan.key === extension.borrow,
    )!;
    const result = {
      id: presentationId(`extension:${extension.key}`),
      borrowTransactionId: borrows.get(extension.borrow)!,
      extensionType: extension.type,
      status: extension.status,
      roundNumber: 1,
      currentReturnDate: extension.currentDate,
      requestedReturnDate: extension.requestedDate,
      reason: extension.reason ?? 'จำเป็นต้องใช้งานต่อเพื่อดูแลผู้ป่วย',
      rejectReason:
        extension.status === 'REJECTED'
          ? (extension.rejectReason ?? 'ต้องสำรองเครื่องสำหรับแผนกอื่น')
          : null,
      requestedByUserId: users.get(
        extension.type === 'DESK' ? 'center' : parent.borrower,
      )!,
      reviewedByUserId: ['APPROVED', 'REJECTED'].includes(extension.status)
        ? users.get('center')
        : null,
      reviewedAt: ['APPROVED', 'REJECTED'].includes(extension.status)
        ? fixture.date
        : null,
      createdAt: extension.createdAt,
      updatedAt: fixture.date,
    } satisfies Prisma.BorrowExtensionCreateManyInput;
    borrowExtensionRows.push(result);
    manifest.rows.push({
      kind: 'extension',
      key: extension.key,
      id: result.id,
      state: `${extension.type}/${extension.status}`,
    });
  }
  if (borrowExtensionRows.length)
    await tx.borrowExtension.createMany({ data: borrowExtensionRows });
  const jobs = new Map(
    manifest.rows
      .filter((row) => row.kind === 'repair')
      .map((row) => [row.key, String(row.id)]),
  );
  const assignments: Prisma.MechanicRepairCreateManyInput[] = [];
  const steps: Prisma.RepairJobStepCreateManyInput[] = [];
  for (const [jobIndex, job] of fixture.repairs.entries()) {
    const machine = fixture.assets.find((row) => row.key === job.asset)!;
    const result = {
      id: presentationId(`repair:${job.key}`),
      jobNo: allocate('REP', job.createdAt),
      assetId: assets.get(job.asset)!,
      sectionId: sections.get(machine.section)!,
      reporterId: users.get(job.reporter)!,
      jobTypeId: jobType.id,
      jobStatusId: required(jobStatuses, job.status),
      reportType: job.maintenance ? 'Maintenance' : 'Repair',
      urgencyStatus: job.urgency,
      ...repairLabels(job.track, job.maintenance),
      ...(job.symptom !== undefined ? { symptom: job.symptom } : {}),
      ...(job.diagnosis !== undefined ? { diagnosis: job.diagnosis } : {}),
      ...(job.solution !== undefined ? { solution: job.solution } : {}),
      actionType:
        job.action ??
        (job.maintenance ? 'PREVENTIVE' : job.track ? 'REPAIR' : null),
      causeId: job.track ? cause.id : null,
      techCategoryId: job.technicians.length ? category.id : null,
      dueDate:
        job.dueDate ?? new Date(job.createdAt.getTime() + 7 * 86_400_000),
      returnDate: job.closedAt,
      receiverId:
        job.status === 'COMPLETED'
          ? users.get(
              job.track === StepActionType.UNREPAIRABLE
                ? 'parcel'
                : job.reporter,
            )
          : null,
      warrantyDate:
        job.status === 'COMPLETED' && job.track !== StepActionType.UNREPAIRABLE
          ? new Date(job.closedAt!.getTime() + 90 * 86_400_000)
              .toISOString()
              .slice(0, 10)
          : null,
      unrepairableReason:
        job.track === StepActionType.UNREPAIRABLE
          ? 'อุปกรณ์เสียหายและไม่สามารถซ่อมให้กลับมาใช้งานได้'
          : null,
      companyId:
        job.track === StepActionType.OUTSOURCE && job.completedSteps >= 5
          ? vendor.id
          : null,
      billNo:
        job.track === StepActionType.OUTSOURCE && job.completedSteps >= 5
          ? documentLabel('BILL', job.createdAt, jobIndex)
          : null,
      repairCost:
        job.track === StepActionType.OUTSOURCE && job.completedSteps >= 5
          ? job.cost
          : null,
      isRepeatRepair:
        job.key.startsWith('viability-') && /-[23]$/.test(job.key),
      createdBy: users.get(job.reporter)!,
      updatedBy: users.get(job.track ? 'tech-a' : 'head')!,
      createdAt: job.createdAt,
      updatedAt: job.closedAt ?? fixture.date,
    } satisfies Prisma.RepairJobCreateManyInput;
    repairJobRows.push(result);
    jobs.set(job.key, result.id);
    for (const key of job.technicians)
      assignments.push({
        jobId: result.id,
        userId: users.get(key)!,
        createdAt: job.createdAt,
        updatedAt: job.createdAt,
      });
    if (job.track) {
      const max = job.track === StepActionType.SELF_REPAIR ? 6 : 8;
      for (let step = 1; step <= max; step++) {
        const template = stepMasters.find(
          (row) => row.actionType === job.track && row.stepNumber === step,
        );
        if (!template)
          throw new Error(`Missing step template ${job.track}/${step}`);
        const complete = step <= job.completedSteps;
        const parcel =
          ((job.track === StepActionType.WITH_PARTS ||
            job.track === StepActionType.OUTSOURCE) &&
            step === 5) ||
          (job.track === StepActionType.UNREPAIRABLE && step >= 6);
        steps.push({
          jobId: result.id,
          stepMasterId: template.id,
          completeAt: complete
            ? new Date(
                job.createdAt.getTime() +
                  (((job.closedAt ?? fixture.date).getTime() -
                    job.createdAt.getTime()) *
                    step) /
                    max,
              )
            : null,
          completedBy: complete
            ? users.get(
                parcel
                  ? 'parcel'
                  : step === 2
                    ? 'head'
                    : step === 1
                      ? job.reporter
                      : job.technicians[0],
              )
            : job.rejected && step === 5
              ? users.get('parcel')
              : null,
          note:
            job.rejected && step === 5
              ? '[ไม่อนุมัติ] ขอปรับแผนการซ่อมก่อนดำเนินการต่อ'
              : null,
        });
      }
    }
    manifest.rows.push({
      kind: 'repair',
      key: job.key,
      id: result.id,
      document: result.jobNo,
      state: `${job.status} · ${job.track ?? 'NOT_DIAGNOSED'}`,
    });
  }
  if (repairJobRows.length)
    await tx.repairJob.createMany({ data: repairJobRows });
  if (assignments.length)
    await tx.mechanicRepair.createMany({ data: assignments });
  if (steps.length) await tx.repairJobStep.createMany({ data: steps });
  const group =
    (await tx.sparepartGroup.findFirst({
      where: { name: inventoryLabels.group, deletedAt: null },
    })) ??
    (await tx.sparepartGroup.create({ data: { name: inventoryLabels.group } }));
  const parts = new Map(
    manifest.rows
      .filter((row) => row.kind === 'part')
      .map((row) => [row.key, Number(row.id)]),
  );
  for (const [partIndex, part] of fixture.parts.entries()) {
    const result = await createPartWithReceipts(
      tx,
      part,
      partIndex,
      fixture.date,
      group.id,
      users.get('parcel')!,
    );
    parts.set(part.key, result.id);
    manifest.rows.push({
      kind: 'part',
      key: part.key,
      id: result.id,
      document: result.code,
      state: `stock=${stockBalance(fixture, part)}`,
    });
  }
  for (const txn of fixture.txns) {
    await tx.sparepartTxn.create({
      data: {
        sparepartId: parts.get(txn.part)!,
        jobId: jobs.get(txn.job)!,
        txnType: txn.type,
        stockType: txn.stock,
        qty: txn.qty,
        unitPrice: txn.unitPrice,
        txnDate: txn.date,
        txnBy: users.get(txn.type === 'RETURN' ? 'parcel' : 'tech-a')!,
        createdAt: txn.date,
      },
    });
    if (txn.stock === 'INTERNAL' && txn.type !== 'PENDING_WITHDRAW')
      await tx.sparepart.update({
        where: { id: parts.get(txn.part)! },
        data: {
          qtyInStock: {
            increment: txn.type === 'RETURN' ? txn.qty : -txn.qty,
          },
          updatedAt: fixture.date,
        },
      });
  }
  for (const [transferIndex, transfer] of fixture.transfers.entries()) {
    const result = {
      id: presentationId(`transfer:${transfer.key}`),
      asset_id: assets.get(transfer.asset)!,
      from_section_id: sections.get(transfer.from),
      to_section_id: sections.get(transfer.to),
      transferDocNo: documentLabel('TF', transfer.date, transferIndex),
      transferDate: transfer.date,
      fromLocation: sectionLabels(transfer.from).building,
      toLocation: sectionLabels(transfer.to).building,
      transferred_by: users.get('parcel')!,
      remark: 'โอนย้ายครุภัณฑ์ตามหนังสืออนุมัติของหน่วยงาน',
      createdAt: transfer.date,
      updatedAt: transfer.date,
    } satisfies Prisma.TransferCreateManyInput;
    transferRows.push(result);
    manifest.rows.push({
      kind: 'transfer',
      key: transfer.key,
      id: result.id,
      document: result.transferDocNo,
    });
  }
  if (transferRows.length) await tx.transfer.createMany({ data: transferRows });
  for (const [disposalIndex, disposal] of fixture.disposals.entries()) {
    const result = {
      id: presentationId(`disposal:${disposal.key}`),
      asset_id: assets.get(disposal.asset)!,
      disposalDocNo: documentLabel('DSP', disposal.date, disposalIndex),
      approvedDate: disposal.date,
      createdAt: disposal.date,
      updatedAt: disposal.date,
    } satisfies Prisma.DisposalCreateManyInput;
    disposalRows.push(result);
    manifest.rows.push({
      kind: 'disposal',
      key: disposal.key,
      id: result.id,
      document: result.disposalDocNo,
    });
  }
  if (disposalRows.length) await tx.disposal.createMany({ data: disposalRows });
  if (fixture.notifications.length) {
    await tx.notification.createMany({
      data: fixture.notifications.map((notice) => ({
        id: presentationId(`notification:${notice.key}`),
        userId: users.get(notice.user)!,
        type: notice.type,
        title: notice.title,
        message: notice.message,
        resourceType: notice.resourceType,
        resourceId: (notice.resourceType === 'REPAIR_JOB'
          ? jobs
          : notice.resourceType === 'BORROW_EXTENSION'
            ? new Map(
                manifest.rows
                  .filter((row) => row.kind === 'extension')
                  .map((row) => [row.key, String(row.id)]),
              )
            : borrows
        ).get(notice.resource)!,
        eventKey: `presentation:${notice.key}`,
        readAt: notice.readAt,
        createdAt: notice.createdAt,
      })),
    });
    for (const notice of fixture.notifications)
      manifest.rows.push({
        kind: 'notification',
        key: notice.key,
        id: presentationId(`notification:${notice.key}`),
        state: notice.readAt ? 'READ' : 'UNREAD',
      });
  }
}
