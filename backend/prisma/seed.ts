/**
 * Prisma Seed Script — Mock data ครอบคลุมทั้งระบบ
 *
 * Run with:
 *   pnpm tsx prisma/seed.ts
 */

import 'dotenv/config';
import { PrismaClient, RiskLevel, PmType, CalType, StepActionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Data Definitions ─────────────────────────────────────────────────────────

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

const acqTypes = [
  { name: 'ติดมากับตึก', description: 'ครุภัณฑ์ที่ติดตั้งพร้อมการส่งมอบอาคารสถานที่', isActive: true },
  { name: 'รับโอน', description: 'รับโอนจากหน่วยงานอื่นหรือกระทรวงสาธารณสุข', isActive: true },
  { name: 'ระเบียบเงินบริจาค', description: 'จัดหาตามระเบียบเงินบริจาคของโรงพยาบาล', isActive: true },
  { name: 'คัดเลือก', description: 'จัดซื้อจัดจ้างโดยวิธีคัดเลือก', isActive: true },
  { name: 'ไม่ระบุ', description: 'ไม่ระบุวิธีการได้มา', isActive: true },
  { name: 'เฉพาะเจาะจง', description: 'จัดซื้อจัดจ้างโดยวิธีเฉพาะเจาะจง', isActive: true },
  { name: 'ประกวดราคาอิเล็กทรอนิกส์(e-bidding)', description: 'จัดซื้อจัดจ้างด้วยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)', isActive: true },
  { name: 'ได้รับสนับสนุน', description: 'ได้รับการสนับสนุนจากโครงการหรือองค์กรภายนอก', isActive: true },
  { name: 'ตกลงราคา', description: 'จัดซื้อจัดจ้างโดยวิธีตกลงราคา (ระเบียบเดิม)', isActive: true },
  { name: 'ประกวดราคา', description: 'จัดซื้อจัดจ้างโดยวิธีประกวดราคา', isActive: true },
  { name: 'สอบราคา', description: 'จัดซื้อจัดจ้างโดยวิธีสอบราคา', isActive: true },
  { name: 'ประมูลอิเล็กทรอนิกส์', description: 'จัดซื้อจัดจ้างโดยวิธีประมูลอิเล็กทรอนิกส์ (e-Auction)', isActive: true },
  { name: 'ช่างรพ.ทำเอง', description: 'สิ่งประดิษฐ์หรือครุภัณฑ์ที่ฝ่ายช่างโรงพยาบาลสร้างขึ้นเอง', isActive: true },
  { name: 'ของแถม', description: 'ได้รับเป็นของแถมพ่วงจากการจัดซื้อเวชภัณฑ์หรือครุภัณฑ์อื่น', isActive: true },
  { name: 'บริจาค', description: 'ได้รับบริจาคจากผู้มีจิตศรัทธา ภาคเอกชน หรือมูลนิธิ', isActive: true },
  { name: 'ยืม', description: 'ยืมใช้งานจากหน่วยงานภายนอกหรือบริษัทคู่ค้า', isActive: true },
];

const budgetTypes = [
  { name: 'งบค่าเสื่อม ปี 2558', fiscalYear: 2558, description: 'งบประมาณค่าเสื่อมราคาประจำปี 2558', isActive: false },
  { name: 'งบค่าเสื่อม ปี 2565', fiscalYear: 2565, description: 'งบประมาณค่าเสื่อมราคาประจำปี 2565', isActive: true },
  { name: 'งบค่าเสื่อม ปี 2566', fiscalYear: 2566, description: 'งบประมาณค่าเสื่อมราคาประจำปี 2566', isActive: true },
  { name: 'เงินงบประมาณแผ่นดิน ปี 2567', fiscalYear: 2567, description: 'เงินงบประมาณจัดสรรประจำปี 2567', isActive: true },
  { name: 'งบลงทุนและพัฒนา ปี 2567', fiscalYear: 2567, description: 'งบเพื่อการลงทุนพัฒนาศักยภาพโรงพยาบาล', isActive: true },
  { name: 'เงินนอกงบประมาณ', fiscalYear: null, description: 'เงินรายรับที่ไม่ได้อยู่ในระบบงบประมาณประจำปี', isActive: true },
  { name: 'เงินบำรุงโรงพยาบาล (ไม่ระบุปี)', fiscalYear: null, description: 'เงินรายได้สะสมของโรงพยาบาล', isActive: true },
  { name: 'เงินบริจาคมูลนิธิโรงพยาบาล', fiscalYear: null, description: 'เงินกองทุนบริจาคเพื่อช่วยเหลือผู้ป่วย', isActive: true },
];

const equipmentTypes = [
  { name: 'เครื่องมือช่วยชีวิต', description: 'อุปกรณ์และเครื่องมือสำหรับการกู้ชีพและติดตามสัญญาณชีพขั้นวิกฤต' },
  { name: 'เครื่องมือเพื่อการรักษา', description: 'อุปกรณ์และเครื่องมือทางการแพทย์ที่ใช้ในกระบวนการรักษาและทำหัตถการ' },
  { name: 'เครื่องมือตรวจวัด/วินิจฉัย', description: 'อุปกรณ์สำหรับตรวจวัด ตรวจวิเคราะห์ และวินิจฉัยโรค' },
  { name: 'เครื่องมือฟื้นฟูสภาพ', description: 'อุปกรณ์สำหรับเวชศาสตร์ฟื้นฟู กายภาพบำบัด และกิจกรรมบำบัด' },
  { name: 'เครื่องมือสนับสนุน', description: 'อุปกรณ์สนับสนุนทางการแพทย์ การฆ่าเชื้อ และระบบห้องปฏิบัติการ' },
  { name: 'อุปกรณ์อำนวยความสะดวก', description: 'อุปกรณ์สิ่งอำนวยความสะดวกสำหรับผู้ป่วยและบุคลากรทางการแพทย์' },
];

const companies = [
  { code: 'COMP001', name: 'บริษัท เมดิคอลซัพพลาย จำกัด', tel: '02-111-1111', email: 'contact@medical.co.th', address: '123 ถ.พหลโยธิน กรุงเทพฯ', fax: '02-111-1112', group: 'MEDICAL_EQUIPMENT', remark: 'คู่ค้าหลักด้านเครื่องมือแพทย์' },
  { code: 'COMP002', name: 'บริษัท ไอที โซลูชั่น จำกัด', tel: '02-222-2222', email: 'sales@itsolution.co.th', address: '456 ถ.สีลม กรุงเทพฯ', fax: '02-222-2223', group: 'IT_HARDWARE', remark: 'ผู้จัดจำหน่ายคอมพิวเตอร์และระบบเครือข่าย' },
  { code: 'COMP003', name: 'บริษัท ไทยเมดิคอลเทค จำกัด', tel: '02-333-3333', email: 'info@thaimedtech.com', address: '789 ถ.สุขุมวิท กรุงเทพฯ', fax: '02-333-3334', group: 'MAINTENANCE_PROVIDER', remark: 'ผู้เชี่ยวชาญบริการสอบเทียบและซ่อมบำรุง' },
  { code: 'COMP004', name: 'บริษัท พรีเมียร์ฮอสพิทอลแคร์ จำกัด', tel: '02-444-4444', email: 'care@premierhospital.co.th', address: '101 ถ.พระราม 9 กรุงเทพฯ', fax: '02-444-4445', group: 'HOSPITAL_FURNITURE', remark: 'ผู้ผลิตเตียงและเฟอร์นิเจอร์ผู้ป่วย' },
];

const sections = [
  { code: 'CENTER', name: 'ศูนย์บริการและซ่อมบำรุงครุภัณฑ์กลาง (Asset Center)', tel: '1000', building: 'อาคารสนับสนุนทางการแพทย์ ชั้น 1' },
  { code: 'IT', name: 'ศูนย์เทคโนโลยีสารสนเทศ (IT Department)', tel: '1234', building: 'อาคารบริหาร ชั้น 3' },
  { code: 'PARCEL', name: 'ฝ่ายพัสดุและจัดซื้อ (Parcel Department)', tel: '1050', building: 'อาคารบริหาร ชั้น 2' },
  { code: 'OPD', name: 'แผนกผู้ป่วยนอก (Outpatient Department)', tel: '1100', building: 'อาคารผู้ป่วยนอก ชั้น 1' },
  { code: 'ICU', name: 'แผนกผู้ป่วยวิกฤต (Intensive Care Unit)', tel: '1200', building: 'อาคารเฉลิมพระเกียรติ ชั้น 4' },
  { code: 'ER', name: 'แผนกอุบัติเหตุและฉุกเฉิน (Emergency Room)', tel: '1999', building: 'อาคารเฉลิมพระเกียรติ ชั้น 1' },
  { code: 'SURGERY', name: 'แผนกห้องผ่าตัด (Operating Room)', tel: '1300', building: 'อาคารเฉลิมพระเกียรติ ชั้น 3' },
];

const systemUsers = [
  {
    employeeId: 'GOV-67001',
    userName: 'admin',
    firstname: 'สมชาย',
    lastname: 'แอดมินระบบ',
    email: 'admin@hospital.go.th',
    password: 'Admin@1234',
    role: 'ADMIN' as const,
    sectionCode: 'IT',
  },
  {
    employeeId: 'GOV-67002',
    userName: 'manager',
    firstname: 'ดร.วิชัย',
    lastname: 'ผู้อำนวยการฝ่ายบริหาร',
    email: 'manager@hospital.go.th',
    password: 'Manager@1234',
    role: 'MANAGER' as const,
    sectionCode: 'CENTER',
  },
  {
    employeeId: 'GOV-67003',
    userName: 'parcel',
    firstname: 'กรรณิการ์',
    lastname: 'พัสดุการเงิน',
    email: 'parcel@hospital.go.th',
    password: 'Parcel@1234',
    role: 'PARCEL_STAFF' as const,
    sectionCode: 'PARCEL',
  },
  {
    employeeId: 'GOV-67004',
    userName: 'assetcenter',
    firstname: 'ธนากร',
    lastname: 'เจ้าหน้าที่ศูนย์ครุภัณฑ์',
    email: 'assetcenter@hospital.go.th',
    password: 'AssetCenter@1234',
    role: 'ASSET_CENTER_STAFF' as const,
    sectionCode: 'CENTER',
  },
  {
    employeeId: 'GOV-67005',
    userName: 'deptstaff_opd1',
    firstname: 'วรรณภา',
    lastname: 'พยาบาลวิชาชีพ OPD 1',
    email: 'opd1@hospital.go.th',
    password: 'DeptStaff@1234',
    role: 'DEPARTMENT_STAFF' as const,
    sectionCode: 'OPD',
  },
  {
    employeeId: 'GOV-67006',
    userName: 'deptstaff_opd2',
    firstname: 'อนุชา',
    lastname: 'พยาบาลวิชาชีพ OPD 2 (แผนกเดียวกันกับ OPD 1)',
    email: 'opd2@hospital.go.th',
    password: 'DeptStaff@1234',
    role: 'DEPARTMENT_STAFF' as const,
    sectionCode: 'OPD',
  },
  {
    employeeId: 'GOV-67007',
    userName: 'deptstaff_icu',
    firstname: 'ชลธิชา',
    lastname: 'พยาบาลวิชาชีพ ICU (ต่างแผนก)',
    email: 'icu@hospital.go.th',
    password: 'DeptStaff@1234',
    role: 'DEPARTMENT_STAFF' as const,
    sectionCode: 'ICU',
  },
  {
    employeeId: 'GOV-67008',
    userName: 'deptstaff_er',
    firstname: 'ภานุวัฒน์',
    lastname: 'พยาบาลฉุกเฉิน ER (ต่างแผนก)',
    email: 'er@hospital.go.th',
    password: 'DeptStaff@1234',
    role: 'DEPARTMENT_STAFF' as const,
    sectionCode: 'ER',
  },
  {
    employeeId: 'GOV-67009',
    userName: 'maintenance',
    firstname: 'ประเสริฐ',
    lastname: 'วิศวกรชีวการแพทย์',
    email: 'maintenance@hospital.go.th',
    password: 'Maintenance@1234',
    role: 'MAINTENANCE_STAFF' as const,
    sectionCode: 'CENTER',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database with enhanced test mockups...\n');

  // 1. AssetStatus
  console.log('📂 Seeding AssetStatus...');
  const statusMap: Record<string, number> = {};
  for (const s of assetStatuses) {
    const res = await prisma.assetStatus.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: s,
    });
    statusMap[s.code] = res.id;
  }

  // 2. AvailabilityStatus
  console.log('📂 Seeding AvailabilityStatus...');
  const availMap: Record<string, number> = {};
  for (const a of availabilityStatuses) {
    const res = await prisma.availabilityStatus.upsert({
      where: { code: a.code },
      update: { name: a.name },
      create: a,
    });
    availMap[a.code] = res.id;
  }

  // 2.5 BorrowStatus
  console.log('📂 Seeding BorrowStatus...');
  const borrowStatusMap: Record<string, number> = {};
  for (const b of borrowStatuses) {
    const res = await prisma.borrowStatus.upsert({
      where: { code: b.code },
      update: { name: b.name },
      create: b,
    });
    borrowStatusMap[b.code] = res.id;
  }

  // 2.6 AcqType
  console.log('📂 Seeding AcqType...');
  for (const acq of acqTypes) {
    const existing = await prisma.acqType.findFirst({ where: { name: acq.name } });
    if (!existing) {
      await prisma.acqType.create({ data: acq });
    } else {
      await prisma.acqType.update({
        where: { id: existing.id },
        data: { description: acq.description, isActive: acq.isActive },
      });
    }
  }

  // 2.7 BudgetType
  console.log('📂 Seeding BudgetType...');
  for (const bt of budgetTypes) {
    const existing = await prisma.budgetType.findFirst({ where: { name: bt.name } });
    if (!existing) {
      await prisma.budgetType.create({ data: bt });
    } else {
      await prisma.budgetType.update({
        where: { id: existing.id },
        data: { fiscalYear: bt.fiscalYear, description: bt.description, isActive: bt.isActive },
      });
    }
  }

  // 2.8 EquipmentType
  console.log('📂 Seeding EquipmentType...');
  const eqTypeMap: Record<string, number> = {};
  for (const eq of equipmentTypes) {
    let existing = await prisma.equipmentType.findFirst({ where: { name: eq.name } });
    if (!existing) {
      existing = await prisma.equipmentType.create({ data: eq });
    } else {
      await prisma.equipmentType.update({
        where: { id: existing.id },
        data: { description: eq.description },
      });
    }
    eqTypeMap[eq.name] = existing.id;
  }

  // 3. Companies
  console.log('🏢 Seeding Companies...');
  const companyMap: Record<string, string> = {};
  for (const c of companies) {
    const res = await prisma.company.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
    companyMap[c.code] = res.id;
  }

  // 4. AssetTypes
  console.log('📦 Seeding AssetTypes...');
  const typeMap: Record<string, number> = {};
  for (const t of assetTypes) {
    let res = await prisma.assetType.findFirst({ where: { name: t.name } });
    if (!res) {
      res = await prisma.assetType.create({ data: t });
    }
    typeMap[t.name] = res.id;
  }

  // 5. Sections
  console.log('🏥 Seeding Sections...');
  const sectionMap: Record<string, string> = {};
  for (const data of sections) {
    const section = await prisma.section.upsert({
      where: { code: data.code },
      update: { name: data.name, tel: data.tel, building: data.building },
      create: { ...data },
    });
    sectionMap[section.code] = section.id;
  }

  // 6. System Users
  console.log('👤 Seeding System Users (Multi-Department for RBAC testing)...');
  let adminId = '';
  const userMap: Record<string, string> = {};
  for (const data of systemUsers) {
    let existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { employeeId: data.employeeId },
        ],
      },
    });

    const hashedPassword = await hashPassword(data.password);
    const sectionId = sectionMap[data.sectionCode];

    if (existing) {
      userMap[data.userName] = existing.id;
      if (data.role === 'ADMIN') adminId = existing.id;
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          employeeId: data.employeeId,
          userName: data.userName,
          firstname: data.firstname,
          lastname: data.lastname,
          email: data.email,
          role: data.role,
          section_id: sectionId,
        },
      });

      // ซิงค์ข้อมูลบัญชีและรหัสผ่านในตาราง accounts
      const existingAccount = await prisma.account.findFirst({
        where: { userId: existing.id },
      });
      if (existingAccount) {
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            accountId: data.email,
            password: hashedPassword,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.account.create({
          data: {
            id: randomUUID(),
            userId: existing.id,
            providerId: 'credential',
            accountId: data.email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      console.log(`  🔄 Updated existing user and password (${data.employeeId}): ${data.email}`);
      continue;
    }
    const userId = randomUUID();
    if (data.role === 'ADMIN') adminId = userId;
    userMap[data.userName] = userId;

    await prisma.user.create({
      data: {
        id: userId,
        employeeId: data.employeeId,
        userName: data.userName,
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
        emailVerified: true,
        role: data.role,
        section_id: sectionId,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: {
          create: {
            id: randomUUID(),
            providerId: 'credential',
            accountId: data.email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      },
    });
    console.log(`  ✅ Created user: ${data.email} (${data.role} @ ${data.sectionCode})`);
  }

  // 7. Mock Assets (Comprehensive Variations: Special/Backup combinations, multi-department, multi-budget)
  console.log('💻 Seeding Enhanced Mock Assets...');
  const mockAssets = [
    // 1. เครื่องกระตุกหัวใจไฟฟ้า (Special: True, Backup: True) @ ER
    {
      noid: 'EQ-2567-ER-001',
      name: 'เครื่องกระตุกหัวใจไฟฟ้าชนิดไบเฟสิก (Defibrillator)',
      model: 'Zoll R Series Plus',
      serialNo: 'SN-DEF-2567-001',
      budgetType: 'เงินงบประมาณแผ่นดิน ปี 2567',
      acqType: 'ประกวดราคาอิเล็กทรอนิกส์(e-bidding)',
      acqDoc: 'DOC-2567-ER-001',
      price: '450000',
      warrantyDate: '2029-12-31',
      receivedDate: new Date('2024-01-15'),
      pmType: PmType.EM,
      pmIntervalMonth: 6,
      calType: CalType.EC,
      calIntervalMonth: 12,
      equipment_type_id: eqTypeMap['เครื่องมือช่วยชีวิต'],
      riskLevel: RiskLevel.HIGH,
      isSpecial: true,
      isBackup: true,
      remark: 'เครื่องมือพิเศษและสำรองฉุกเฉินระดับวิกฤต ประจำห้องฉุกเฉิน',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514',
      section_id: sectionMap['ER'],
      company_id: companyMap['COMP001'],
      type_id: typeMap['เครื่องมือแพทย์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['deptstaff_er'] || adminId,
    },

    // 2. เครื่องช่วยหายใจขั้นสูง (Special: True, Backup: False) @ ICU
    {
      noid: 'EQ-2567-ICU-002',
      name: 'เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน (ICU Ventilator)',
      model: 'Hamilton-G5 Medical',
      serialNo: 'SN-VENT-2567-002',
      budgetType: 'งบลงทุนและพัฒนา ปี 2567',
      acqType: 'คัดเลือก',
      acqDoc: 'DOC-2567-ICU-012',
      price: '850000',
      warrantyDate: '2029-06-30',
      receivedDate: new Date('2024-02-01'),
      pmType: PmType.EM,
      pmIntervalMonth: 3,
      calType: CalType.EC,
      calIntervalMonth: 6,
      equipment_type_id: eqTypeMap['เครื่องมือช่วยชีวิต'],
      riskLevel: RiskLevel.HIGH,
      isSpecial: true,
      isBackup: false,
      remark: 'เครื่องช่วยหายใจเฉพาะทาง ICU ปัจจุบันใช้งานอยู่ในหอผู้ป่วยวิกฤต',
      imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982',
      section_id: sectionMap['ICU'],
      company_id: companyMap['COMP003'],
      type_id: typeMap['เครื่องมือแพทย์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['BORROWED'],
      owner_id: userMap['deptstaff_icu'] || adminId,
    },

    // 3. เครื่องวัดความดันโลหิตสำรอง (Special: False, Backup: True) @ OPD (Owner: deptstaff_opd1)
    {
      noid: 'EQ-2566-OPD-003',
      name: 'เครื่องวัดความดันโลหิตดิจิตอลแบบสอดแขน (สำรอง)',
      model: 'Omron HBP-9030',
      serialNo: 'SN-BP-2566-003',
      budgetType: 'งบค่าเสื่อม ปี 2566',
      acqType: 'เฉพาะเจาะจง',
      acqDoc: 'DOC-2566-OPD-045',
      price: '38000',
      warrantyDate: '2027-10-31',
      receivedDate: new Date('2023-10-15'),
      pmType: PmType.IM,
      pmIntervalMonth: 6,
      calType: CalType.IC,
      calIntervalMonth: 12,
      equipment_type_id: eqTypeMap['เครื่องมือตรวจวัด/วินิจฉัย'],
      riskLevel: RiskLevel.LOW,
      isSpecial: false,
      isBackup: true,
      remark: 'เครื่องสำรองสำหรับสลับใช้เมื่อเครื่องหลักใน OPD ส่งสอบเทียบ',
      imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef',
      section_id: sectionMap['OPD'],
      company_id: companyMap['COMP001'],
      type_id: typeMap['เครื่องมือแพทย์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['deptstaff_opd1'] || adminId,
    },

    // 4. เครื่องตรวจคลื่นไฟฟ้าหัวใจ (Special: False, Backup: False) @ OPD (Owner: deptstaff_opd2)
    {
      noid: 'EQ-2565-OPD-004',
      name: 'เครื่องตรวจคลื่นไฟฟ้าหัวใจ 12 ลีด (EKG 12-Lead)',
      model: 'GE MAC 2000',
      serialNo: 'SN-EKG-2565-004',
      budgetType: 'งบค่าเสื่อม ปี 2565',
      acqType: 'ตกลงราคา',
      acqDoc: 'DOC-2565-OPD-102',
      price: '185000',
      warrantyDate: '2026-05-31',
      receivedDate: new Date('2022-05-10'),
      pmType: PmType.IM,
      pmIntervalMonth: 6,
      calType: CalType.IC,
      calIntervalMonth: 12,
      equipment_type_id: eqTypeMap['เครื่องมือตรวจวัด/วินิจฉัย'],
      riskLevel: RiskLevel.MEDIUM,
      isSpecial: false,
      isBackup: false,
      remark: 'เครื่องประจำห้องตรวจอายุรกรรม OPD 2',
      imageUrl: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28',
      section_id: sectionMap['OPD'],
      company_id: companyMap['COMP003'],
      type_id: typeMap['เครื่องมือแพทย์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['deptstaff_opd2'] || adminId,
    },

    // 5. โน้ตบุ๊กศูนย์ครุภัณฑ์กลาง (Special: False, Backup: False) @ CENTER
    {
      noid: 'EQ-2567-CEN-005',
      name: 'เครื่องคอมพิวเตอร์พกพาสำหรับงานระบบครุภัณฑ์',
      model: 'Lenovo ThinkPad P16s Gen 2',
      serialNo: 'SN-IT-2567-005',
      budgetType: 'เงินบำรุงโรงพยาบาล (ไม่ระบุปี)',
      acqType: 'เฉพาะเจาะจง',
      acqDoc: 'DOC-2567-CEN-001',
      price: '48000',
      warrantyDate: '2027-08-31',
      receivedDate: new Date('2024-03-01'),
      pmType: PmType.IM,
      pmIntervalMonth: 12,
      calType: CalType.IC,
      calIntervalMonth: 0,
      equipment_type_id: eqTypeMap['เครื่องมือสนับสนุน'],
      riskLevel: RiskLevel.LOW,
      isSpecial: false,
      isBackup: false,
      remark: 'เครื่องประจำเจ้าหน้าที่ศูนย์กลางครุภัณฑ์สำหรับออกตรวจนับ',
      imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
      section_id: sectionMap['CENTER'],
      company_id: companyMap['COMP002'],
      type_id: typeMap['คอมพิวเตอร์และอุปกรณ์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['assetcenter'] || adminId,
    },

    // 6. รถเข็นผู้ป่วยปรับเอนได้ (Special: False, Backup: True) @ OPD (เงินบริจาคมูลนิธิ)
    {
      noid: 'EQ-2567-DON-006',
      name: 'รถเข็นนั่งผู้ป่วยแบบปรับเอนนอน (Reclining Wheelchair)',
      model: 'Karma VIP 515',
      serialNo: 'SN-WC-2567-006',
      budgetType: 'เงินบริจาคมูลนิธิโรงพยาบาล',
      acqType: 'บริจาค',
      acqDoc: 'DOC-DON-2567-008',
      price: '28000',
      warrantyDate: '2028-12-31',
      receivedDate: new Date('2024-04-12'),
      pmType: PmType.IM,
      pmIntervalMonth: 6,
      calType: CalType.IC,
      calIntervalMonth: 0,
      equipment_type_id: eqTypeMap['อุปกรณ์อำนวยความสะดวก'],
      riskLevel: RiskLevel.LOW,
      isSpecial: false,
      isBackup: true,
      remark: 'ได้รับบริจาคจากมูลนิธิโรงพยาบาล พร้อมใช้งานสำรอง',
      imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982',
      section_id: sectionMap['OPD'],
      company_id: companyMap['COMP004'],
      type_id: typeMap['เครื่องมือแพทย์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['deptstaff_opd1'] || adminId,
    },

    // 7. เตียงผ่าตัดระบบไฟฟ้า (Special: True, Backup: False) @ SURGERY (เงินนอกงบประมาณ)
    {
      noid: 'EQ-2566-SUR-007',
      name: 'เตียงผ่าตัดระบบไฟฟ้าเอนกประสงค์ (Electro-Hydraulic OR Table)',
      model: 'Maquet Alphamaquet 1150',
      serialNo: 'SN-ORT-2566-007',
      budgetType: 'เงินนอกงบประมาณ',
      acqType: 'สอบราคา',
      acqDoc: 'DOC-2566-SUR-099',
      price: '1650000',
      warrantyDate: '2028-09-30',
      receivedDate: new Date('2023-09-01'),
      pmType: PmType.EM,
      pmIntervalMonth: 3,
      calType: CalType.EC,
      calIntervalMonth: 6,
      equipment_type_id: eqTypeMap['เครื่องมือเพื่อการรักษา'],
      riskLevel: RiskLevel.HIGH,
      isSpecial: true,
      isBackup: false,
      remark: 'เตียงผ่าตัดประจำห้องผ่าตัดใหญ่ 1',
      imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d',
      section_id: sectionMap['SURGERY'],
      company_id: companyMap['COMP004'],
      type_id: typeMap['เฟอร์นิเจอร์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['maintenance'] || adminId,
    },

    // 8. รถพยาบาลกู้ชีพฉุกเฉิน (Special: True, Backup: True) @ ER
    {
      noid: 'EQ-2567-AMB-008',
      name: 'รถพยาบาลฉุกเฉินระดับสูงพร้อมอุปกรณ์ช่วยชีวิต (Mobile ICU Ambulance)',
      model: 'Toyota Commuter VIP Mobile ICU',
      serialNo: 'SN-AMB-2567-008',
      budgetType: 'เงินงบประมาณแผ่นดิน ปี 2567',
      acqType: 'ประกวดราคาอิเล็กทรอนิกส์(e-bidding)',
      acqDoc: 'DOC-2567-ER-088',
      price: '2800000',
      warrantyDate: '2029-01-31',
      receivedDate: new Date('2024-01-20'),
      pmType: PmType.EM,
      pmIntervalMonth: 3,
      calType: CalType.EC,
      calIntervalMonth: 6,
      equipment_type_id: eqTypeMap['เครื่องมือช่วยชีวิต'],
      riskLevel: RiskLevel.HIGH,
      isSpecial: true,
      isBackup: true,
      remark: 'รถพยาบาลกู้ชีพฉุกเฉินคันที่ 1 แผนกอุบัติเหตุ',
      imageUrl: 'https://images.unsplash.com/photo-1587745416684-47953f16f02f',
      section_id: sectionMap['ER'],
      company_id: companyMap['COMP001'],
      type_id: typeMap['ยานพาหนะ'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['deptstaff_er'] || adminId,
    },

    // 9. เครื่องดมยาสลบชำรุดรอซ่อม (Special: True, Backup: False) @ SURGERY
    {
      noid: 'EQ-2565-SUR-009',
      name: 'เครื่องดมยาสลบพร้อมระบบช่วยหายใจ (Anesthesia Workstation)',
      model: 'Dräger Primus',
      serialNo: 'SN-ANES-2565-009',
      budgetType: 'งบค่าเสื่อม ปี 2565',
      acqType: 'ประกวดราคา',
      acqDoc: 'DOC-2565-SUR-011',
      price: '1900000',
      warrantyDate: '2026-03-31',
      receivedDate: new Date('2022-03-01'),
      pmType: PmType.EM,
      pmIntervalMonth: 3,
      calType: CalType.EC,
      calIntervalMonth: 6,
      equipment_type_id: eqTypeMap['เครื่องมือเพื่อการรักษา'],
      riskLevel: RiskLevel.HIGH,
      isSpecial: true,
      isBackup: false,
      remark: 'วาล์วควบคุมก๊าซรั่วซึม ชำรุดอยู่ระหว่างรออะไหล่ตรวจซ่อม',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514',
      section_id: sectionMap['SURGERY'],
      company_id: companyMap['COMP003'],
      type_id: typeMap['เครื่องมือแพทย์'],
      asset_status_id: statusMap['UNDER_REPAIR'],
      availability_status_id: availMap['UNAVAILABLE'],
      owner_id: userMap['maintenance'] || adminId,
    },

    // 10. เครื่องฉายโปรเจคเตอร์รุ่นเก่า รอจำหน่าย (Special: False, Backup: False) @ IT
    {
      noid: 'EQ-2558-IT-010',
      name: 'เครื่องฉายภาพโปรเจคเตอร์ LCD ความสว่างสูง',
      model: 'Sony VPL-DX100',
      serialNo: 'SN-PJ-2558-010',
      budgetType: 'งบค่าเสื่อม ปี 2558',
      acqType: 'ติดมากับตึก',
      acqDoc: 'DOC-2558-IT-005',
      price: '24000',
      warrantyDate: '2018-05-30',
      receivedDate: new Date('2015-05-01'),
      pmType: PmType.IM,
      pmIntervalMonth: 12,
      calType: CalType.IC,
      calIntervalMonth: 0,
      equipment_type_id: eqTypeMap['เครื่องมือสนับสนุน'],
      riskLevel: RiskLevel.LOW,
      isSpecial: false,
      isBackup: false,
      remark: 'หลอดภาพเสื่อมสภาพ หมดอายุการใช้งาน เตรียมทำเรื่องจำหน่าย',
      imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c',
      section_id: sectionMap['IT'],
      company_id: companyMap['COMP002'],
      type_id: typeMap['คอมพิวเตอร์และอุปกรณ์'],
      asset_status_id: statusMap['WAIT_DISPOSAL'],
      availability_status_id: availMap['UNAVAILABLE'],
      owner_id: userMap['parcel'] || adminId,
    },
  ];

  for (const asset of mockAssets) {
    const existing = await prisma.asset.findFirst({
      where: { serialNo: asset.serialNo },
    });

    if (!existing) {
      await prisma.asset.create({
        data: {
          ...asset,
          createdBy: adminId,
          updatedBy: adminId,
        },
      });
      console.log(`  ✅ Created asset: ${asset.name} (${asset.serialNo}) [${asset.noid}]`);
    } else {
      await prisma.asset.update({
        where: { id: existing.id },
        data: {
          ...asset,
          updatedBy: adminId,
        },
      });
      console.log(`  🔄 Updated asset: ${asset.name} (${asset.serialNo})`);
    }
  }

  // 8. Spare Part Groups & Spare Parts
  console.log('🔩 Seeding Spare Parts & Groups...');
  const sparepartGroups = [
    { name: 'อะไหล่ระบบไฟฟ้าและแหล่งจ่ายไฟ' },
    { name: 'อะไหล่ระบบท่อและก๊าซทางการแพทย์' },
    { name: 'อุปกรณ์ เซนเซอร์ และหัววัด' },
    { name: 'ชิ้นส่วนกลไก มอเตอร์ และสายพาน' },
    { name: 'วัสดุสิ้นเปลืองและฟิลเตอร์' },
  ];

  const groupMap: Record<string, number> = {};
  for (const g of sparepartGroups) {
    let group = await prisma.sparepartGroup.findFirst({ where: { name: g.name } });
    if (!group) {
      group = await prisma.sparepartGroup.create({ data: g });
    }
    groupMap[g.name] = group.id;
  }

  const mockSpareparts = [
    {
      code: 'SP-ELE-001',
      name: 'ฟิวส์เซรามิก 10A 250V (แพ็ก 10 ชิ้น)',
      unit: 'แพ็ก',
      price: 150.0,
      minStock: 10,
      qtyInStock: 25,
      groupName: 'อะไหล่ระบบไฟฟ้าและแหล่งจ่ายไฟ',
    },
    {
      code: 'SP-ELE-002',
      name: 'แบตเตอรี่สำรองฉุกเฉินสำหรับ Defibrillator 12V 4.5Ah',
      unit: 'ก้อน',
      price: 3200.0,
      minStock: 4,
      qtyInStock: 2, // Low stock on purpose
      groupName: 'อะไหล่ระบบไฟฟ้าและแหล่งจ่ายไฟ',
    },
    {
      code: 'SP-GAS-001',
      name: 'วาล์วควบคุมแรงดันออกซิเจนความแม่นยำสูง (O2 Regulator Valve)',
      unit: 'ชุด',
      price: 4500.0,
      minStock: 5,
      qtyInStock: 8,
      groupName: 'อะไหล่ระบบท่อและก๊าซทางการแพทย์',
    },
    {
      code: 'SP-GAS-002',
      name: 'ท่อสายส่งก๊าซทางการแพทย์แรงดันสูง (High-Pressure Hose)',
      unit: 'เส้น',
      price: 1200.0,
      minStock: 6,
      qtyInStock: 3, // Low stock on purpose
      groupName: 'อะไหล่ระบบท่อและก๊าซทางการแพทย์',
    },
    {
      code: 'SP-SEN-001',
      name: 'เซนเซอร์วัดค่าออกซิเจนในเลือด SpO2 Reusable Finger Probe',
      unit: 'เส้น',
      price: 2800.0,
      minStock: 8,
      qtyInStock: 15,
      groupName: 'อุปกรณ์ เซนเซอร์ และหัววัด',
    },
    {
      code: 'SP-SEN-002',
      name: 'สายวัดสัญญาณคลื่นหัวใจ EKG Trunk Cable 10-Lead',
      unit: 'เส้น',
      price: 3500.0,
      minStock: 5,
      qtyInStock: 1, // Low stock on purpose
      groupName: 'อุปกรณ์ เซนเซอร์ และหัววัด',
    },
    {
      code: 'SP-MEC-001',
      name: 'มอเตอร์ขับเคลื่อนแกนเตียงผ่าตัดไฟฟ้า (Actuator Motor 24V)',
      unit: 'ตัว',
      price: 9500.0,
      minStock: 2,
      qtyInStock: 4,
      groupName: 'ชิ้นส่วนกลไก มอเตอร์ และสายพาน',
    },
    {
      code: 'SP-FLT-001',
      name: 'ชุดฟิลเตอร์กรองอากาศเครื่องช่วยหายใจ HEPA Bacteria Filter',
      unit: 'ชิ้น',
      price: 650.0,
      minStock: 20,
      qtyInStock: 50,
      groupName: 'วัสดุสิ้นเปลืองและฟิลเตอร์',
    },
  ];

  for (const sp of mockSpareparts) {
    const groupId = groupMap[sp.groupName];
    const existing = await prisma.sparepart.findFirst({ where: { code: sp.code } });
    if (!existing) {
      const created = await prisma.sparepart.create({
        data: {
          code: sp.code,
          name: sp.name,
          unit: sp.unit,
          price: sp.price,
          minStock: sp.minStock,
          qtyInStock: sp.qtyInStock,
          groupId,
        },
      });

      // Add initial stock history
      await prisma.sparepartAdd.create({
        data: {
          sparepartId: created.id,
          qty: sp.qtyInStock,
          totalPrice: Number(sp.price) * sp.qtyInStock,
          sparepartAddDoc: 'SEED-INITIAL-STOCK',
          addBy: adminId,
        },
      });
      console.log(`  ✅ Created spare part: ${sp.name} (${sp.code}) [Stock: ${sp.qtyInStock}/${sp.minStock}]`);
    } else {
      await prisma.sparepart.update({
        where: { id: existing.id },
        data: {
          name: sp.name,
          unit: sp.unit,
          price: sp.price,
          minStock: sp.minStock,
          qtyInStock: sp.qtyInStock,
          groupId,
        },
      });
      console.log(`  🔄 Updated spare part: ${sp.name} (${sp.code})`);
    }
  }

  // 9. Repair Masters & Lookups
  console.log('🔧 Seeding Repair Masters & Lookups...');

  // 9.1 JobStatus
  const jobStatuses = [
    { code: 'PENDING', name: 'รอช่างรับงาน' },
    { code: 'IN_PROGRESS', name: 'กำลังดำเนินการซ่อม' },
    { code: 'WAITING_PARTS', name: 'รออะไหล่/จัดซื้อ' },
    { code: 'WAITING_DELIVERY', name: 'แจ้งแล้วเสร็จ/รอส่งมอบ' },
    { code: 'COMPLETED', name: 'ซ่อมเสร็จสมบูรณ์/ปิดงาน' },
    { code: 'CANCELLED', name: 'ยกเลิกงานซ่อม' },
  ];
  for (const js of jobStatuses) {
    await prisma.jobStatus.upsert({
      where: { code: js.code },
      update: { name: js.name },
      create: js,
    });
  }

  // 9.2 JobType
  const jobTypes = [
    { name: 'ตรวจเช็คและซ่อมทั่วไป' },
    { name: 'ซ่อมใหญ่/ยกเครื่อง' },
    { name: 'บำรุงรักษาเชิงป้องกัน (PM)' },
    { name: 'สอบเทียบมาตรฐาน (Calibration)' },
    { name: 'ดัดแปลง/ปรับปรุงสภาพ' },
  ];
  for (const jt of jobTypes) {
    const existing = await prisma.jobType.findFirst({ where: { name: jt.name } });
    if (!existing) {
      await prisma.jobType.create({ data: jt });
    }
  }

  // 9.3 Cause
  const causes = [
    { code: '01', name: 'การเสื่อมสภาพตามอายุการใช้งาน' },
    { code: '02', name: 'การใช้งานผิดวิธี/เกิดอุบัติเหตุ' },
    { code: '03', name: 'ระบบไฟฟ้าขัดข้อง/แรงดันไฟตกหรือกระชาก' },
    { code: '04', name: 'ข้อผิดพลาดทางซอฟต์แวร์หรือเฟิร์มแวร์' },
    { code: '05', name: 'สิ่งแปลกปลอม/ของเหลวไหลเข้าตัวเครื่อง' },
    { code: '06', name: 'การขาดการบำรุงรักษาตามรอบ' },
  ];
  for (const cs of causes) {
    const existing = await prisma.cause.findFirst({ where: { code: cs.code } });
    if (!existing) {
      await prisma.cause.create({ data: cs });
    } else {
      await prisma.cause.update({ where: { id: existing.id }, data: { name: cs.name } });
    }
  }

  // 9.4 TechCategory
  const techCategories = [
    { code: 'BIOMED', name: 'หมวดวิศวกรรมชีวการแพทย์ (Biomedical)', isActive: true },
    { code: 'ELEC', name: 'หมวดระบบไฟฟ้าและอิเล็กทรอนิกส์', isActive: true },
    { code: 'IT_NET', name: 'หมวดคอมพิวเตอร์และระบบเครือข่าย', isActive: true },
    { code: 'MECH_BLD', name: 'หมวดกลไกและอาคารสถานที่', isActive: true },
  ];
  for (const tc of techCategories) {
    const existing = await prisma.techCategory.findFirst({ where: { code: tc.code } });
    if (!existing) {
      await prisma.techCategory.create({ data: tc });
    } else {
      await prisma.techCategory.update({
        where: { id: existing.id },
        data: { name: tc.name, isActive: tc.isActive },
      });
    }
  }

  // 9.5 StepMaster (12 Steps across 5 Action Types from repair_step_flow.md)
  console.log('📋 Seeding StepMaster (12 steps template)...');
  const stepMasterTemplates: { stepNumber: number; actionType: StepActionType; label: string }[] = [
    // 1. INTERNAL_STOCK
    { stepNumber: 1, actionType: StepActionType.INTERNAL_STOCK, label: 'วันแจ้งซ่อม' },
    { stepNumber: 2, actionType: StepActionType.INTERNAL_STOCK, label: 'ธุรการรับ Job' },
    { stepNumber: 3, actionType: StepActionType.INTERNAL_STOCK, label: 'กำหนดแล้วเสร็จ' },
    { stepNumber: 4, actionType: StepActionType.INTERNAL_STOCK, label: 'ช่างรับ JOB' },
    { stepNumber: 5, actionType: StepActionType.INTERNAL_STOCK, label: 'ใช้วัสดุ-อะไหล่สำรอง' },
    { stepNumber: 6, actionType: StepActionType.INTERNAL_STOCK, label: 'ขอเบิกอะไหล่ในคลัง' },
    { stepNumber: 7, actionType: StepActionType.INTERNAL_STOCK, label: 'อนุมัติจัดหาอะไหล่ในคลัง' },
    { stepNumber: 8, actionType: StepActionType.INTERNAL_STOCK, label: 'พัสดุแจ้งรับอะไหล่ในคลัง' },
    { stepNumber: 9, actionType: StepActionType.INTERNAL_STOCK, label: 'ช่างรับวัสดุในคลัง' },
    { stepNumber: 10, actionType: StepActionType.INTERNAL_STOCK, label: 'ประกันงานซ่อมถึงวันที่' },
    { stepNumber: 11, actionType: StepActionType.INTERNAL_STOCK, label: 'แล้วเสร็จ/ตรวจรับงาน' },
    { stepNumber: 12, actionType: StepActionType.INTERNAL_STOCK, label: 'สรุป Job' },

    // 2. EXTERNAL_STOCK
    { stepNumber: 1, actionType: StepActionType.EXTERNAL_STOCK, label: 'วันแจ้งซ่อม' },
    { stepNumber: 2, actionType: StepActionType.EXTERNAL_STOCK, label: 'ธุรการรับ Job' },
    { stepNumber: 3, actionType: StepActionType.EXTERNAL_STOCK, label: 'กำหนดแล้วเสร็จ' },
    { stepNumber: 4, actionType: StepActionType.EXTERNAL_STOCK, label: 'ช่างรับ JOB' },
    { stepNumber: 5, actionType: StepActionType.EXTERNAL_STOCK, label: 'ใช้วัสดุ-อะไหล่สำรอง' },
    { stepNumber: 6, actionType: StepActionType.EXTERNAL_STOCK, label: 'ขอเบิกอะไหล่นอกคลัง' },
    { stepNumber: 7, actionType: StepActionType.EXTERNAL_STOCK, label: 'อนุมัติจัดหาอะไหล่นอกคลัง' },
    { stepNumber: 8, actionType: StepActionType.EXTERNAL_STOCK, label: 'พัสดุแจ้งรับอะไหล่' },
    { stepNumber: 9, actionType: StepActionType.EXTERNAL_STOCK, label: 'ช่างรับอะไหล่' },
    { stepNumber: 10, actionType: StepActionType.EXTERNAL_STOCK, label: 'ประกันงานซ่อมถึงวันที่' },
    { stepNumber: 11, actionType: StepActionType.EXTERNAL_STOCK, label: 'แล้วเสร็จ/ตรวจรับงาน' },
    { stepNumber: 12, actionType: StepActionType.EXTERNAL_STOCK, label: 'สรุป Job' },

    // 3. OUTSOURCE
    { stepNumber: 1, actionType: StepActionType.OUTSOURCE, label: 'วันแจ้งซ่อม' },
    { stepNumber: 2, actionType: StepActionType.OUTSOURCE, label: 'ธุรการรับ Job' },
    { stepNumber: 3, actionType: StepActionType.OUTSOURCE, label: 'กำหนดแล้วเสร็จ' },
    { stepNumber: 4, actionType: StepActionType.OUTSOURCE, label: 'ช่างรับ JOB' },
    { stepNumber: 5, actionType: StepActionType.OUTSOURCE, label: 'ใช้วัสดุ-อะไหล่สำรอง' },
    { stepNumber: 6, actionType: StepActionType.OUTSOURCE, label: 'ส่งซ่อมบริษัทฯ' },
    { stepNumber: 7, actionType: StepActionType.OUTSOURCE, label: 'อนุมัติส่งซ่อมบริษัทฯ' },
    { stepNumber: 8, actionType: StepActionType.OUTSOURCE, label: 'พัสดุแจ้งรับเครื่องจากบริษัทฯ' },
    { stepNumber: 9, actionType: StepActionType.OUTSOURCE, label: 'ช่างรับเครื่องจากบริษัทฯ' },
    { stepNumber: 10, actionType: StepActionType.OUTSOURCE, label: 'ประกันงานซ่อมถึงวันที่' },
    { stepNumber: 11, actionType: StepActionType.OUTSOURCE, label: 'แล้วเสร็จ/ตรวจรับงาน' },
    { stepNumber: 12, actionType: StepActionType.OUTSOURCE, label: 'สรุป Job' },

    // 4. PURCHASE_REPLACEMENT
    { stepNumber: 1, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'วันแจ้งซ่อม' },
    { stepNumber: 2, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'ธุรการรับ Job' },
    { stepNumber: 3, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'กำหนดแล้วเสร็จ' },
    { stepNumber: 4, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'ช่างรับ JOB' },
    { stepNumber: 5, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'ใช้วัสดุ-อะไหล่สำรอง' },
    { stepNumber: 6, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'ขอซื้อทดแทน' },
    { stepNumber: 7, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'อนุมัติขอซื้อทดแทน' },
    { stepNumber: 8, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'พัสดุแจ้งรับเครื่องใหม่' },
    { stepNumber: 9, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'ช่างรับเครื่องใหม่' },
    { stepNumber: 10, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'ประกันงานซ่อมถึงวันที่' },
    { stepNumber: 11, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'แล้วเสร็จ/ตรวจรับงาน' },
    { stepNumber: 12, actionType: StepActionType.PURCHASE_REPLACEMENT, label: 'สรุป Job' },

    // 5. SELF_REPAIR
    { stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
    { stepNumber: 2, actionType: StepActionType.SELF_REPAIR, label: 'ธุรการรับ Job' },
    { stepNumber: 3, actionType: StepActionType.SELF_REPAIR, label: 'กำหนดแล้วเสร็จ' },
    { stepNumber: 4, actionType: StepActionType.SELF_REPAIR, label: 'ช่างรับ JOB' },
    { stepNumber: 5, actionType: StepActionType.SELF_REPAIR, label: 'ใช้วัสดุ-อะไหล่สำรอง' },
    { stepNumber: 6, actionType: StepActionType.SELF_REPAIR, label: 'ดำเนินการซ่อมเอง' },
    { stepNumber: 7, actionType: StepActionType.SELF_REPAIR, label: 'ข้ามขั้นตอน' },
    { stepNumber: 8, actionType: StepActionType.SELF_REPAIR, label: 'ข้ามขั้นตอน' },
    { stepNumber: 9, actionType: StepActionType.SELF_REPAIR, label: 'ข้ามขั้นตอน' },
    { stepNumber: 10, actionType: StepActionType.SELF_REPAIR, label: 'ประกันงานซ่อมถึงวันที่' },
    { stepNumber: 11, actionType: StepActionType.SELF_REPAIR, label: 'แล้วเสร็จ/ตรวจรับงาน' },
    { stepNumber: 12, actionType: StepActionType.SELF_REPAIR, label: 'สรุป Job' },
  ];

  for (const st of stepMasterTemplates) {
    const existing = await prisma.stepMaster.findFirst({
      where: { stepNumber: st.stepNumber, actionType: st.actionType },
    });
    if (!existing) {
      await prisma.stepMaster.create({ data: st });
    } else {
      await prisma.stepMaster.update({
        where: { id: existing.id },
        data: { label: st.label },
      });
    }
  }

  console.log('\n✨ Enhanced database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
