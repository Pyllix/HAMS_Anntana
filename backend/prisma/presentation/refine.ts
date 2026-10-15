import { Prisma, type PrismaClient } from '@prisma/client';
import {
  buildPresentationFixture,
  presentationDate,
  presentationId,
} from './fixtures';
import { assetLabels, repairLabels } from './labels';
import { readPresentationManifest } from './seed';
import { isExpandedScenario } from './scenarios';

const equalDate = (a: Date | null, b: Date | null) =>
  a?.getTime() === b?.getTime();
const originalSymptoms = [
  'เปิดเครื่องแล้วดับเองระหว่างใช้งาน ต้องตรวจสอบระบบจ่ายไฟ',
  'ค่าที่อ่านได้คลาดเคลื่อนจากอุปกรณ์อ้างอิง ขอให้ตรวจสอบและสอบเทียบ',
  'มีสัญญาณเตือนต่อเนื่องหลังทำความสะอาดและตรวจการเชื่อมต่อ',
  'หน้าจอแสดงผลติด ๆ ดับ ๆ ทำให้ไม่สามารถใช้งานกับผู้ป่วยได้',
  'อุปกรณ์ผ่านการใช้งานต่อเนื่อง ขอรับบริการตรวจเช็กความปลอดภัย',
];

/** Explicit cosmetic/date migration. Only unchanged v2 seed defaults are eligible. */
export async function refinePresentationVariety(
  prisma: PrismaClient,
  dryRun = false,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(90261009)`;
      const manifest = await readPresentationManifest(tx);
      if (!manifest)
        throw new Error('Seed presentation data before varying it');
      const fixture = buildPresentationFixture(
        presentationDate(manifest.expansionDate ?? manifest.date),
      );
      const d = (days: number) =>
        new Date(fixture.date.getTime() + days * 86_400_000);
      const ids = (kind: string) =>
        manifest.rows
          .filter((row) => row.kind === kind && isExpandedScenario(row.key))
          .map((row) => String(row.id));
      const [assets, loans, extensions, jobs] = await Promise.all([
        tx.asset.findMany({ where: { id: { in: ids('asset') } } }),
        tx.borrowTransaction.findMany({
          where: { id: { in: ids('borrow') } },
          include: { borrowStatus: true, extensions: true },
        }),
        tx.borrowExtension.findMany({
          where: { id: { in: ids('extension') } },
        }),
        tx.repairJob.findMany({
          where: { id: { in: ids('repair') } },
          include: { jobStatus: true, repairJobSteps: true },
        }),
      ]);
      const assetById = new Map(assets.map((row) => [row.id, row]));
      const loanById = new Map(loans.map((row) => [row.id, row]));
      const extensionById = new Map(extensions.map((row) => [row.id, row]));
      const jobById = new Map(jobs.map((row) => [row.id, row]));
      const assetPlans: {
        id: string;
        old_name: string;
        old_model: string;
        name: string;
        model: string;
      }[] = [];
      const loanPlans: {
        id: string;
        status_id: number;
        old_method: string;
        old_expected: Date | null;
        method: string;
        expected: Date | null;
      }[] = [];
      const extensionPlans: {
        id: string;
        updated: Date;
        current_due: Date;
        requested_due: Date;
        reason: string;
        reject_reason: string | null;
      }[] = [];
      const repairPlans: {
        id: string;
        updated: Date;
        symptom: string | null;
        diagnosis: string | null;
        solution: string | null;
      }[] = [];
      const skipped: string[] = [];
      for (const [index, asset] of fixture.assets.entries()) {
        const actual = assetById.get(presentationId(`asset:${asset.key}`));
        if (!actual) continue;
        const old = assetLabels(asset, index, false);
        if (
          !(
            (actual.name === old.name || actual.name === asset.name) &&
            (actual.model === old.model || actual.model === asset.model)
          )
        ) {
          skipped.push(`asset:${asset.key}`);
          continue;
        }
        if (actual.name !== asset.name || actual.model !== asset.model)
          assetPlans.push({
            id: actual.id,
            old_name: actual.name,
            old_model: actual.model,
            name: asset.name,
            model: asset.model,
          });
      }
      for (const loan of fixture.borrows.filter((row) =>
        isExpandedScenario(row.key),
      )) {
        const actual = loanById.get(presentationId(`borrow:${loan.key}`));
        if (!actual) continue;
        if (actual.borrowStatus.code !== loan.status) {
          skipped.push(`borrow:${loan.key}`);
          continue;
        }
        const requests = fixture.extensions.filter(
          (row) => row.borrow === loan.key,
        );
        const oldExpected = d(
          loan.key.endsWith('-overdue')
            ? -3
            : loan.key.endsWith('-due-soon')
              ? 1
              : requests.some((row) => row.status === 'APPROVED')
                ? 11
                : 4,
        );
        const oldMethod =
          loan.key.endsWith('-loan-APPROVED') ||
          loan.key.endsWith('-center-loan')
            ? 'DELIVERY'
            : 'PICKUP';
        const canChangeDate =
          (equalDate(actual.expectedReturnDate, oldExpected) ||
            equalDate(actual.expectedReturnDate, loan.expectedReturn)) &&
          (!actual.handover_date ||
            loan.expectedReturn >= actual.handover_date) &&
          actual.extensions.length === requests.length &&
          requests.every((request) => {
            const ext = extensionById.get(
              presentationId(`extension:${request.key}`),
            );
            return (
              ext &&
              ext.status === request.status &&
              ((equalDate(ext.currentReturnDate, d(4)) &&
                equalDate(ext.requestedReturnDate, d(11))) ||
                (equalDate(ext.currentReturnDate, request.currentDate) &&
                  equalDate(ext.requestedReturnDate, request.requestedDate)))
            );
          });
        const nextExpected = canChangeDate
          ? loan.expectedReturn
          : actual.expectedReturnDate;
        const nextMethod =
          actual.delivery_method === oldMethod ||
          actual.delivery_method === loan.delivery
            ? loan.delivery
            : actual.delivery_method;
        if (!canChangeDate) skipped.push(`borrow-date:${loan.key}`);
        if (
          nextMethod !== actual.delivery_method ||
          !equalDate(nextExpected, actual.expectedReturnDate)
        )
          loanPlans.push({
            id: actual.id,
            status_id: actual.borrow_status_id,
            old_method: actual.delivery_method,
            old_expected: actual.expectedReturnDate,
            method: nextMethod,
            expected: nextExpected,
          });
        if (canChangeDate)
          for (const request of requests) {
            const ext = extensionById.get(
              presentationId(`extension:${request.key}`),
            )!;
            const reason =
              ext.reason === 'จำเป็นต้องใช้งานต่อเพื่อดูแลผู้ป่วย'
                ? (request.reason ?? ext.reason)
                : ext.reason;
            const rejectReason =
              ext.rejectReason === 'ต้องสำรองเครื่องสำหรับแผนกอื่น'
                ? (request.rejectReason ?? ext.rejectReason)
                : ext.rejectReason;
            if (
              !equalDate(ext.currentReturnDate, request.currentDate) ||
              !equalDate(ext.requestedReturnDate, request.requestedDate) ||
              reason !== ext.reason ||
              rejectReason !== ext.rejectReason
            )
              extensionPlans.push({
                id: ext.id,
                updated: ext.updatedAt,
                current_due: request.currentDate,
                requested_due: request.requestedDate,
                reason,
                reject_reason: rejectReason,
              });
          }
      }
      for (const [index, job] of fixture.repairs.entries()) {
        const actual = jobById.get(presentationId(`repair:${job.key}`));
        if (!actual) continue;
        const asset = fixture.assets.find((row) => row.key === job.asset)!;
        const actualAsset = assetById.get(actual.assetId);
        if (
          actual.jobStatus.code !== job.status ||
          actual.repairJobSteps.filter((row) => row.completeAt).length !==
            job.completedSteps ||
          !actualAsset ||
          (!assetPlans.some((plan) => plan.id === actualAsset.id) &&
            actualAsset.name !== asset.name)
        ) {
          skipped.push(`repair:${job.key}`);
          continue;
        }
        const oldText = repairLabels(job.track, job.maintenance);
        const oldSymptom = job.maintenance
          ? 'ถึงกำหนดตรวจเช็กสภาพและทดสอบความปลอดภัยประจำรอบ'
          : job.status === 'CANCELLED'
            ? 'แผนกตรวจสอบแล้วพบว่าปลั๊กต่อไม่แน่น และทดสอบใช้งานได้ปกติ จึงขอยกเลิกรายการ'
            : originalSymptoms[index % originalSymptoms.length];
        const symptom =
          actual.symptom === oldSymptom
            ? (job.symptom ?? actual.symptom)
            : actual.symptom;
        const diagnosis =
          actual.diagnosis === oldText.diagnosis
            ? (job.diagnosis ?? actual.diagnosis)
            : actual.diagnosis;
        const solution =
          actual.solution === oldText.solution
            ? (job.solution ?? actual.solution)
            : actual.solution;
        if (
          symptom !== actual.symptom ||
          diagnosis !== actual.diagnosis ||
          solution !== actual.solution
        )
          repairPlans.push({
            id: actual.id,
            updated: actual.updatedAt,
            symptom,
            diagnosis,
            solution,
          });
      }
      const changed = {
        assets: assetPlans.length,
        borrows: loanPlans.length,
        extensions: extensionPlans.length,
        repairs: repairPlans.length,
      };
      if (
        dryRun ||
        (!Object.values(changed).some(Boolean) &&
          manifest.varietyProfile === 'varied-v1')
      )
        return { changed, skipped, dryRun };
      const assertCount = (count: number, expected: number) => {
        if (count !== expected)
          throw new Error(
            'Demo records changed during refinement; the transaction was rolled back',
          );
      };
      if (assetPlans.length)
        assertCount(
          await tx.$executeRaw`
      UPDATE asset a SET name=v.name, model=v.model, updated_at=timezone('UTC',now())
      FROM jsonb_to_recordset(${JSON.stringify(assetPlans)}::jsonb) AS v(id text,old_name text,old_model text,name text,model text)
      WHERE a.asset_id=v.id AND a.name=v.old_name AND a.model=v.old_model`,
          assetPlans.length,
        );
      if (loanPlans.length)
        assertCount(
          await tx.$executeRaw`
      UPDATE borrow_transaction b SET delivery_method=v.method::"DeliveryMethod", expected_return_date=v.expected
      FROM jsonb_to_recordset(${JSON.stringify(loanPlans)}::jsonb) AS v(id text,status_id integer,old_method text,old_expected timestamp,method text,expected timestamp)
      WHERE b.borrow_transaction_id=v.id AND b.borrow_status_id=v.status_id AND b.delivery_method::text=v.old_method
        AND b.expected_return_date IS NOT DISTINCT FROM v.old_expected`,
          loanPlans.length,
        );
      if (extensionPlans.length)
        assertCount(
          await tx.$executeRaw`
      UPDATE borrow_extension e SET current_return_date=v.current_due, requested_return_date=v.requested_due,
        reason=v.reason, reject_reason=v.reject_reason, updated_at=timezone('UTC',now())
      FROM jsonb_to_recordset(${JSON.stringify(extensionPlans)}::jsonb) AS v(id text,updated timestamp,current_due timestamp,requested_due timestamp,reason text,reject_reason text)
      WHERE e.borrow_extension_id=v.id AND e.updated_at=v.updated`,
          extensionPlans.length,
        );
      if (repairPlans.length)
        assertCount(
          await tx.$executeRaw`
      UPDATE repair_job j SET symptom=v.symptom, diagnosis=v.diagnosis, solution=v.solution, updated_at=timezone('UTC',now())
      FROM jsonb_to_recordset(${JSON.stringify(repairPlans)}::jsonb) AS v(id text,updated timestamp,symptom text,diagnosis text,solution text)
      WHERE j.job_id=v.id AND j.updated_at=v.updated`,
          repairPlans.length,
        );
      manifest.varietyProfile = 'varied-v1';
      await tx.company.update({
        where: { id: presentationId('marker') },
        data: { remark: JSON.stringify(manifest) },
      });
      return { changed, skipped, dryRun };
    },
    { isolationLevel: 'Serializable', maxWait: 10000, timeout: 120000 },
  );
}
