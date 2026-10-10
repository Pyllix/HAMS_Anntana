import { Prisma, type PrismaClient, StepActionType } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { seedReferenceData } from '../seed-reference';
import { originalProfile, originalUserPreparation } from './user-profiles';
import { presentationSectionData } from './sections';
import { presentationAssetImageUrl } from './images';
import { createPartWithReceipts } from './parts';
import {
  assetLabels,
  documentLabel,
  inventoryLabels,
  partLabels,
  repairLabels,
  sectionLabels,
  supplementalUsers,
} from './labels';
import {
  PRESENTATION_MARKER,
  PRESENTATION_VERSION,
  presentationId,
  stockBalance,
  validateFixture,
  type PresentationFixture,
} from './fixtures';

export interface ManifestRow {
  kind:
    | 'user'
    | 'asset'
    | 'borrow'
    | 'extension'
    | 'repair'
    | 'part'
    | 'transfer'
    | 'disposal';
  key: string;
  id: string | number;
  document?: string;
  role?: string;
  state?: string;
}
export interface PresentationManifest {
  version: number;
  userProfile?: 'original-seed-v1';
  labelProfile?: 'hospital-v1';
  date: string;
  rows: ManifestRow[];
  preparation: string[];
}

const documentMonth = (date: Date) =>
  date.toISOString().slice(0, 7).replace('-', '');
export function nextDocument(prefix: string, existing: string[]): string {
  const sequences = existing
    .filter((value) => value.startsWith(prefix))
    .map((value) => {
      const suffix = value.slice(prefix.length);
      if (!/^\d{4}$/.test(suffix))
        throw new Error(
          `Unsupported document format for ${prefix}; inspect the existing series first`,
        );
      return Number(suffix);
    });
  const sequence = Math.max(0, ...sequences) + 1;
  if (sequence > 9999) throw new Error(`Document series exhausted: ${prefix}`);
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

export async function readPresentationManifest(
  prisma: Pick<PrismaClient, 'company'>,
): Promise<PresentationManifest | null> {
  const marker = await prisma.company.findUnique({
    where: { code: PRESENTATION_MARKER },
  });
  if (!marker) return null;
  if (marker.id !== presentationId('marker'))
    throw new Error(
      'Presentation marker belongs to another record; no data was changed',
    );
  let manifest: PresentationManifest;
  try {
    manifest = JSON.parse(marker.remark) as PresentationManifest;
  } catch {
    throw new Error('Presentation marker is not readable; no data was changed');
  }
  if (
    manifest.version !== PRESENTATION_VERSION ||
    !Array.isArray(manifest.rows) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(manifest.date)
  )
    throw new Error('Unsupported presentation manifest; no data was changed');
  return manifest;
}

/** Create-only, atomic fixture set. A rerun never rewinds workflows or inventory. */
export async function seedPresentation(
  prisma: PrismaClient,
  fixture: PresentationFixture,
  password: string,
): Promise<{ manifest: PresentationManifest; created: boolean }> {
  validateFixture(fixture);
  if (password.length < 12)
    throw new Error(
      'DEMO_PRESENTATION_PASSWORD must contain at least 12 characters',
    );
  const passwordHash = await hashPassword(password);
  const originalHashes = new Map<string, string>();
  for (const user of fixture.users) {
    const profile = originalProfile(user.key);
    if (profile && !originalHashes.has(profile.password))
      originalHashes.set(
        profile.password,
        await hashPassword(profile.password),
      );
  }
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(90261009)`;
      const existing = await readPresentationManifest(tx);
      if (existing) return { manifest: existing, created: false };

      // Refuse to take over orphaned/colliding records rather than overwriting them.
      const userIds = fixture.users.map((user) =>
        presentationId(`user:${user.key}`),
      );
      const assetIds = fixture.assets.map((asset) =>
        presentationId(`asset:${asset.key}`),
      );
      const conflicts = await Promise.all([
        tx.user.count({
          where: {
            OR: [
              { id: { in: userIds } },
              {
                email: {
                  in: fixture.users.map(
                    (user) =>
                      originalProfile(user.key)?.email ??
                      supplementalUsers[user.key]?.email ??
                      `present-${user.key}@demo.hams.local`,
                  ),
                },
              },
            ],
          },
        }),
        tx.asset.count({
          where: {
            OR: [
              { id: { in: assetIds } },
              { serialNo: { startsWith: 'PRESENT-SN-' } },
            ],
          },
        }),
        tx.section.count({
          where: {
            code: {
              in: fixture.sections.map(
                (section) => presentationSectionData(section).code,
              ),
            },
          },
        }),
        tx.company.count({
          where: {
            code: {
              in: [
                inventoryLabels.vendor.code,
                inventoryLabels.restoreVendor.code,
              ],
            },
          },
        }),
        tx.sparepart.count({
          where: {
            code: { in: Object.values(partLabels).map((part) => part.code) },
          },
        }),
      ]);
      if (conflicts.some((count) => count > 0))
        throw new Error(
          'Presentation records exist without a completed manifest. Inspect them before seeding; no records were overwritten',
        );

      await seedReferenceData(tx);
      const assetStatuses = new Map(
        (await tx.assetStatus.findMany()).map((row) => [row.code, row.id]),
      );
      const availabilities = new Map(
        (await tx.availabilityStatus.findMany()).map((row) => [
          row.code,
          row.id,
        ]),
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
      const sections = new Map<string, string>();
      for (const key of fixture.sections) {
        const section = await tx.section.create({
          data: {
            ...presentationSectionData(key),
          },
        });
        sections.set(key, section.id);
      }
      await tx.section.create({
        data: {
          id: presentationId('section:restore'),
          ...inventoryLabels.restoreSection,
          deletedAt: fixture.date,
        },
      });
      const vendor = await tx.company.create({
        data: {
          id: presentationId('vendor'),
          ...inventoryLabels.vendor,
        },
      });
      await tx.company.create({
        data: {
          id: presentationId('vendor:restore'),
          ...inventoryLabels.restoreVendor,
          deletedAt: fixture.date,
        },
      });
      await tx.acqType.create({
        data: {
          name: inventoryLabels.restoreAcquisition,
          description: 'รับโอนครุภัณฑ์จากหน่วยงานภาครัฐตามหนังสือส่งมอบ',
          isActive: false,
          deletedAt: fixture.date,
        },
      });
      await tx.budgetType.create({
        data: {
          name: inventoryLabels.budget,
          fiscalYear: fixture.date.getUTCFullYear() + 543,
          description: 'งบพัฒนาศักยภาพเครื่องมือสำหรับให้บริการผู้ป่วย',
          isActive: true,
        },
      });
      await tx.budgetType.create({
        data: {
          name: inventoryLabels.inactiveBudget,
          fiscalYear: fixture.date.getUTCFullYear() + 542,
          description: 'งบดำเนินการปรับปรุงอุปกรณ์ในปีงบประมาณที่ผ่านมา',
          isActive: false,
        },
      });

      const manifest: PresentationManifest = {
        version: PRESENTATION_VERSION,
        userProfile: 'original-seed-v1',
        labelProfile: 'hospital-v1',
        date: fixture.date.toISOString().slice(0, 10),
        rows: [],
        preparation: originalUserPreparation,
      };
      const users = new Map<string, string>();
      const employeePrefix = `GOV-${String((fixture.date.getUTCFullYear() + 543) % 100).padStart(2, '0')}`;
      const existingEmployeeIds = (
        await tx.user.findMany({
          where: { employeeId: { startsWith: employeePrefix } },
          select: { employeeId: true },
        })
      ).map((row) => row.employeeId!);
      for (const user of fixture.users) {
        const profile = originalProfile(user.key);
        const displayProfile = profile ?? supplementalUsers[user.key];
        const employeeId =
          profile?.employeeId ??
          nextDocument(employeePrefix, existingEmployeeIds);
        const email =
          displayProfile?.email ?? `present-${user.key}@demo.hams.local`;
        existingEmployeeIds.push(employeeId);
        const result = await tx.user.create({
          data: {
            id: presentationId(`user:${user.key}`),
            employeeId,
            userName: displayProfile?.userName ?? `present-${user.key}`,
            firstname: displayProfile?.firstname ?? 'ผู้ใช้ทดลอง',
            lastname: displayProfile?.lastname ?? user.key,
            email,
            emailVerified: user.verified,
            role: user.role,
            section_id: sections.get(user.section)!,
            createdAt: fixture.date,
            updatedAt: fixture.date,
            deletedAt: user.deleted ? fixture.date : null,
            accounts: {
              create: {
                id: presentationId(`credential:${user.key}`),
                accountId: email,
                providerId: 'credential',
                password: profile
                  ? originalHashes.get(profile.password)!
                  : passwordHash,
                createdAt: fixture.date,
                updatedAt: fixture.date,
              },
            },
          },
        });
        users.set(user.key, result.id);
        manifest.rows.push({
          kind: 'user',
          key: user.key,
          id: result.id,
          document: employeeId,
          role: user.role,
          state: user.deleted
            ? 'DELETED'
            : user.verified
              ? 'VERIFIED · 2FA preparation may be required'
              : 'EMAIL_UNVERIFIED',
        });
      }
      const actor = users.get('admin')!;
      const assets = new Map<string, string>();
      for (const [index, machine] of fixture.assets.entries()) {
        const labels = assetLabels(machine, index);
        const result = await tx.asset.create({
          data: {
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
            availability_status_id: required(
              availabilities,
              machine.availability,
            ),
            receivedDate: machine.receivedDate,
            warrantyDate: machine.warrantyDate,
            budgetType: inventoryLabels.budget,
            acqType: machine.price === 0 ? 'บริจาค' : 'เฉพาะเจาะจง',
            acqDoc: labels.acqDoc,
            pmType: index % 2 ? 'EM' : 'IM',
            pmIntervalMonth: 6,
            calType: index % 2 ? 'EC' : 'IC',
            calIntervalMonth: 12,
            riskLevel:
              index % 3 === 0 ? 'HIGH' : index % 3 === 1 ? 'MEDIUM' : 'LOW',
            isSpecial: machine.special,
            isBackup: machine.backup,
            remark: labels.remark,
            imageUrl: presentationAssetImageUrl(machine),
            createdBy: actor,
            updatedBy: actor,
            createdAt: machine.receivedDate,
            updatedAt: fixture.date,
          },
        });
        assets.set(machine.key, result.id);
        manifest.rows.push({
          kind: 'asset',
          key: machine.key,
          id: result.id,
          document: result.noid!,
          state: `${machine.status}/${machine.availability}`,
        });
      }
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
      const borrows = new Map<string, string>();
      for (const loan of fixture.borrows) {
        const approvedExtensions = fixture.extensions.filter(
          (extension) =>
            extension.borrow === loan.key && extension.status === 'APPROVED',
        );
        const cancelled = loan.status === 'CANCELLED';
        const result = await tx.borrowTransaction.create({
          data: {
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
            returned_by_user_id: loan.returnAt
              ? users.get(loan.borrower)
              : null,
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
          },
        });
        borrows.set(loan.key, result.id);
        manifest.rows.push({
          kind: 'borrow',
          key: loan.key,
          id: result.id,
          document: result.borrowNo,
          state: loan.status,
        });
      }
      for (const extension of fixture.extensions) {
        const parent = fixture.borrows.find(
          (loan) => loan.key === extension.borrow,
        )!;
        const result = await tx.borrowExtension.create({
          data: {
            id: presentationId(`extension:${extension.key}`),
            borrowTransactionId: borrows.get(extension.borrow)!,
            extensionType: extension.type,
            status: extension.status,
            roundNumber: 1,
            currentReturnDate: extension.currentDate,
            requestedReturnDate: extension.requestedDate,
            reason: 'จำเป็นต้องใช้งานต่อเพื่อดูแลผู้ป่วย',
            rejectReason:
              extension.status === 'REJECTED'
                ? 'ต้องสำรองเครื่องสำหรับแผนกอื่น'
                : null,
            requestedByUserId: users.get(
              extension.type === 'DESK' ? 'center' : parent.borrower,
            )!,
            reviewedByUserId: ['APPROVED', 'REJECTED'].includes(
              extension.status,
            )
              ? users.get('center')
              : null,
            reviewedAt: ['APPROVED', 'REJECTED'].includes(extension.status)
              ? fixture.date
              : null,
            createdAt: extension.createdAt,
            updatedAt: fixture.date,
          },
        });
        manifest.rows.push({
          kind: 'extension',
          key: extension.key,
          id: result.id,
          state: `${extension.type}/${extension.status}`,
        });
      }
      const jobs = new Map<string, string>();
      for (const [jobIndex, job] of fixture.repairs.entries()) {
        const machine = fixture.assets.find((row) => row.key === job.asset)!;
        const result = await tx.repairJob.create({
          data: {
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
            actionType: job.maintenance
              ? 'PREVENTIVE'
              : job.track
                ? 'REPAIR'
                : null,
            causeId: job.track ? cause.id : null,
            techCategoryId: job.technicians.length ? category.id : null,
            dueDate: new Date(job.createdAt.getTime() + 7 * 86_400_000),
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
              job.status === 'COMPLETED' &&
              job.track !== StepActionType.UNREPAIRABLE
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
          },
        });
        jobs.set(job.key, result.id);
        for (const key of job.technicians)
          await tx.mechanicRepair.create({
            data: {
              jobId: result.id,
              userId: users.get(key)!,
              createdAt: job.createdAt,
              updatedAt: job.createdAt,
            },
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
            await tx.repairJobStep.create({
              data: {
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
                          : job.technicians[0],
                    )
                  : job.rejected && step === 5
                    ? users.get('parcel')
                    : null,
                note:
                  job.rejected && step === 5
                    ? '[ไม่อนุมัติ] ขอปรับแผนการซ่อมก่อนดำเนินการต่อ'
                    : null,
              },
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
      const group = await tx.sparepartGroup.create({
        data: { name: inventoryLabels.group },
      });
      const parts = new Map<string, number>();
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
        const result = await tx.transfer.create({
          data: {
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
          },
        });
        manifest.rows.push({
          kind: 'transfer',
          key: transfer.key,
          id: result.id,
          document: result.transferDocNo,
        });
      }
      for (const [disposalIndex, disposal] of fixture.disposals.entries()) {
        const result = await tx.disposal.create({
          data: {
            id: presentationId(`disposal:${disposal.key}`),
            asset_id: assets.get(disposal.asset)!,
            disposalDocNo: documentLabel('DSP', disposal.date, disposalIndex),
            approvedDate: disposal.date,
            createdAt: disposal.date,
            updatedAt: disposal.date,
          },
        });
        manifest.rows.push({
          kind: 'disposal',
          key: disposal.key,
          id: result.id,
          document: result.disposalDocNo,
        });
      }
      await tx.company.create({
        data: {
          id: presentationId('marker'),
          code: PRESENTATION_MARKER,
          name: 'ระบบทะเบียนครุภัณฑ์ส่วนกลาง',
          remark: JSON.stringify(manifest),
          group: 'SYSTEM',
        },
      });
      return { manifest, created: true };
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
