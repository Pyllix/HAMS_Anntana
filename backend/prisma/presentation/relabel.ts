import type { PrismaClient } from '@prisma/client';
import { presentationId, type PresentationFixture } from './fixtures';
import {
  assetLabels,
  documentLabel,
  inventoryLabels,
  partLabels,
  repairLabels,
  sectionLabels,
  supplementalUsers,
} from './labels';
import { readPresentationManifest, type PresentationManifest } from './seed';

/** Cosmetic migration only: keep IDs, states, costs, dates, assignments and quantities. */
export async function relabelPresentation(
  prisma: PrismaClient,
  fixture: PresentationFixture,
): Promise<PresentationManifest> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(90261009)`;
      const manifest = await readPresentationManifest(tx);
      if (!manifest)
        throw new Error(
          'A completed presentation fixture is required before changing labels',
        );
      if (manifest.labelProfile === 'hospital-v1') return manifest;
      const sectionKeys = [...fixture.sections, 'OFFICE'];
      for (const key of sectionKeys) {
        const id = presentationId(`section:${key}`);
        const row = await tx.section.findUnique({ where: { id } });
        if (!row) continue;
        const labels = sectionLabels(key);
        const conflict = await tx.section.findFirst({
          where: { code: labels.code, id: { not: id } },
        });
        if (conflict)
          throw new Error(
            `Section code already belongs to another record: ${labels.code}`,
          );
        await tx.section.update({ where: { id }, data: labels });
      }
      await tx.section.update({
        where: { id: presentationId('section:restore') },
        data: inventoryLabels.restoreSection,
      });
      await tx.company.update({
        where: { id: presentationId('vendor') },
        data: inventoryLabels.vendor,
      });
      await tx.company.update({
        where: { id: presentationId('vendor:restore') },
        data: inventoryLabels.restoreVendor,
      });
      for (const [index, machine] of fixture.assets.entries()) {
        const id = presentationId(`asset:${machine.key}`);
        const labels = assetLabels(machine, index);
        const conflict = await tx.asset.findFirst({
          where: {
            id: { not: id },
            OR: [{ noid: labels.noid }, { serialNo: labels.serialNo }],
          },
        });
        if (conflict)
          throw new Error(
            `Asset identifier already belongs to another record: ${labels.noid}`,
          );
        const current = await tx.asset.findUniqueOrThrow({ where: { id } });
        await tx.asset.update({
          where: { id },
          data: {
            name: labels.name,
            model: labels.model,
            noid: labels.noid,
            serialNo: labels.serialNo,
            acqDoc: labels.acqDoc,
            ...(current.budgetType === 'DEMO · งบสำหรับนำเสนอ' && {
              budgetType: inventoryLabels.budget,
            }),
            ...(current.remark?.startsWith('PRESENTATION V1:') && {
              remark: labels.remark,
            }),
          },
        });
        manifest.rows.find(
          (row) => row.kind === 'asset' && row.id === id,
        )!.document = labels.noid;
      }
      for (const user of fixture.users) {
        const labels = supplementalUsers[user.key];
        if (!labels) continue;
        const id = presentationId(`user:${user.key}`);
        const conflict = await tx.user.findFirst({
          where: { email: labels.email, id: { not: id } },
        });
        if (conflict)
          throw new Error(
            `User email already belongs to another account: ${labels.email}`,
          );
        await tx.user.update({ where: { id }, data: labels });
        await tx.account.updateMany({
          where: { userId: id, providerId: 'credential' },
          data: { accountId: labels.email },
        });
      }
      for (const loan of fixture.borrows) {
        const id = presentationId(`borrow:${loan.key}`);
        const current = await tx.borrowTransaction.findUniqueOrThrow({
          where: { id },
        });
        await tx.borrowTransaction.update({
          where: { id },
          data: {
            ...(current.return_remark?.startsWith('PRESENTATION:') && {
              return_remark:
                current.return_condition === 'Damage'
                  ? 'พบความผิดปกติขณะตรวจรับคืน ส่งตรวจสอบโดยช่าง'
                  : 'ตรวจรับคืนตามรายการส่งมอบ',
            }),
            ...(current.reject_remark?.includes('เดโม') && {
              reject_remark: 'ต้องสำรองเครื่องสำหรับภารกิจฉุกเฉิน',
            }),
            ...(current.cancel_reason?.includes('เดโม') && {
              cancel_reason: 'แผนกมีเครื่องพร้อมใช้งานแล้วจึงขอยกเลิก',
            }),
          },
        });
      }
      await tx.borrowExtension.updateMany({
        where: {
          id: {
            in: fixture.extensions.map((row) =>
              presentationId(`extension:${row.key}`),
            ),
          },
          reason: { contains: 'ข้อมูลเดโม' },
        },
        data: { reason: 'จำเป็นต้องใช้งานต่อเพื่อดูแลผู้ป่วย' },
      });
      for (const [index, job] of fixture.repairs.entries()) {
        const id = presentationId(`repair:${job.key}`);
        const current = await tx.repairJob.findUniqueOrThrow({ where: { id } });
        const labels = repairLabels(
          job.track,
          current.reportType === 'Maintenance',
        );
        await tx.repairJob.update({
          where: { id },
          data: {
            ...(current.symptom?.includes('ตัวอย่างสำหรับนำเสนอ') && {
              symptom: labels.symptom,
            }),
            ...(current.diagnosis === 'ตรวจสอบและเลือกแนวทางดำเนินงานแล้ว' && {
              diagnosis: labels.diagnosis,
            }),
            ...(current.solution?.startsWith('แนวทาง ') && {
              solution: labels.solution,
            }),
            ...(current.billNo?.startsWith('DEMO-BILL-') && {
              billNo: documentLabel('BILL', current.createdAt, index),
            }),
          },
        });
      }
      for (const part of fixture.parts) {
        const row = manifest.rows.find(
          (entry) => entry.kind === 'part' && entry.key === part.key,
        )!;
        const id = Number(row.id);
        const labels = partLabels[part.key];
        const current = await tx.sparepart.findUniqueOrThrow({ where: { id } });
        await tx.sparepart.update({ where: { id }, data: labels });
        await tx.sparepartGroup.updateMany({
          where: { id: current.groupId, name: { startsWith: 'DEMO' } },
          data: { name: inventoryLabels.group },
        });
        row.document = labels.code;
        const adds = await tx.sparepartAdd.findMany({
          where: {
            sparepartId: id,
            sparepartAddDoc: { startsWith: 'DEMO-STOCK-' },
          },
          orderBy: { id: 'asc' },
        });
        for (const add of adds)
          await tx.sparepartAdd.update({
            where: { id: add.id },
            data: {
              sparepartAddDoc: documentLabel('STK', add.createdAt, add.id - 1),
            },
          });
      }
      for (const [index, transfer] of fixture.transfers.entries()) {
        const id = presentationId(`transfer:${transfer.key}`);
        const current = await tx.transfer.findUniqueOrThrow({ where: { id } });
        const document = documentLabel('TF', current.transferDate, index);
        await tx.transfer.update({
          where: { id },
          data: {
            ...(current.transferDocNo.startsWith('DEMO-') && {
              transferDocNo: document,
            }),
            ...(current.fromLocation?.startsWith('DEMO ') && {
              fromLocation: sectionLabels(transfer.from).building,
            }),
            ...(current.toLocation?.startsWith('DEMO ') && {
              toLocation: sectionLabels(transfer.to).building,
            }),
            ...(current.remark === 'ประวัติการโอนตัวอย่าง' && {
              remark: 'โอนย้ายครุภัณฑ์ตามหนังสืออนุมัติของหน่วยงาน',
            }),
          },
        });
        manifest.rows.find(
          (row) => row.kind === 'transfer' && row.id === id,
        )!.document = current.transferDocNo.startsWith('DEMO-')
          ? document
          : current.transferDocNo;
      }
      for (const [index, disposal] of fixture.disposals.entries()) {
        const id = presentationId(`disposal:${disposal.key}`);
        const current = await tx.disposal.findUniqueOrThrow({ where: { id } });
        if (!current.disposalDocNo.startsWith('DEMO-')) continue;
        const document = documentLabel('DSP', current.approvedDate, index);
        await tx.disposal.update({
          where: { id },
          data: { disposalDocNo: document },
        });
        manifest.rows.find(
          (row) => row.kind === 'disposal' && row.id === id,
        )!.document = document;
      }
      await tx.acqType.updateMany({
        where: { name: 'DEMO · วิธีได้มาสำหรับกู้คืน' },
        data: {
          name: inventoryLabels.restoreAcquisition,
          description: 'รับโอนครุภัณฑ์จากหน่วยงานภาครัฐตามหนังสือส่งมอบ',
        },
      });
      await tx.budgetType.updateMany({
        where: { name: 'DEMO · งบสำหรับนำเสนอ' },
        data: {
          name: inventoryLabels.budget,
          description: 'งบพัฒนาศักยภาพเครื่องมือสำหรับให้บริการผู้ป่วย',
        },
      });
      await tx.budgetType.updateMany({
        where: { name: 'DEMO · งบปิดใช้งาน' },
        data: {
          name: inventoryLabels.inactiveBudget,
          description: 'งบดำเนินการปรับปรุงอุปกรณ์ในปีงบประมาณที่ผ่านมา',
        },
      });
      manifest.labelProfile = 'hospital-v1';
      await tx.company.update({
        where: { id: presentationId('marker') },
        data: {
          name: 'ระบบทะเบียนครุภัณฑ์ส่วนกลาง',
          group: 'SYSTEM',
          remark: JSON.stringify(manifest),
        },
      });
      return manifest;
    },
    { maxWait: 10000, timeout: 120000, isolationLevel: 'Serializable' },
  );
}
