import 'dotenv/config';
import { PrismaClient, StepActionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { Prisma } from '@prisma/client';

const assetStatuses = [
  { code: 'NORMAL', name: 'ใช้งานปกติ' },
  { code: 'DAMAGED', name: 'ชำรุด' },
  { code: 'UNDER_REPAIR', name: 'อยู่ระหว่างซ่อม' },
  { code: 'WAIT_DISPOSAL', name: 'รอจำหน่าย' },
  { code: 'DISPOSAL', name: 'จำหน่ายแล้ว' },
  { code: 'LOST', name: 'สูญหาย' },
];

const availabilityStatuses = [
  { code: 'AVAILABLE', name: 'ว่าง/พร้อมใช้งาน' },
  { code: 'RESERVED', name: 'ถูกจอง / รออนุมัติ' },
  { code: 'BORROWED', name: 'ถูกยืม' },
  { code: 'UNAVAILABLE', name: 'ไม่พร้อมใช้งาน' },
];

const borrowStatuses = [
  { code: 'PENDING_APPROVE', name: 'รออนุมัติ' },
  { code: 'APPROVED', name: 'อนุมัติแล้ว/รอส่งมอบ' },
  { code: 'BORROWED', name: 'กำลังยืม' },
  { code: 'PENDING_RETURN', name: 'รอรับคืน' },
  { code: 'IN_PICKUP', name: 'กำลังไปรับเครื่อง' },
  { code: 'RETURNED', name: 'คืนแล้ว' },
  { code: 'REJECTED', name: 'ปฏิเสธ' },
  { code: 'CANCELLED', name: 'ยกเลิก' },
];

const assetTypes = [
  { name: 'เครื่องมือแพทย์', useful_life: 5 },
  { name: 'คอมพิวเตอร์และอุปกรณ์', useful_life: 3 },
  { name: 'เฟอร์นิเจอร์', useful_life: 10 },
  { name: 'ยานพาหนะ', useful_life: 8 },
  { name: 'อุปกรณ์สื่อสารและโสตทัศนูปกรณ์', useful_life: 5 },
];

const acquisitionTypes = [
  { name: 'ติดมากับตึก', description: 'ครุภัณฑ์ที่ติดตั้งพร้อมการส่งมอบอาคารสถานที่' },
  { name: 'รับโอน', description: 'รับโอนจากหน่วยงานอื่นหรือกระทรวงสาธารณสุข' },
  { name: 'ระเบียบเงินบริจาค', description: 'จัดหาตามระเบียบเงินบริจาคของโรงพยาบาล' },
  { name: 'คัดเลือก', description: 'จัดซื้อจัดจ้างโดยวิธีคัดเลือก' },
  { name: 'ไม่ระบุ', description: 'ไม่ระบุวิธีการได้มา' },
  { name: 'เฉพาะเจาะจง', description: 'จัดซื้อจัดจ้างโดยวิธีเฉพาะเจาะจง' },
  { name: 'ประกวดราคาอิเล็กทรอนิกส์(e-bidding)', description: 'จัดซื้อจัดจ้างด้วยวิธีประกวดราคาอิเล็กทรอนิกส์' },
  { name: 'ได้รับสนับสนุน', description: 'ได้รับการสนับสนุนจากโครงการหรือองค์กรภายนอก' },
  { name: 'ตกลงราคา', description: 'จัดซื้อจัดจ้างโดยวิธีตกลงราคา' },
  { name: 'ประกวดราคา', description: 'จัดซื้อจัดจ้างโดยวิธีประกวดราคา' },
  { name: 'สอบราคา', description: 'จัดซื้อจัดจ้างโดยวิธีสอบราคา' },
  { name: 'ประมูลอิเล็กทรอนิกส์', description: 'จัดซื้อจัดจ้างโดยวิธีประมูลอิเล็กทรอนิกส์' },
  { name: 'ช่างรพ.ทำเอง', description: 'สิ่งประดิษฐ์หรือครุภัณฑ์ที่โรงพยาบาลสร้างขึ้นเอง' },
  { name: 'ของแถม', description: 'ได้รับเป็นของแถมจากการจัดซื้อรายการอื่น' },
  { name: 'บริจาค', description: 'ได้รับบริจาคจากบุคคลหรือองค์กร' },
  { name: 'ยืม', description: 'ยืมใช้งานจากหน่วยงานภายนอกหรือบริษัทคู่ค้า' },
];

const equipmentTypes = [
  { name: 'เครื่องมือช่วยชีวิต', description: 'อุปกรณ์สำหรับกู้ชีพและติดตามสัญญาณชีพ' },
  { name: 'เครื่องมือเพื่อการรักษา', description: 'อุปกรณ์ที่ใช้ในกระบวนการรักษาและหัตถการ' },
  { name: 'เครื่องมือตรวจวัด/วินิจฉัย', description: 'อุปกรณ์สำหรับตรวจวัด วิเคราะห์ และวินิจฉัย' },
  { name: 'เครื่องมือฟื้นฟูสภาพ', description: 'อุปกรณ์เวชศาสตร์ฟื้นฟูและกายภาพบำบัด' },
  { name: 'เครื่องมือสนับสนุน', description: 'อุปกรณ์สนับสนุนทางการแพทย์และห้องปฏิบัติการ' },
  { name: 'อุปกรณ์อำนวยความสะดวก', description: 'อุปกรณ์อำนวยความสะดวกสำหรับผู้ป่วยและบุคลากร' },
];

const jobStatuses = [
  { code: 'WAITING_HANDOVER', name: 'รอรับเครื่องจากหน่วยงาน' },
  { code: 'PENDING_ASSIGN', name: 'รอมอบหมายงานให้ช่าง' },
  { code: 'IN_PROGRESS', name: 'ช่างกำลังดำเนินการซ่อม' },
  { code: 'WAITING_PARTS', name: 'สั่งซื้อ/รออะไหล่' },
  { code: 'PARCEL_PROCESSING', name: 'พัสดุกำลังดำเนินการ' },
  { code: 'OUTSOURCED', name: 'ส่งซ่อมบริษัทภายนอก' },
  { code: 'UNREPAIRABLE', name: 'แทงชำรุด/เห็นควรจำหน่าย' },
  { code: 'WAITING_DELIVERY', name: 'เสร็จแล้วรอรับคืน' },
  { code: 'COMPLETED', name: 'ส่งคืน/ดำเนินการเรียบร้อย' },
  { code: 'CANCELLED', name: 'ยกเลิกงานซ่อม' },
];

const jobTypes = [
  'ซ่อมเครื่องมือแพทย์',
  'ซ่อมบำรุงทั่วไป',
  'ซ่อมคอมพิวเตอร์',
];

const causes = [
  { code: '01', name: 'เครื่องไม่มีคุณภาพ' },
  { code: '02', name: 'การติดตั้งไม่เรียบร้อย' },
  { code: '03', name: 'ผู้ใช้ขาดความเข้าใจ' },
  { code: '04', name: 'สภาวะแวดล้อม' },
  { code: '05', name: 'อายุการใช้งานนาน' },
  { code: '06', name: 'ความถี่การใช้งานสูง' },
  { code: '07', name: 'การบำรุงรักษาไม่ดีพอ' },
  { code: '08', name: 'ซ่อมเพื่อปรับปรุงพัฒนา' },
  { code: '09', name: 'ตรวจเช็คตามระยะเวลา' },
  { code: '10', name: 'ส่งสอบเทียบ' },
  { code: '11', name: 'แจ้งรายชื่อครุภัณฑ์รับใหม่/โอน/แทงจำหน่าย' },
  { code: '12', name: 'ของไม่มีคุณภาพ' },
  { code: '13', name: 'ขออนุมัติจัดทำเพื่อปรับปรุงหรือพัฒนา' },
  { code: '14', name: 'เกิดจากผู้ใช้งาน' },
  { code: '15', name: 'อุปกรณ์เสื่อมคุณภาพ' },
  { code: '16', name: 'Software มีปัญหา/ไม่สมบูรณ์' },
  { code: '17', name: 'สมควรแทงจำหน่าย' },
  { code: '18', name: 'Hardware ชำรุด' },
  { code: '19', name: 'ระบบ Network ชำรุด' },
];

const techCategories = [
  { code: 'MED_EQ', name: 'งานเครื่องมือแพทย์' },
  { code: 'AIR_CON', name: 'งานเครื่องปรับอากาศ' },
  { code: 'PLUMBING', name: 'งานประปา' },
  { code: 'CONSTRUCT', name: 'งานก่อสร้าง' },
  { code: 'ALUMINIUM', name: 'งานอะลูมิเนียม' },
  { code: 'ELECTRICAL', name: 'งานไฟฟ้า' },
  { code: 'IT_HW_SW', name: 'งานระบบคอมพิวเตอร์Hardware&Software' },
  { code: 'METAL_OFFICE', name: 'งานโลหะและครุภัณฑ์สำนักงาน' },
  { code: 'ELECTRONIC', name: 'งานอิเล็กทรอนิกส์' },
];

const stepMasterTemplates: {
  stepNumber: number;
  actionType: StepActionType;
  label: string;
}[] = [
  { stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
  { stepNumber: 2, actionType: StepActionType.SELF_REPAIR, label: 'หัวหน้าช่าง Triage & จ่ายงาน' },
  { stepNumber: 3, actionType: StepActionType.SELF_REPAIR, label: 'ช่างตรวจเช็ค & วินิจฉัย' },
  { stepNumber: 4, actionType: StepActionType.SELF_REPAIR, label: 'ซ่อมเองและทดสอบ' },
  { stepNumber: 5, actionType: StepActionType.SELF_REPAIR, label: 'แล้วเสร็จ / รอส่งมอบ' },
  { stepNumber: 6, actionType: StepActionType.SELF_REPAIR, label: 'ตรวจรับและปิด Job' },
  { stepNumber: 1, actionType: StepActionType.WITH_PARTS, label: 'วันแจ้งซ่อม' },
  { stepNumber: 2, actionType: StepActionType.WITH_PARTS, label: 'หัวหน้าช่าง Triage & จ่ายงาน' },
  { stepNumber: 3, actionType: StepActionType.WITH_PARTS, label: 'ช่างตรวจเช็ค & วินิจฉัย' },
  { stepNumber: 4, actionType: StepActionType.WITH_PARTS, label: 'ขอเบิกอะไหล่ (ผสม In/Out)' },
  { stepNumber: 5, actionType: StepActionType.WITH_PARTS, label: 'พัสดุจ่ายของ/สั่งซื้อภายนอก' },
  { stepNumber: 6, actionType: StepActionType.WITH_PARTS, label: 'ช่างรับอะไหล่ & ลงมือซ่อม' },
  { stepNumber: 7, actionType: StepActionType.WITH_PARTS, label: 'แล้วเสร็จ / รอส่งมอบ' },
  { stepNumber: 8, actionType: StepActionType.WITH_PARTS, label: 'ตรวจรับและปิด Job' },
  { stepNumber: 1, actionType: StepActionType.OUTSOURCE, label: 'วันแจ้งซ่อม' },
  { stepNumber: 2, actionType: StepActionType.OUTSOURCE, label: 'หัวหน้าช่าง Triage & จ่ายงาน' },
  { stepNumber: 3, actionType: StepActionType.OUTSOURCE, label: 'ช่างตรวจเช็ค & วินิจฉัย' },
  { stepNumber: 4, actionType: StepActionType.OUTSOURCE, label: 'ขอส่งซ่อมภายนอก (พัสดุจัดจ้าง)' },
  { stepNumber: 5, actionType: StepActionType.OUTSOURCE, label: 'พัสดุส่งบริษัทภายนอกซ่อม' },
  { stepNumber: 6, actionType: StepActionType.OUTSOURCE, label: 'รับเครื่องคืนและทดสอบ' },
  { stepNumber: 7, actionType: StepActionType.OUTSOURCE, label: 'แล้วเสร็จ / รอส่งมอบ' },
  { stepNumber: 8, actionType: StepActionType.OUTSOURCE, label: 'ตรวจรับและปิด Job' },
  { stepNumber: 1, actionType: StepActionType.UNREPAIRABLE, label: 'วันแจ้งซ่อม' },
  { stepNumber: 2, actionType: StepActionType.UNREPAIRABLE, label: 'หัวหน้าช่าง Triage & จ่ายงาน' },
  { stepNumber: 3, actionType: StepActionType.UNREPAIRABLE, label: 'ช่างตรวจเช็ค & วินิจฉัย' },
  { stepNumber: 4, actionType: StepActionType.UNREPAIRABLE, label: 'ยื่นเรื่องแทงชำรุด' },
  { stepNumber: 5, actionType: StepActionType.UNREPAIRABLE, label: 'ช่างนำส่งเครื่องที่ห้องพัสดุ' },
  { stepNumber: 6, actionType: StepActionType.UNREPAIRABLE, label: 'พัสดุกดยืนยันรับมอบเครื่อง' },
  { stepNumber: 7, actionType: StepActionType.UNREPAIRABLE, label: 'สรุปส่งมอบเข้าคลังพัก' },
  { stepNumber: 8, actionType: StepActionType.UNREPAIRABLE, label: 'ปรับเป็น WAIT_DISPOSAL' },
];

let seedStage = 'connection';

async function seedReferenceData(tx: Prisma.TransactionClient): Promise<void> {
  seedStage = 'advisory-lock';
  await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(90260926)`;

  seedStage = 'asset-statuses';
  for (const status of assetStatuses) {
    await tx.assetStatus.upsert({
      where: { code: status.code },
      update: { name: status.name },
      create: status,
    });
  }

  seedStage = 'availability-statuses';
  for (const status of availabilityStatuses) {
    await tx.availabilityStatus.upsert({
      where: { code: status.code },
      update: { name: status.name },
      create: status,
    });
  }

  seedStage = 'borrow-statuses';
  for (const status of borrowStatuses) {
    await tx.borrowStatus.upsert({
      where: { code: status.code },
      update: { name: status.name },
      create: status,
    });
  }

  seedStage = 'asset-types';
  for (const type of assetTypes) {
    const existing = await tx.assetType.findFirst({
      where: { name: type.name },
      select: { id: true },
    });
    if (!existing) await tx.assetType.create({ data: type });
  }

  seedStage = 'acquisition-types';
  for (const type of acquisitionTypes) {
    const existing = await tx.acqType.findFirst({
      where: { name: type.name },
      select: { id: true },
    });
    if (!existing) {
      await tx.acqType.create({ data: { ...type, isActive: true } });
    }
  }

  seedStage = 'equipment-types';
  for (const type of equipmentTypes) {
    const existing = await tx.equipmentType.findFirst({
      where: { name: type.name },
      select: { id: true },
    });
    if (!existing) await tx.equipmentType.create({ data: type });
  }

  seedStage = 'job-statuses';
  for (const status of jobStatuses) {
    await tx.jobStatus.upsert({
      where: { code: status.code },
      update: { name: status.name },
      create: status,
    });
  }

  seedStage = 'job-types';
  for (const name of jobTypes) {
    const existing = await tx.jobType.findFirst({
      where: { name },
      select: { id: true },
    });
    if (!existing) await tx.jobType.create({ data: { name } });
  }

  seedStage = 'causes';
  for (const cause of causes) {
    const existing = await tx.cause.findFirst({
      where: { code: cause.code },
      select: { id: true },
    });
    if (!existing) await tx.cause.create({ data: cause });
  }

  seedStage = 'tech-categories';
  for (const category of techCategories) {
    const existing = await tx.techCategory.findFirst({
      where: { code: category.code },
      select: { id: true },
    });
    if (!existing) {
      await tx.techCategory.create({ data: { ...category, isActive: true } });
    }
  }

  seedStage = 'step-master';
  for (const step of stepMasterTemplates) {
    const existing = await tx.stepMaster.findFirst({
      where: { stepNumber: step.stepNumber, actionType: step.actionType },
      select: { id: true },
    });
    if (!existing) await tx.stepMaster.create({ data: step });
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await prisma.$transaction(seedReferenceData, {
      maxWait: 10_000,
      timeout: 120_000,
    });
    console.info('Production reference data is ready. No demo records were loaded.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : error instanceof Error
        ? error.name
        : 'unknown';
  console.error(
    `Production reference seeding failed at ${seedStage} (code: ${code}). No demo seed was run.`,
  );
  process.exitCode = 1;
});
