import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function migrate() {
  try {
    console.log('Creating two_factor_auth table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "two_factor_auth" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "secret_encrypted" TEXT NOT NULL,
        "backup_codes" TEXT[],
        "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_used_at" TIMESTAMP(3),
        "failed_attempts" INTEGER NOT NULL DEFAULT 0,
        "locked_until" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("id")
      );
    `);

    console.log('Creating unique index on two_factor_auth.user_id...');
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_auth_user_id_key" ON "two_factor_auth"("user_id");
    `);

    console.log('Creating trusted_devices table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "trusted_devices" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "user_agent" TEXT,
        "ip_address" TEXT,
        "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expires_at" TIMESTAMP(3) NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
      );
    `);

    console.log('Creating indexes on trusted_devices...');
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "trusted_devices_token_key" ON "trusted_devices"("token");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "trusted_devices_user_id_idx" ON "trusted_devices"("user_id");
    `);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
