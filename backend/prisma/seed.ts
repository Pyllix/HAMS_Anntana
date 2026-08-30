/**
 * Prisma Seed Script — Mock data ครอบคลุมทั้งระบบ
 *
 * Run with:
 *   pnpm tsx prisma/seed.ts
 */

import 'dotenv/config';
import { PrismaClient, RiskLevel, PmType, CalType } from '@prisma/client';
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
  { code: 'PENDING_APPROVAL', name: 'รออนุมัติ' },
  { code: 'APPROVED', name: 'อนุมัติแล้ว/รอส่งมอบ' },
  { code: 'BORROWED', name: 'กำลังยืม' },
  { code: 'PENDING_VERIFICATION', name: 'รอตรวจสอบสภาพ' },
  { code: 'RETURNED', name: 'คืนแล้ว' },
  { code: 'RETURNED_OPERATIONAL', name: 'คืนแล้ว (สภาพปกติ)' },
  { code: 'RETURNED_DAMAGED', name: 'คืนแล้ว (ชำรุด)' },
  { code: 'REJECTED', name: 'ปฏิเสธ' },
  { code: 'CANCELLED', name: 'ยกเลิก' },
];

const assetTypes = [
  { name: 'เครื่องมือแพทย์', useful_life: 5 },
  { name: 'คอมพิวเตอร์และอุปกรณ์', useful_life: 3 },
  { name: 'เฟอร์นิเจอร์', useful_life: 10 },
  { name: 'ยานพาหนะ', useful_life: 8 },
];

const acqTypes = [
  { name: 'ติดมากับตึก', description: 'ครุภัณฑ์ที่ติดตั้งพร้อมอาคารสถานที่', isActive: true },
  { name: 'รับโอน', description: 'รับโอนจากหน่วยงานอื่น', isActive: true },
  { name: 'บริจาค', description: 'ได้รับบริจาคจากผู้มีจิตศรัทธา', isActive: true },
  { name: 'จัดซื้อ', description: 'จัดซื้อตามงบประมาณประจำปี', isActive: true },
];

const budgetTypes = [
  { name: 'เงินงบประมาณแผ่นดิน', fiscalYear: 2567, description: 'งบประมาณสนับสนุนจากรัฐ', isActive: true },
  { name: 'เงินบำรุงโรงพยาบาล', fiscalYear: 2567, description: 'เงินรายได้ของโรงพยาบาล', isActive: true },
  { name: 'เงินบริจาค', fiscalYear: 2567, description: 'เงินบริจาคเฉพาะกิจ', isActive: true },
  { name: 'เงินกู้', fiscalYear: 2567, description: 'เงินกู้เพื่อการพัฒนา', isActive: true },
];

const equipmentTypes = [
  { name: 'เครื่องมือการแพทย์ทั่วไป', description: 'อุปกรณ์และเครื่องมือแพทย์พื้นฐาน' },
  { name: 'เครื่องมือตรวจวิเคราะห์', description: 'เครื่องมือตรวจในห้องปฏิบัติการ' },
  { name: 'เครื่องมือช่วยชีวิต', description: 'อุปกรณ์ช่วยชีวิตฉุกเฉิน' },
  { name: 'อุปกรณ์สำนักงานและไอที', description: 'อุปกรณ์สำนักงานทั่วไป' },
];

const companies = [
  { code: 'COMP001', name: 'บริษัท เมดิคอลซัพพลาย จำกัด', tel: '02-111-1111', email: 'contact@medical.co.th', address: 'Bangkok', fax: '-', group: 'SUPPLIER', remark: '' },
  { code: 'COMP002', name: 'บริษัท ไอที โซลูชั่น จำกัด', tel: '02-222-2222', email: 'sales@itsolution.co.th', address: 'Bangkok', fax: '-', group: 'SUPPLIER', remark: '' },
];

const sections = [
  { code: 'IT', name: 'Information Technology', tel: '1234', building: 'Admin Building' },
  { code: 'OPD', name: 'Outpatient Department', tel: '1100', building: 'Main Building' },
  { code: 'ICU', name: 'Intensive Care Unit', tel: '1200', building: 'Ward Building' },
];

const systemUsers = [
  {
    employeeId: 'GOV-67001',
    userName: 'admin',
    firstname: 'System',
    lastname: 'Admin',
    email: 'admin@hospital.go.th',
    password: 'Admin@1234',
    role: 'ADMIN' as const,
    sectionCode: 'IT',
  },
  {
    employeeId: 'GOV-67002',
    userName: 'manager',
    firstname: 'System',
    lastname: 'Manager',
    email: 'manager@hospital.go.th',
    password: 'Manager@1234',
    role: 'MANAGER' as const,
    sectionCode: 'IT',
  },
  {
    employeeId: 'GOV-67003',
    userName: 'parcel',
    firstname: 'System',
    lastname: 'Parcel Staff',
    email: 'parcel@hospital.go.th',
    password: 'Parcel@1234',
    role: 'PARCEL_STAFF' as const,
    sectionCode: 'IT',
  },
  {
    employeeId: 'GOV-67004',
    userName: 'assetcenter',
    firstname: 'System',
    lastname: 'Asset Center',
    email: 'assetcenter@hospital.go.th',
    password: 'AssetCenter@1234',
    role: 'ASSET_CENTER_STAFF' as const,
    sectionCode: 'IT',
  },
  {
    employeeId: 'GOV-67005',
    userName: 'deptstaff',
    firstname: 'System',
    lastname: 'Dept Staff',
    email: 'deptstaff@hospital.go.th',
    password: 'DeptStaff@1234',
    role: 'DEPARTMENT_STAFF' as const,
    sectionCode: 'OPD',
  },
  {
    employeeId: 'GOV-67006',
    userName: 'maintenance',
    firstname: 'System',
    lastname: 'Maintenance',
    email: 'maintenance@hospital.go.th',
    password: 'Maintenance@1234',
    role: 'MAINTENANCE_STAFF' as const,
    sectionCode: 'IT',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

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
    }
  }

  // 2.7 BudgetType
  console.log('📂 Seeding BudgetType...');
  for (const bt of budgetTypes) {
    const existing = await prisma.budgetType.findFirst({ where: { name: bt.name } });
    if (!existing) {
      await prisma.budgetType.create({ data: bt });
    }
  }

  // 2.8 EquipmentType
  console.log('📂 Seeding EquipmentType...');
  const eqTypeMap: Record<string, number> = {};
  for (const eq of equipmentTypes) {
    let existing = await prisma.equipmentType.findFirst({ where: { name: eq.name } });
    if (!existing) {
      existing = await prisma.equipmentType.create({ data: eq });
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
  console.log('👤 Seeding System Users...');
  let adminId = '';
  const userMap: Record<string, string> = {};
  for (const data of systemUsers) {
    let existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      userMap[data.userName] = existing.id;
      if (data.role === 'ADMIN') adminId = existing.id;
      await prisma.user.update({
        where: { id: existing.id },
        data: { employeeId: data.employeeId },
      });
      console.log(`  ⚠️  User already exists, updated employeeId (${data.employeeId}): ${data.email}`);
      continue;
    }

    const sectionId = sectionMap[data.sectionCode];
    const hashedPassword = await hashPassword(data.password);
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
    console.log(`  ✅ Created user: ${data.email}`);
  }

  // 7. Mock Assets
  console.log('💻 Seeding Mock Assets...');
  const mockAssets = [
    {
      noid: 'EQ-2567-0001',
      name: 'เครื่องวัดความดันโลหิต',
      model: 'BP-1000',
      serialNo: 'SN-BP-001',
      budgetType: 'เงินงบประมาณแผ่นดิน',
      acqType: 'จัดซื้อ',
      acqDoc: 'DOC-2567-010',
      price: '15000',
      warrantyDate: '2028-01-01',
      receivedDate: new Date('2024-01-01'),
      pmType: PmType.IM,
      pmIntervalMonth: 6,
      calType: CalType.IC,
      calIntervalMonth: 12,
      equipment_type_id: eqTypeMap['เครื่องมือการแพทย์ทั่วไป'],
      riskLevel: RiskLevel.MEDIUM,
      isSpecial: false,
      isBackup: true,
      remark: 'ใช้งานปกติ',
      imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef',
      section_id: sectionMap['OPD'],
      company_id: companyMap['COMP001'],
      type_id: typeMap['เครื่องมือแพทย์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['deptstaff'] || adminId,
    },
    {
      noid: 'EQ-2567-0002',
      name: 'เครื่องคอมพิวเตอร์พกพา (Laptop)',
      model: 'ThinkPad T14',
      serialNo: 'PF-12345',
      budgetType: 'เงินบำรุงโรงพยาบาล',
      acqType: 'จัดซื้อ',
      acqDoc: 'DOC-2567-015',
      price: '35000',
      warrantyDate: '2027-06-01',
      receivedDate: new Date('2024-06-01'),
      pmType: PmType.IM,
      pmIntervalMonth: 12,
      calType: CalType.IC,
      calIntervalMonth: 0,
      equipment_type_id: eqTypeMap['อุปกรณ์สำนักงานและไอที'],
      riskLevel: RiskLevel.LOW,
      isSpecial: false,
      isBackup: false,
      remark: 'สำหรับเจ้าหน้าที่ IT',
      imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
      section_id: sectionMap['IT'],
      company_id: companyMap['COMP002'],
      type_id: typeMap['คอมพิวเตอร์และอุปกรณ์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['parcel'] || adminId,
    },
    {
      noid: 'EQ-2567-0003',
      name: 'เตียงผู้ป่วย ICU',
      model: 'ICU-BED-Pro',
      serialNo: 'SN-BED-009',
      budgetType: 'เงินงบประมาณแผ่นดิน',
      acqType: 'จัดซื้อ',
      acqDoc: 'DOC-2567-002',
      price: '120000',
      warrantyDate: '2029-01-01',
      receivedDate: new Date('2024-02-01'),
      pmType: PmType.EM,
      pmIntervalMonth: 3,
      calType: CalType.EC,
      calIntervalMonth: 6,
      equipment_type_id: eqTypeMap['เครื่องมือช่วยชีวิต'],
      riskLevel: RiskLevel.HIGH,
      isSpecial: true,
      isBackup: false,
      remark: 'เตียงมีปัญหา รอซ่อมมอเตอร์',
      imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d',
      section_id: sectionMap['ICU'],
      company_id: companyMap['COMP001'],
      type_id: typeMap['เฟอร์นิเจอร์'],
      asset_status_id: statusMap['UNDER_REPAIR'],
      availability_status_id: availMap['UNAVAILABLE'],
      owner_id: userMap['deptstaff'] || adminId,
    },
    {
      noid: 'EQ-2567-0004',
      name: 'รถเข็นผู้ป่วย (Wheelchair)',
      model: 'WC-Standard',
      serialNo: 'SN-WC-001',
      budgetType: 'เงินบริจาค',
      acqType: 'บริจาค',
      acqDoc: 'DOC-2567-088',
      price: '5000',
      warrantyDate: '2028-05-01',
      receivedDate: new Date('2024-05-01'),
      pmType: PmType.IM,
      pmIntervalMonth: 6,
      calType: CalType.IC,
      calIntervalMonth: 0,
      equipment_type_id: eqTypeMap['เครื่องมือการแพทย์ทั่วไป'],
      riskLevel: RiskLevel.LOW,
      isSpecial: false,
      isBackup: true,
      remark: 'พร้อมใช้งาน สามารถยืมได้',
      imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982',
      section_id: sectionMap['OPD'],
      company_id: companyMap['COMP001'],
      type_id: typeMap['เครื่องมือแพทย์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['deptstaff'] || adminId,
    },
    {
      noid: 'EQ-2567-0005',
      name: 'เครื่องฉายโปรเจคเตอร์',
      model: 'Epson EB-X41',
      serialNo: 'PJ-EPS-002',
      budgetType: 'เงินบำรุงโรงพยาบาล',
      acqType: 'จัดซื้อ',
      acqDoc: 'DOC-2566-102',
      price: '18000',
      warrantyDate: '2026-08-01',
      receivedDate: new Date('2023-08-01'),
      pmType: PmType.IM,
      pmIntervalMonth: 12,
      calType: CalType.IC,
      calIntervalMonth: 0,
      equipment_type_id: eqTypeMap['อุปกรณ์สำนักงานและไอที'],
      riskLevel: RiskLevel.LOW,
      isSpecial: false,
      isBackup: false,
      remark: 'ใช้สำหรับห้องประชุม สามารถยืมได้',
      imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c',
      section_id: sectionMap['IT'],
      company_id: companyMap['COMP002'],
      type_id: typeMap['คอมพิวเตอร์และอุปกรณ์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
      owner_id: userMap['parcel'] || adminId,
    }
  ];

  for (const asset of mockAssets) {
    const existing = await prisma.asset.findFirst({
      where: { serialNo: asset.serialNo }
    });
    
    if (!existing) {
      await prisma.asset.create({
        data: {
          ...asset,
          createdBy: adminId,
          updatedBy: adminId,
        }
      });
      console.log(`  ✅ Created asset: ${asset.name} (${asset.serialNo})`);
    } else {
      console.log(`  ⚠️  Asset already exists: ${asset.serialNo}`);
    }
  }

  console.log('\n✨ Seeding complete!');
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
