/**
 * Prisma Seed Script — Mock data ครอบคลุมทั้งระบบ
 *
 * Run with:
 *   pnpm tsx prisma/seed.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
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
  { code: 'BORROWED', name: 'ถูกยืม' },
  { code: 'UNAVAILABLE', name: 'ไม่พร้อมใช้งาน' },
];

const assetTypes = [
  { name: 'เครื่องมือแพทย์', useful_life: 5 },
  { name: 'คอมพิวเตอร์และอุปกรณ์', useful_life: 3 },
  { name: 'เฟอร์นิเจอร์', useful_life: 10 },
  { name: 'ยานพาหนะ', useful_life: 8 },
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

const adminUsers = [
  {
    userName: 'admin',
    firstname: 'System',
    lastname: 'Admin',
    email: 'admin@hospital.go.th',
    password: 'Admin@1234',
    role: 'ADMIN' as const,
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

  // 6. Admin Users
  console.log('👤 Seeding Admin Users...');
  let adminId = '';
  for (const data of adminUsers) {
    let existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      adminId = existing.id;
      console.log(`  ⚠️  User already exists: ${data.email}`);
      continue;
    }

    const sectionId = sectionMap[data.sectionCode];
    const hashedPassword = await hashPassword(data.password);
    adminId = randomUUID();

    await prisma.user.create({
      data: {
        id: adminId,
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
      name: 'เครื่องวัดความดันโลหิต',
      model: 'BP-1000',
      serialNo: 'SN-BP-001',
      gmdn: '16157',
      price: '15000',
      warrantyDate: new Date('2028-01-01'),
      receivedDate: new Date('2024-01-01'),
      riskLevel: 2,
      isMedicalDevice: true,
      remark: 'ใช้งานปกติ',
      imageUrl: '',
      section_id: sectionMap['OPD'],
      company_id: companyMap['COMP001'],
      asset_type_id: typeMap['เครื่องมือแพทย์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
    },
    {
      name: 'เครื่องคอมพิวเตอร์พกพา (Laptop)',
      model: 'ThinkPad T14',
      serialNo: 'PF-12345',
      gmdn: '',
      price: '35000',
      warrantyDate: new Date('2027-06-01'),
      receivedDate: new Date('2024-06-01'),
      riskLevel: 1,
      isMedicalDevice: false,
      remark: 'สำหรับเจ้าหน้าที่ IT',
      imageUrl: '',
      section_id: sectionMap['IT'],
      company_id: companyMap['COMP002'],
      asset_type_id: typeMap['คอมพิวเตอร์และอุปกรณ์'],
      asset_status_id: statusMap['NORMAL'],
      availability_status_id: availMap['AVAILABLE'],
    },
    {
      name: 'เตียงผู้ป่วย ICU',
      model: 'ICU-BED-Pro',
      serialNo: 'SN-BED-009',
      gmdn: '34923',
      price: '120000',
      warrantyDate: new Date('2029-01-01'),
      receivedDate: new Date('2024-02-01'),
      riskLevel: 3,
      isMedicalDevice: true,
      remark: 'เตียงมีปัญหา รอซ่อมมอเตอร์',
      imageUrl: '',
      section_id: sectionMap['ICU'],
      company_id: companyMap['COMP001'],
      asset_type_id: typeMap['เฟอร์นิเจอร์'],
      asset_status_id: statusMap['UNDER_REPAIR'],
      availability_status_id: availMap['UNAVAILABLE'],
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
