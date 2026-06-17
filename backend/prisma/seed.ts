/**
 * Prisma Seed Script — Create initial Sections and Admin user
 *
 * Run with:
 *   pnpm tsx prisma/seed.ts
 *
 * This script bypasses the HTTP layer entirely and writes directly to the DB,
 * so it works without a running server and avoids any auth/CSRF restrictions.
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

// ─── Seed Data ────────────────────────────────────────────────────────────────

const sections = [
  {
    code: 'IT',
    name: 'Information Technology',
    tel: '1234',
    building: 'Admin Building',
  },
  {
    code: 'OPD',
    name: 'Outpatient Department',
    tel: '1100',
    building: 'Main Building',
  },
  {
    code: 'ICU',
    name: 'Intensive Care Unit',
    tel: '1200',
    building: 'Ward Building',
  },
];

const adminUsers = [
  {
    userName: 'admin',
    firstname: 'System',
    lastname: 'Admin',
    email: 'admin@hospital.go.th',
    password: 'Admin@1234',
    role: 'ADMIN' as const,
    sectionCode: 'IT', // which section this user belongs to
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── 1. Sections ─────────────────────────────────────────────────────────────
  console.log('📂 Seeding sections...');
  const sectionMap: Record<string, string> = {}; // code -> id

  for (const data of sections) {
    const section = await prisma.section.upsert({
      where: { code: data.code },
      update: { name: data.name, tel: data.tel, building: data.building },
      create: { ...data },
    });
    sectionMap[section.code] = section.id;
    console.log(`  ✅ Section: [${section.code}] ${section.name}`);
  }

  // ── 2. Admin Users ──────────────────────────────────────────────────────────
  console.log('\n👤 Seeding admin users...');

  for (const data of adminUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      console.log(`  ⚠️  User already exists: ${data.email} — skipping`);
      continue;
    }

    const sectionId = sectionMap[data.sectionCode];
    if (!sectionId) {
      throw new Error(`Section code "${data.sectionCode}" not found in seeded sections`);
    }

    const hashedPassword = await hashPassword(data.password);
    const userId = randomUUID();

    await prisma.user.create({
      data: {
        id: userId,
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

    console.log(
      `  ✅ Created user: ${data.email} (role: ${data.role}, section: ${data.sectionCode})`,
    );
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
